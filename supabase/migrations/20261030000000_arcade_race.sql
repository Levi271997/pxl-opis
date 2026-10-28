-- Pxl Opis: allow scores for the Turbo Lane race game.
-- Run once in the Supabase SQL editor after 20261029000000_arcade_scores.sql.

alter table public.arcade_scores drop constraint arcade_scores_game_check;
alter table public.arcade_scores add constraint arcade_scores_game_check
  check (game in ('snake', 'breakout', 'blocks', 'race'));
