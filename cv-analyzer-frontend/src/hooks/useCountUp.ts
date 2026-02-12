'use client';

import { useState, useEffect, useRef } from 'react';

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mq.matches);
    const h = () => setPrefers(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return prefers;
}

/**
 * Returns a number that animates from 0 to `value` over `durationMs`.
 * When prefers-reduced-motion, returns `value` immediately.
 */
export function useCountUp(value: number, durationMs: number = 600): number {
  const [display, setDisplay] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);
      // ease-out
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(eased * value));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs, reducedMotion]);

  return display;
}
