-- Pxl Opis: initial schema.
-- Run once in the Supabase SQL editor, or with `supabase db push` (see docs/SUPABASE.md).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per signed-in user (created automatically on sign-up, see trigger below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  look jsonb, -- avatar: { skin, hair, hairStyle, shirt, pants }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A team's office.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Everyone who appears in the office. user_id is set once that person signs in
-- to Pxl Opis; people synced from Monday.com may not have an account yet.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  role_title text not null default '',
  presence text not null default 'online' check (presence in ('online', 'busy', 'away')),
  look jsonb,
  desk_x int,
  desk_y int,
  home_dir text not null default 'down' check (home_dir in ('up', 'down', 'left', 'right')),
  wander jsonb, -- { x1, y1, x2, y2 } box the NPC strolls around in
  greeting text[] not null default '{}',
  blocker text,
  external_ref text, -- id in the source tool (e.g. a Monday.com user id)
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#4f7fe0',
  external_ref text, -- e.g. a Monday.com board id
  created_at timestamptz not null default now()
);
create index projects_workspace_idx on public.projects (workspace_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  assignee_id uuid references public.members (id) on delete set null,
  code text, -- short label shown on cards, like T-101
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'med' check (priority in ('high', 'med', 'low')),
  due_date date,
  source text not null default 'local' check (source in ('local', 'monday')),
  external_ref text, -- e.g. a Monday.com item id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

-- Connections to outside tools. Tokens are only ever read by server code using
-- the secret (service role) key: there are deliberately no RLS policies below,
-- so browsers can't read this table at all.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('monday')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  account jsonb, -- e.g. the Monday.com account name/id, for display
  connected_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New users get a profile automatically
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: you only see workspaces you're a member of
-- ---------------------------------------------------------------------------

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.integrations enable row level security;

create policy "Own profile: read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Own profile: create" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Own profile: update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Members: read workspace" on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy "Members: rename workspace" on public.workspaces
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "Members: manage members" on public.members
  for all to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "Members: manage projects" on public.projects
  for all to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "Members: manage tasks" on public.tasks
  for all to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- integrations: no policies on purpose (server-only, see above).

-- Live updates for the board and the office.
alter publication supabase_realtime add table public.tasks, public.members;

-- ---------------------------------------------------------------------------
-- create_demo_workspace(): gives a new user an office filled with the demo
-- team, projects and tasks, so it isn't empty before Monday.com is connected.
-- Returns the workspace id. If the user already belongs to one, returns that.
-- Call from the app with: supabase.rpc('create_demo_workspace')
-- ---------------------------------------------------------------------------

create function public.create_demo_workspace(workspace_name text default 'Pxl Opis HQ')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  select m.workspace_id into ws from public.members m where m.user_id = uid limit 1;
  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name, created_by) values (workspace_name, uid) returning id into ws;

  -- You. external_ref 'demo:*' lets the task insert below find people and projects by key.
  insert into public.members (workspace_id, user_id, display_name, role_title, external_ref)
  values (
    ws, uid,
    coalesce((select p.display_name from public.profiles p where p.id = uid), 'You'),
    'Team lead', 'demo:me'
  );

  insert into public.members
    (workspace_id, display_name, role_title, presence, desk_x, desk_y, home_dir, wander, look, greeting, blocker, external_ref)
  values
    (ws, 'Maya Chen', 'Product Designer', 'online', 4, 10, 'down', null,
     '{"skin":"#f1c27d","hair":"#2b1b17","hairStyle":"long","shirt":"#e0679b","pants":"#34344a"}',
     array['Hi! I''m Maya. I make things look good.', 'The onboarding mockups are almost ready for review.'],
     'Waiting on final copy from Lena for the welcome screens.', 'demo:maya'),
    (ws, 'Jordan Reyes', 'Frontend Dev', 'online', 11, 10, 'down', null,
     '{"skin":"#c68642","hair":"#1a1a1a","hairStyle":"spiky","shirt":"#5b8def","pants":"#2d3047"}',
     array['Yo! Jordan here. Pushing pixels into production.'],
     'Safari keeps breaking the nav. I''m on it, but it''s a fight.', 'demo:jordan'),
    (ws, 'Priya Nair', 'Backend Dev', 'online', 28, 10, 'down', null,
     '{"skin":"#a86b3c","hair":"#111111","hairStyle":"bun","shirt":"#8e6bd8","pants":"#3a3a50"}',
     array['Hey, I''m Priya. If it has an API, I probably wrote it.'],
     'Need a decision on token lifetime before I can finish auth.', 'demo:priya'),
    (ws, 'Sam Okafor', 'QA Engineer', 'online', 35, 10, 'down', null,
     '{"skin":"#ffdbac","hair":"#d9a441","hairStyle":"short","shirt":"#f2a33a","pants":"#4a4e69"}',
     array['Sam, QA. I break things so customers don''t have to.'],
     'Blocked until the Safari fix lands on staging.', 'demo:sam'),
    (ws, 'Alex Kim', 'DevOps', 'busy', 4, 14, 'down', null,
     '{"skin":"#e0ac69","hair":"#7a2e1f","hairStyle":"spiky","shirt":"#3a3f4b","pants":"#22252f"}',
     array['Alex. Keeping the servers alive.'],
     'CI runners are maxed out. Budget approval would help.', 'demo:alex'),
    (ws, 'Lena Fischer', 'Marketing Lead', 'online', 28, 14, 'down', null,
     '{"skin":"#ffe0bd","hair":"#e8c36a","hairStyle":"long","shirt":"#46b5a6","pants":"#3b3355"}',
     array['Lena from marketing! Launch is in three weeks, no pressure.'],
     'Need final screenshots of the app for the launch emails.', 'demo:lena'),
    (ws, 'Omar Haddad', 'Project Manager', 'online', 43, 2, 'down', null,
     '{"skin":"#8d5524","hair":"#1b1b1b","hairStyle":"short","shirt":"#f4f4f4","pants":"#2b2d42"}',
     array['Welcome to my office. Grab a seat.', 'I keep the roadmap honest. Let''s talk priorities.'],
     'Two teams want the same sprint. Classic.', 'demo:omar'),
    (ws, 'Tom Becker', 'Data Analyst', 'away', 20, 4, 'down', '{"x1":14,"y1":2,"x2":38,"y2":7}',
     '{"skin":"#f5c9a0","hair":"#6b4226","hairStyle":"short","shirt":"#d64545","pants":"#3a3a50"}',
     array['Oh, hey! Just on a lunch break.', 'The funnel numbers look interesting, by the way.'],
     'Event names are a mess. Half the dashboard is guesswork.', 'demo:tom'),
    (ws, 'Rosa Lindqvist', 'UX Researcher', 'online', 6, 6, 'down', '{"x1":1,"y1":2,"x2":12,"y2":7}',
     '{"skin":"#fbd3b4","hair":"#b5452b","hairStyle":"bun","shirt":"#9be37a","pants":"#2d3047"}',
     array['Hi! Prepping the room for user interviews.'],
     'Still recruiting two more participants for Thursday.', 'demo:rosa');

  insert into public.projects (workspace_id, name, color, external_ref) values
    (ws, 'Website Redesign', '#4f7fe0', 'demo:web'),
    (ws, 'Mobile App v2', '#d4508a', 'demo:app'),
    (ws, 'Q4 Launch', '#d97a12', 'demo:q4');

  insert into public.tasks (workspace_id, project_id, assignee_id, code, title, status, priority, due_date)
  select ws, p.id, m.id, t.code, t.title, t.status, t.priority, current_date + t.due_in
  from (values
    ('T-101', 'app', 'maya',   'Onboarding flow hi-fi mockups',      'doing',  'high', 2),
    ('T-102', 'web', 'maya',   'Dark mode design tokens',            'review', 'med',  4),
    ('T-103', 'q4',  'maya',   'Icon set for launch landing page',   'todo',   'low',  10),
    ('T-111', 'web', 'jordan', 'Build new pricing page',             'doing',  'high', 3),
    ('T-112', 'web', 'jordan', 'Fix nav overflow on Safari',         'todo',   'med',  -1),
    ('T-113', 'app', 'jordan', 'Implement onboarding screens',       'todo',   'high', 8),
    ('T-121', 'app', 'priya',  'Auth service: refresh tokens',       'doing',  'high', 2),
    ('T-122', 'web', 'priya',  'Rate limiting on public API',        'review', 'med',  3),
    ('T-123', 'app', 'priya',  'Move cron jobs to a queue',          'done',   'low',  -3),
    ('T-131', 'web', 'sam',    'Regression suite for checkout',      'doing',  'med',  5),
    ('T-132', 'app', 'sam',    'Test plan for app v2 beta',          'todo',   'high', 6),
    ('T-133', 'web', 'sam',    'Verify Safari nav fix',              'todo',   'low',  4),
    ('T-141', 'app', 'alex',   'Staging environment for app v2',     'done',   'high', -5),
    ('T-142', 'web', 'alex',   'Cut CI build time under 6 min',      'doing',  'med',  7),
    ('T-143', 'q4',  'alex',   'Uptime alerts for launch day',       'todo',   'med',  12),
    ('T-151', 'q4',  'lena',   'Launch email sequence (3 emails)',   'doing',  'high', 5),
    ('T-152', 'q4',  'lena',   'Product Hunt assets',                'todo',   'med',  14),
    ('T-153', 'q4',  'lena',   'Customer case study: Acme Corp',     'review', 'low',  6),
    ('T-161', 'q4',  'omar',   'Q4 roadmap review',                  'review', 'high', 1),
    ('T-162', 'app', 'omar',   'Sprint 14 planning',                 'todo',   'med',  3),
    ('T-163', 'web', 'omar',   'Stakeholder update deck',            'done',   'med',  -2),
    ('T-171', 'q4',  'tom',    'Funnel dashboard for launch',        'doing',  'med',  9),
    ('T-172', 'app', 'tom',    'Clean up event tracking names',      'todo',   'low',  15),
    ('T-191', 'web', 'rosa',   'Usability test: new checkout',       'doing',  'high', 2),
    ('T-192', 'app', 'rosa',   'Synthesize interview notes',         'review', 'med',  4),
    ('T-181', 'app', 'me',     'Review Maya''s onboarding mockups',  'todo',   'high', 1),
    ('T-182', 'app', 'me',     'Write release notes for v2 beta',    'todo',   'med',  6),
    ('T-183', 'q4',  'me',     'Approve Q4 CI budget',               'doing',  'high', 0)
  ) as t (code, proj, who, title, status, priority, due_in)
  join public.projects p on p.workspace_id = ws and p.external_ref = 'demo:' || t.proj
  join public.members m on m.workspace_id = ws and m.external_ref = 'demo:' || t.who;

  return ws;
end;
$$;

revoke all on function public.create_demo_workspace(text) from public, anon;
grant execute on function public.create_demo_workspace(text) to authenticated;
