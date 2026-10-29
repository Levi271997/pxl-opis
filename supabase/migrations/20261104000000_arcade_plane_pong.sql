-- Pxl Opis: allow scores for Paper Plane and Break Room Pong.
-- Run once in the Supabase SQL editor after the earlier migrations.

alter table public.arcade_scores drop constraint arcade_scores_game_check;
alter table public.arcade_scores add constraint arcade_scores_game_check
  check (game in ('snake', 'breakout', 'blocks', 'race', 'invaders', 'whack', 'plane', 'pong'));
