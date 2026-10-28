// Team leaderboard for the arcade (table from the arcade_scores migration).

import type { GameId } from '../arcade/types';
import { createClient } from './client';
import type { Workspace } from './office';

export interface Score {
  name: string;
  score: number;
  mine: boolean;
}

// Each person's best score, top 5.
export async function topScores(ws: Workspace, game: GameId): Promise<Score[]> {
  const { data, error } = await createClient()
    .from('arcade_scores')
    .select('member_id, score, members(display_name)')
    .eq('workspace_id', ws.id)
    .eq('game', game)
    .order('score', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const best = new Map<string, Score>();
  for (const row of data as unknown as { member_id: string; score: number; members: { display_name: string } | null }[]) {
    if (best.has(row.member_id)) continue; // rows are sorted, so the first one is their best
    best.set(row.member_id, { name: row.members?.display_name ?? 'Someone', score: row.score, mine: row.member_id === ws.meId });
  }
  return [...best.values()].slice(0, 5);
}

export async function postScore(ws: Workspace, game: GameId, score: number) {
  const { error } = await createClient()
    .from('arcade_scores')
    .insert({ workspace_id: ws.id, member_id: ws.meId, game, score });
  if (error) throw new Error(error.message);
}
