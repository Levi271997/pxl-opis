-- Pxl Opis: Claude bots in the office (milestone 1: chat).
-- Run once in the Supabase SQL editor after the earlier migrations.
-- See docs/PLAN-claude-bots.md.

-- A bot is an AI coworker with a desk in the office. Admins manage them; the
-- whole team can see them. The Claude API is only ever called by the server.
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  role_title text not null default 'AI assistant',
  instructions text not null default '', -- the bot's personality and job, added to its system prompt
  greeting text not null default 'Hi! Ask me anything.',
  look jsonb,
  desk_x int, -- null = the app picks a free spot
  desk_y int,
  model text not null default 'claude-opus-5-5',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bots_workspace_idx on public.bots (workspace_id);

alter table public.bots enable row level security;

create policy "Members: read bots" on public.bots
  for select to authenticated using (public.is_member(workspace_id));
create policy "Admins: manage bots" on public.bots
  for all to authenticated using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

-- One private conversation per person per bot.
create table public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  input_tokens int, -- usage for assistant replies, for keeping an eye on cost
  output_tokens int,
  created_at timestamptz not null default now()
);
create index bot_messages_thread_idx on public.bot_messages (bot_id, user_id, created_at);
create index bot_messages_daily_idx on public.bot_messages (user_id, created_at) where role = 'user';

alter table public.bot_messages enable row level security;

create policy "Self: read own bot chats" on public.bot_messages
  for select to authenticated using (user_id = (select auth.uid()) and public.is_member(workspace_id));
create policy "Self: add to own bot chats" on public.bot_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.is_member(workspace_id)
    and exists (select 1 from public.bots b where b.id = bot_id and b.workspace_id = bot_messages.workspace_id)
  );
create policy "Self: clear own bot chats" on public.bot_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- Every office gets a starter bot: new workspaces through this trigger,
-- existing ones below.
create function public.add_starter_bot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.bots (workspace_id, name, role_title, greeting, instructions, look, created_by)
  values (
    new.id, 'Ada', 'Research Assistant',
    'Hi, I''m Ada, the office AI. Ask me anything: ideas, research, writing, planning.',
    'You are Ada, a friendly research assistant. Help with research, brainstorming, writing and planning. Keep answers short and practical unless asked for detail.',
    '{"skin":"#c9ced4","hair":"#5b8def","hairStyle":"spiky","shirt":"#2b2840","pants":"#463f5f"}',
    new.created_by
  );
  return new;
end;
$$;

create trigger workspaces_starter_bot after insert on public.workspaces
  for each row execute function public.add_starter_bot();

insert into public.bots (workspace_id, name, role_title, greeting, instructions, look, created_by)
select w.id, 'Ada', 'Research Assistant',
  'Hi, I''m Ada, the office AI. Ask me anything: ideas, research, writing, planning.',
  'You are Ada, a friendly research assistant. Help with research, brainstorming, writing and planning. Keep answers short and practical unless asked for detail.',
  '{"skin":"#c9ced4","hair":"#5b8def","hairStyle":"spiky","shirt":"#2b2840","pants":"#463f5f"}',
  w.created_by
from public.workspaces w
where not exists (select 1 from public.bots b where b.workspace_id = w.id);
