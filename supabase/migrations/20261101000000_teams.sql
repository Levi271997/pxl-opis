-- Pxl Opis: real teams. Roles (owner / admin / member), invite links and email
-- invites, a "current workspace" per user, and the demo team is removed.
-- Run once in the Supabase SQL editor after the earlier migrations.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

alter table public.members
  add column role text not null default 'member' check (role in ('owner', 'admin', 'member'));

-- Whoever created a workspace owns it.
update public.members m
set role = 'owner'
from public.workspaces w
where m.workspace_id = w.id and m.user_id = w.created_by;

create function public.is_admin(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;

-- Which office you see when you have more than one.
alter table public.profiles
  add column current_workspace_id uuid references public.workspaces (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Members: everyone reads, admins manage, you can edit your own name/look
-- ---------------------------------------------------------------------------

drop policy "Members: manage members" on public.members;

create policy "Members: read members" on public.members
  for select to authenticated using (public.is_member(workspace_id));
create policy "Admins: add members" on public.members
  for insert to authenticated with check (public.is_admin(workspace_id));
create policy "Admins: update members" on public.members
  for update to authenticated using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));
create policy "Self: update own member" on public.members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Admins: remove members" on public.members
  for delete to authenticated using (public.is_admin(workspace_id));

-- Rules RLS can't express: nobody moves a member to another workspace or swaps
-- its account, only admins change roles, and the owner can't be demoted or removed.
-- Cascades (depth > 1) and the SQL editor (no auth.uid()) are let through.
create function public.guard_members() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 or (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'The owner can''t be removed from the team';
    end if;
    return old;
  end if;
  if new.workspace_id <> old.workspace_id or new.user_id is distinct from old.user_id then
    raise exception 'A member can''t be moved to another workspace or account';
  end if;
  if new.role <> old.role then
    if not public.is_admin(old.workspace_id) then
      raise exception 'Only the owner or an admin can change roles';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The owner role can''t be changed';
    end if;
  end if;
  return new;
end;
$$;

create trigger members_guard before update or delete on public.members
  for each row execute function public.guard_members();

-- ---------------------------------------------------------------------------
-- Invites. email null = a shareable link anyone can use until it's revoked or
-- expires; email set = for that address only.
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  email text check (email is null or email = lower(email)),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);
create index invites_workspace_idx on public.invites (workspace_id);
create index invites_email_idx on public.invites (email) where email is not null;

alter table public.invites enable row level security;

create policy "Admins: manage invites" on public.invites
  for all to authenticated using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

-- Adds you to a workspace (if you aren't in it yet) and makes it your current one.
create function public.join_workspace(ws uuid, member_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if not exists (select 1 from public.members m where m.workspace_id = ws and m.user_id = uid) then
    insert into public.members (workspace_id, user_id, display_name, role, look)
    select ws, uid,
      coalesce(p.display_name, nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'Teammate'),
      member_role, p.look
    from (select 1) one
    left join public.profiles p on p.id = uid;
  end if;
  update public.profiles set current_workspace_id = ws where id = uid;
end;
$$;
revoke all on function public.join_workspace(uuid, text) from public, anon, authenticated;

-- Called by /join/<token>. Returns the workspace you joined.
create function public.accept_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv public.invites;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  select * into inv from public.invites i where i.token = invite_token;
  if not found or inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'This invite link is invalid or has expired. Ask for a new one.';
  end if;
  if inv.email is not null then
    if inv.email <> my_email then
      raise exception 'This invite was sent to %. Sign in with that email to accept it.', inv.email;
    end if;
    update public.invites set accepted_by = uid, accepted_at = coalesce(accepted_at, now()) where id = inv.id;
  end if;

  perform public.join_workspace(inv.workspace_id, inv.role);
  return inv.workspace_id;
end;
$$;
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ensure_workspace(): the office to show when you open the app. Accepts any
-- email invites waiting for you, then returns your current workspace, and
-- creates an empty one (just you, plus a "General" project) if you have none.
-- Replaces create_demo_workspace(): new offices no longer get the demo team.
-- ---------------------------------------------------------------------------

create function public.ensure_workspace() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  ws uuid;
  inv record;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  for inv in
    select i.id, i.workspace_id, i.role from public.invites i
    where i.email = my_email and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    order by i.created_at
  loop
    perform public.join_workspace(inv.workspace_id, inv.role);
    update public.invites set accepted_by = uid, accepted_at = now() where id = inv.id;
  end loop;

  select p.current_workspace_id into ws from public.profiles p where p.id = uid;
  if ws is not null and exists (select 1 from public.members m where m.workspace_id = ws and m.user_id = uid) then
    return ws;
  end if;

  select m.workspace_id into ws from public.members m where m.user_id = uid order by m.created_at limit 1;
  if ws is null then
    insert into public.workspaces (name, created_by) values ('Pxl Opis HQ', uid) returning id into ws;
    insert into public.members (workspace_id, user_id, display_name, role_title, role)
    values (
      ws, uid,
      coalesce((select p.display_name from public.profiles p where p.id = uid), nullif(split_part(my_email, '@', 1), ''), 'You'),
      'Team lead', 'owner'
    );
    insert into public.projects (workspace_id, name, color) values (ws, 'General', '#4f7fe0');
  end if;

  update public.profiles set current_workspace_id = ws where id = uid;
  return ws;
end;
$$;
revoke all on function public.ensure_workspace() from public, anon;
grant execute on function public.ensure_workspace() to authenticated;

drop function public.create_demo_workspace(text);

-- ---------------------------------------------------------------------------
-- Remove the demo team from existing workspaces. Your own tasks and the
-- projects stay; the demo people's tasks and the three sample tasks that were
-- put on your desk go.
-- ---------------------------------------------------------------------------

delete from public.tasks t
using public.members m
where t.assignee_id = m.id and m.external_ref like 'demo:%' and m.user_id is null;

delete from public.tasks
where (code, title) in (
  ('T-181', 'Review Maya''s onboarding mockups'),
  ('T-182', 'Write release notes for v2 beta'),
  ('T-183', 'Approve Q4 CI budget')
);

delete from public.members where external_ref like 'demo:%' and user_id is null;
