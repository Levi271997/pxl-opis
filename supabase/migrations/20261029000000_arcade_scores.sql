-- Pxl Opis: arcade high scores, one leaderboard per workspace and game.
-- Run once in the Supabase SQL editor after the initial migration.

create table public.arcade_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  game text not null check (game in ('snake', 'breakout', 'blocks')),
  score int not null check (score >= 0 and score < 10000000),
  created_at timestamptz not null default now()
);
create index arcade_scores_board_idx on public.arcade_scores (workspace_id, game, score desc);

alter table public.arcade_scores enable row level security;

create policy "Members: read scores" on public.arcade_scores
  for select to authenticated using (public.is_member(workspace_id));

-- You can only post scores as yourself.
create policy "Members: post own scores" on public.arcade_scores
  for insert to authenticated with check (
    exists (
      select 1 from public.members m
      where m.id = member_id and m.workspace_id = arcade_scores.workspace_id and m.user_id = (select auth.uid())
    )
  );
