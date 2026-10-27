'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_LOOK, type Dir, type Look } from '@/lib/data';
import { SPRITE_H, SPRITE_W, spritesFor } from '@/lib/game/sprites';
import { useOffice } from '@/lib/store';

const OPTIONS: { key: keyof Look; label: string; values: string[] }[] = [
  { key: 'skin', label: 'Skin', values: ['#ffdbac', '#e8b58a', '#c68642', '#8d5524'] },
  { key: 'hair', label: 'Hair', values: ['#5a3825', '#1a1a1a', '#e8c36a', '#b5452b', '#8e6bd8'] },
  { key: 'hairStyle', label: 'Style', values: ['short', 'long', 'bun', 'spiky'] },
  { key: 'shirt', label: 'Shirt', values: ['#3fb27f', '#5b8def', '#e0679b', '#f2a33a', '#8e6bd8', '#d64545'] },
];
const PREVIEW_DIRS: Dir[] = ['down', 'left', 'up', 'right'];

export default function StartScreen() {
  const [name, setName] = useState('');
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const preview = useRef<HTMLCanvasElement>(null);

  // Spin the avatar through all four directions with a walk cycle.
  useEffect(() => {
    const g = preview.current!.getContext('2d')!;
    const sprites = spritesFor(look);
    let tick = 0;
    const draw = () => {
      const dir = PREVIEW_DIRS[Math.floor(tick / 8) % 4];
      g.clearRect(0, 0, SPRITE_W, SPRITE_H);
      g.drawImage(sprites[dir][[1, 0, 2, 0][tick % 4]], 0, 0);
      tick++;
    };
    draw();
    const timer = setInterval(draw, 150);
    return () => clearInterval(timer);
  }, [look]);

  const enter = (e: React.FormEvent) => {
    e.preventDefault();
    const playerName = name.trim() || 'You';
    const { start, openDialog } = useOffice.getState();
    start(playerName, look);
    openDialog({
      speaker: 'TIP',
      pages: [
        `Welcome to the office, ${playerName}!`,
        'Walk up to a coworker and press E to see what they are working on.',
        'The whiteboard in the Meeting Room opens the project board. Press ? for all controls.',
      ],
    });
  };

  return (
    <div id="start">
      <form className="start-card" onSubmit={enter}>
        <h1>Pxl Opis</h1>
        <p className="sub">Project management, but you walk to your desk.</p>
        <div className="start-grid">
          <div className="preview-box">
            <canvas id="start-preview" ref={preview} width={SPRITE_W} height={SPRITE_H} />
          </div>
          <div className="options">
            <label htmlFor="start-name">Your name</label>
            <input
              id="start-name" type="text" maxLength={14} placeholder="e.g. Levi" autoComplete="off" autoFocus
              value={name} onChange={e => setName(e.target.value)}
            />
            {OPTIONS.map(({ key, label, values }) => (
              <div key={key} className="opt-row">
                <span className="opt-label">{label}</span>
                <div className="swatches">
                  {values.map(v => {
                    const text = key === 'hairStyle';
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-label={`${label} ${v}`}
                        className={`swatch${text ? ' text' : ''}${look[key] === v ? ' active' : ''}`}
                        style={text ? undefined : { background: v }}
                        onClick={() => setLook(l => ({ ...l, [key]: v }))}
                      >
                        {text ? v : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button className="pixel-btn big" type="submit">Enter the office ▶</button>
      </form>
    </div>
  );
}
