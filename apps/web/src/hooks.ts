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

export interface Size {
  width: number;
  height: number;
}

/** An element's inner size in board pixels, 0 until it is known. */
export function useInnerSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // Its font is 15 of the page's units (App.module.css).
      const unit = Number.parseFloat(getComputedStyle(element.closest('[data-unit]')!).fontSize) / 15;
      const { width, height } = entry!.contentRect;
      setSize({ width: width / unit, height: height / unit });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
