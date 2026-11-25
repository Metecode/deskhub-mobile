import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/** The time in ms, again every `intervalMs` and whenever the page comes back into view. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, intervalMs);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [intervalMs]);
  return now;
}

const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;

function onPortraitChange(listener: () => void): () => void {
  portrait?.addEventListener('change', listener);
  return () => portrait?.removeEventListener('change', listener);
}

export function usePortrait(): boolean {
  return useSyncExternalStore(onPortraitChange, () => portrait?.matches ?? false);
}

/** An element's inner height in board pixels, 0 until it is known. */
export function useInnerHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // The body's font is 14 board pixels.
      const unit = Number.parseFloat(getComputedStyle(document.body).fontSize) / 14;
      setHeight(entry!.contentRect.height / unit);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
