import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInactivityAutoCloseOptions {
  isOpen: boolean;
  timeoutMs?: number; // default 5000ms (5 seconds)
  onClose: () => void;
  onBeforeClose?: () => void;
  fadeDurationMs?: number; // default 280ms
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useInactivityAutoClose({
  isOpen,
  timeoutMs = 5000,
  onClose,
  onBeforeClose,
  fadeDurationMs = 280,
  containerRef,
}: UseInactivityAutoCloseOptions) {
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(1);
  const fadeTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isClosingRef = useRef<boolean>(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;

  // Reset the inactivity timer back to full 5 seconds
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isClosingRef.current) {
      isClosingRef.current = false;
      setIsClosing(false);
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    }
  }, []);

  // Listen to user interactions inside containerRef using capture phase
  useEffect(() => {
    if (!isOpen) return;

    const el = containerRef?.current;
    const target: HTMLElement | Document = el || document;

    const handleActivity = () => {
      resetTimer();
    };

    const events = [
      'mousemove',
      'mousedown',
      'mouseup',
      'pointermove',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'wheel',
      'touchstart',
      'touchmove',
    ];

    events.forEach((evt) => {
      target.addEventListener(evt, handleActivity, { capture: true, passive: true });
    });

    return () => {
      events.forEach((evt) => {
        target.removeEventListener(evt, handleActivity, { capture: true });
      });
    };
  }, [isOpen, containerRef, resetTimer]);

  // Main countdown loop via requestAnimationFrame
  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
      isClosingRef.current = false;
      setProgress(1);
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    lastActivityRef.current = Date.now();
    setIsClosing(false);
    isClosingRef.current = false;
    setProgress(1);

    let isRunning = true;

    const checkInactivity = () => {
      if (!isRunning) return;

      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, timeoutMs - elapsed);
      const newProgress = Math.max(0, Math.min(1, remaining / timeoutMs));
      setProgress(newProgress);

      if (remaining <= 0 && !isClosingRef.current) {
        // Trigger smooth graceful closing transition
        isClosingRef.current = true;
        setIsClosing(true);

        fadeTimerRef.current = window.setTimeout(() => {
          onBeforeCloseRef.current?.();
          onCloseRef.current();
        }, fadeDurationMs);
        return;
      }

      if (!isClosingRef.current) {
        animFrameRef.current = requestAnimationFrame(checkInactivity);
      }
    };

    animFrameRef.current = requestAnimationFrame(checkInactivity);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [isOpen, timeoutMs, fadeDurationMs]);

  return {
    isClosing,
    progress,
    resetTimer,
  };
}
