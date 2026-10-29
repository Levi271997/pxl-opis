'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GAMES, gameById } from '@/lib/arcade';
import { SCREEN_H, SCREEN_W, type Button, type Game, type GameDef, type GameId, type Input } from '@/lib/arcade/types';
import { useOffice } from '@/lib/store';
import { postScore, topScores, type Score } from '@/lib/supabase/arcade';
import type { CSSVars } from './TaskCard';

const KEYS: Record<string, Button> = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'action', Enter: 'action',
};

// Personal bests live in this browser, so they work in demo mode too.
const bestKey = (id: GameId) => `pxl-opis:arcade:best:${id}`;
function loadBest(id: GameId) {
  try {
    return Number(localStorage.getItem(bestKey(id))) || 0;
  } catch {
    return 0;
  }
}
function saveBest(id: GameId, score: number) {
  try {
    localStorage.setItem(bestKey(id), String(score));
  } catch {
    // Storage blocked (private window): the best just isn't remembered.
  }
}

type Phase = 'ready' | 'playing' | 'paused' | 'over';

function Screen({ def, onExit }: { def: GameDef; onExit: () => void }) {
  const workspace = useOffice(s => s.workspace);
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef<Game | null>(null); // the running game, for clicks
  const [round, setRound] = useState(0); // bumps to start a new game
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [info, setInfo] = useState('');
  const [best, setBest] = useState(() => loadBest(def.id));
  const [newBest, setNewBest] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const finish = useCallback((final: number) => {
    setPhase('over');
    const previous = loadBest(def.id);
    setNewBest(final > previous);
    if (final > previous) {
      saveBest(def.id, final);
      setBest(final);
    }
    if (workspace && final > 0) {
      postScore(workspace, def.id, final).catch(err => console.warn('Could not save the score:', err.message));
    }
  }, [def.id, workspace]);

  useEffect(() => {
    const g = canvas.current!.getContext('2d')!;
    const game = def.create();
    current.current = game;
    const input: Input = { held: { left: false, right: false, up: false, down: false, action: false }, pressed: new Set() };
    let last = performance.now();
    let raf = 0;
    let shown = { score: -1, info: '' };

    const onKeyDown = (e: KeyboardEvent) => {
      const b = KEYS[e.key];
      if (e.key === 'p' || e.key === 'P') {
        if (phaseRef.current === 'playing') setPhase('paused');
        else if (phaseRef.current === 'paused') setPhase('playing');
        return;
      }
      if (!b) return;
      e.preventDefault(); // no page scrolling with arrows or space
      if (phaseRef.current !== 'playing') {
        if (b === 'action' && !e.repeat) {
          if (phaseRef.current === 'over') setRound(r => r + 1);
          else setPhase('playing');
        }
        return;
      }
      if (!e.repeat) input.pressed.add(b);
      input.held[b] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const b = KEYS[e.key];
      if (b) input.held[b] = false;
    };
    const releaseAll = () => {
      (Object.keys(input.held) as Button[]).forEach(k => { input.held[k] = false; });
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (phaseRef.current === 'playing' && !game.over) {
        game.update(dt, input);
        if (game.over) finish(game.score);
      }
      input.pressed.clear();
      game.draw(g);
      if (game.score !== shown.score || (game.info ?? '') !== shown.info) {
        shown = { score: game.score, info: game.info ?? '' };
        setScore(shown.score);
        setInfo(shown.info);
      }
      raf = requestAnimationFrame(frame);
    };

    setPhase(round === 0 ? 'ready' : 'playing');
    setNewBest(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, [def, round, finish]);

  return (
    <div className="arcade-play">
      <div className="arcade-bar" style={{ '--c': def.color } as CSSVars}>
        <button className="mini-btn" onClick={onExit}>&lt; Games</button>
        <strong>{def.title}</strong>
        <span className="arcade-score">Score {score}</span>
        <span className="arcade-best">Best {best}</span>
      </div>

      <div className="arcade-screen">
        <canvas
          ref={canvas} width={SCREEN_W} height={SCREEN_H}
          onPointerDown={e => {
            const game = current.current;
            if (phase !== 'playing' || !game?.click || game.over) return;
            const r = e.currentTarget.getBoundingClientRect();
            game.click(((e.clientX - r.left) / r.width) * SCREEN_W, ((e.clientY - r.top) / r.height) * SCREEN_H);
          }}
        />
        {phase !== 'playing' && (
          <div className="arcade-overlay">
            {phase === 'ready' && <><b>{def.title}</b><span>{def.controls}</span><button className="pixel-btn small" onClick={() => setPhase('playing')}>Start (Space)</button></>}
            {phase === 'paused' && <><b>Paused</b><span>Press P to keep playing</span></>}
            {phase === 'over' && (
              <>
                <b>Game over</b>
                <span>Score {score}{newBest ? ' · New best!' : ''}</span>
                {workspace && score > 0 && <span>Posted to the team leaderboard</span>}
                <button className="pixel-btn small" onClick={() => setRound(r => r + 1)}>Play again (Space)</button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="arcade-info">{info || def.controls}<span>P pause · Esc leave</span></p>
    </div>
  );
}

function Leaderboard({ id }: { id: GameId }) {
  const workspace = useOffice(s => s.workspace);
  const [scores, setScores] = useState<Score[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    topScores(workspace, id).then(setScores).catch(() => setError(true));
  }, [workspace, id]);

  if (!workspace) return <p className="arcade-note">Sign in to compete on a team leaderboard.</p>;
  if (error) return <p className="arcade-note">Leaderboard not set up yet (run the arcade migration, see docs/SUPABASE.md).</p>;
  if (!scores) return <p className="arcade-note">Loading scores…</p>;
  if (!scores.length) return <p className="arcade-note">No scores yet. Be the first!</p>;
  return (
    <ol className="leaderboard">
      {scores.map((s, i) => (
        <li key={i} className={s.mine ? 'mine' : undefined}><span>{s.name}{s.mine ? ' (you)' : ''}</span><b>{s.score}</b></li>
      ))}
    </ol>
  );
}

export default function ArcadePanel() {
  const [playing, setPlaying] = useState<GameId | null>(null);
  if (playing) return <Screen key={playing} def={gameById(playing)} onExit={() => setPlaying(null)} />;

  return (
    <div className="arcade">
      <p className="fridge-note">Insert coin… just kidding, it&apos;s free. Pick a game.</p>
      <div className="arcade-games">
        {GAMES.map(g => (
          <article key={g.id} className="arcade-game" style={{ '--c': g.color } as CSSVars}>
            <header>
              <strong>{g.title}</strong>
              <button className="pixel-btn small" onClick={() => setPlaying(g.id)}>Play</button>
            </header>
            <p>{g.blurb}</p>
            <p className="arcade-mybest">Your best: {loadBest(g.id)}</p>
            <h5>Team top 5</h5>
            <Leaderboard id={g.id} />
          </article>
        ))}
      </div>
    </div>
  );
}
