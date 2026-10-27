'use client';

import { useEffect, useRef } from 'react';
import { createEngine, engineRef } from '@/lib/game/engine';

// Mounts the imperative canvas engine once; React never re-renders it.
export default function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const engine = createEngine(ref.current!);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return <canvas id="world" ref={ref} aria-label="Office map" />;
}
