'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefersReducedMotion;
}

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
  className?: string;
  onComplete?: () => void;
}

export function Typewriter({
  text,
  speed = 50,
  delay = 0,
  cursor = true,
  className,
  onComplete,
}: TypewriterProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(text);
      setDone(true);
      onCompleteRef.current?.();
      return;
    }
    setDisplayed('');
    setDone(false);
    let timeoutId: ReturnType<typeof setTimeout>;
    const startId = setTimeout(() => {
      let i = 0;
      const run = () => {
        if (i <= text.length) {
          setDisplayed(text.slice(0, i));
          if (i === text.length) {
            setDone(true);
            onCompleteRef.current?.();
            return;
          }
          i += 1;
          timeoutId = setTimeout(run, speed);
        }
      };
      run();
    }, delay);
    return () => {
      clearTimeout(startId);
      clearTimeout(timeoutId!);
    };
  }, [text, speed, delay, reducedMotion]);

  return (
    <span className={cn('inline', className)} aria-live="polite" aria-atomic="true">
      {displayed}
      {cursor && !done && !reducedMotion && (
        <span className="animate-typing-cursor inline-block w-0.5 h-[1em] align-baseline bg-current ml-0.5" aria-hidden />
      )}
    </span>
  );
}

interface TypewriterCycleProps {
  texts: string[];
  speed?: number;
  pauseBetween?: number;
  className?: string;
}

export function TypewriterCycle({ texts, speed = 65, pauseBetween = 2500, className }: TypewriterCycleProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentText = texts[index % texts.length];

  const onComplete = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % texts.length);
      timeoutRef.current = null;
    }, pauseBetween);
  }, [texts.length, pauseBetween]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (reducedMotion) {
    return <span className={cn(className)} aria-live="polite">{currentText}</span>;
  }

  return (
    <Typewriter
      key={index}
      text={currentText}
      speed={speed}
      delay={0}
      cursor={true}
      className={className}
      onComplete={onComplete}
    />
  );
}
