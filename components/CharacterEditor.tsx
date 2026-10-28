'use client';

import { useEffect, useRef } from 'react';
import type { Dir, Look } from '@/lib/data';
import { SPRITE_H, SPRITE_W, spritesFor } from '@/lib/game/sprites';

const OPTIONS: { key: keyof Look; label: string; values: string[] }[] = [
  { key: 'skin', label: 'Skin', values: ['#ffdbac', '#e8b58a', '#c68642', '#8d5524'] },
  { key: 'hair', label: 'Hair', values: ['#5a3825', '#1a1a1a', '#e8c36a', '#b5452b', '#8e6bd8'] },
  { key: 'hairStyle', label: 'Style', values: ['short', 'long', 'bun', 'spiky'] },
  { key: 'shirt', label: 'Shirt', values: ['#3fb27f', '#5b8def', '#e0679b', '#f2a33a', '#8e6bd8', '#d64545'] },
];
const PREVIEW_DIRS: Dir[] = ['down', 'left', 'up', 'right'];

// Name field, look swatches and a spinning preview. Used by the first-visit
// start screen and by the Character settings.
export default function CharacterEditor({ name, look, onName, onLook, autoFocus = false }: {
  name: string;
  look: Look;
  onName: (name: string) => void;
  onLook: (look: Look) => void;
  autoFocus?: boolean;
}) {
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

  return (
    <div className="start-grid">
      <div className="preview-box">
        <canvas className="avatar-preview" ref={preview} width={SPRITE_W} height={SPRITE_H} />
      </div>
      <div className="options">
        <label htmlFor="start-name">Your name</label>
        <input
          id="start-name" type="text" maxLength={14} placeholder="e.g. Levi" autoComplete="off" autoFocus={autoFocus}
          value={name} onChange={e => onName(e.target.value)}
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
                    onClick={() => onLook({ ...look, [key]: v })}
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
  );
}
