'use client';

import { useEffect, useRef } from 'react';
import type { FoodId } from '@/lib/data';
import { drawFood } from '@/lib/game/food';

export default function FoodIcon({ id, className = 'food-icon' }: { id: FoodId; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) drawFood(ref.current, id);
  }, [id]);

  return <canvas ref={ref} className={className} width={12} height={12} aria-hidden />;
}
