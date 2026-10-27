'use client';

import { useEffect, useState } from 'react';
import { useOffice } from '@/lib/store';

// Pokemon-style location sign that slides in when you enter a room.
export default function ZoneBanner() {
  const zone = useOffice(s => s.zone);
  const tick = useOffice(s => s.zoneTick);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!tick) return;
    setShow(false);
    const enter = setTimeout(() => setShow(true), 30);
    const leave = setTimeout(() => setShow(false), 2200);
    return () => { clearTimeout(enter); clearTimeout(leave); };
  }, [tick]);

  return <div className={`zone-banner${show ? ' show' : ''}`} aria-live="polite">{zone}</div>;
}
