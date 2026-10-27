'use client';

import { useEffect, useRef } from 'react';
import { drawPortrait, spritesFor } from '@/lib/game/sprites';
import { lookOf, useOffice } from '@/lib/store';

export default function Portrait({ id, className = 'portrait' }: { id: string; className?: string }) {
  const playerLook = useOffice(s => s.player.look);
  const look = lookOf(id, playerLook);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) drawPortrait(ref.current, spritesFor(look));
  }, [look]);

  return <canvas ref={ref} className={className} width={16} height={16} />;
}
