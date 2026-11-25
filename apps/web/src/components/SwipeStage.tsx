// The stage: shows a page, and the one next to it while a finger moves them.
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { View } from '../nav.js';
import { axisOf, mayStart, offsetOf, SETTLE_MS, SpeedMeter, targetOf } from '../swipe.js';
import styles from './SwipeStage.module.css';

/** Between two pages, px. */
const GAP = 16;

interface SwipeStageProps {
  /** The pages that can be swiped to, in order. */
  views: readonly View[];
  view: View;
  onChange: (view: View) => void;
  render: (view: View) => ReactNode;
}

interface Drag {
  pointer: number;
  x: number;
  y: number;
  swiping: boolean;
  meter: SpeedMeter;
}

const calmMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SwipeStage({ views, view, onChange, render }: SwipeStageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<-1 | 0 | 1>(0);
  const drag = useRef<Drag | null>(null);
  /** A swipe's end isn't a touch on what is below the finger. */
  const swiped = useRef(false);
  /** Ends what is settling at once. */
  const settle = useRef<(() => void) | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const index = views.indexOf(view);
  const neighbours = { previous: index > 0, next: index >= 0 && index < views.length - 1 };
  const other = side === 0 || index < 0 ? undefined : views[index + side];

  const move = useCallback((offset: number, animated: boolean) => {
    for (const pane of stage.current?.querySelectorAll<HTMLElement>('[data-side]') ?? []) {
      pane.style.transition = animated ? `transform ${SETTLE_MS}ms ease-out` : 'none';
      const place = Number(pane.dataset.side);
      pane.style.transform = offset === 0 && place === 0 ? '' : `translateX(calc(${place} * (100% + ${GAP}px) + ${offset}px))`;
    }
  }, []);

  // The page went another way, by the dock or because it is gone.
  useEffect(() => {
    clearTimeout(settleTimer.current);
    settle.current = null;
    setSide(0);
    drag.current = null;
    move(0, false);
  }, [view, move]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Else the browser takes a swipe for a fling as well, and the next touch, within a moment, for its end.
  useEffect(() => {
    const element = stage.current!;
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current?.swiping && e.cancelable) e.preventDefault();
    };
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => element.removeEventListener('touchmove', onTouchMove);
  }, []);

  const release = (to: -1 | 0 | 1) => {
    const width = stage.current?.clientWidth ?? 0;
    const target = to === 0 ? undefined : views[index + to];
    const finish = () => {
      clearTimeout(settleTimer.current);
      settle.current = null;
      // First the pages change, then they go to their places: the other way round the old one would flash.
      flushSync(() => {
        setSide(0);
        if (target) onChange(target);
      });
      move(0, false);
    };
    if (calmMotion()) return finish();
    move(-to * (width + GAP), true);
    settle.current = finish;
    settleTimer.current = setTimeout(finish, SETTLE_MS);
  };

  const onPointerDown = (e: PointerEvent) => {
    swiped.current = false;
    settle.current?.();
    // A second finger ends it.
    if (drag.current) {
      const { swiping } = drag.current;
      drag.current = null;
      if (swiping) release(0);
      return;
    }
    const ignored = e.target instanceof Element && e.target.closest('input, [data-no-swipe]');
    if (index < 0 || e.pointerType === 'mouse' || ignored || !mayStart(e.clientX, innerWidth)) return;
    drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, swiping: false, meter: new SpeedMeter() };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.swiping) {
      const axis = axisOf(dx, e.clientY - d.y);
      if (axis === null) return;
      if (axis === 'y') {
        drag.current = null;
        return;
      }
      d.swiping = swiped.current = true;
      stage.current?.setPointerCapture(e.pointerId);
    }
    d.meter.add(e.timeStamp, e.clientX);
    const wanted = dx > 0 && neighbours.previous ? -1 : dx < 0 && neighbours.next ? 1 : 0;
    if (wanted !== side) setSide(wanted);
    move(offsetOf(dx, neighbours), false);
  };

  const end = (e: PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.swiping) return;
    const dx = e.clientX - d.x;
    const width = stage.current?.clientWidth ?? 0;
    release(cancelled ? 0 : targetOf(dx, d.meter.speed(e.timeStamp), width, neighbours));
  };

  const panes: [View, number][] = other ? [[view, 0], [other, side]] : [[view, 0]];
  return (
    <div
      ref={stage}
      className={styles.stage}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {panes.map(([name, place]) => (
        <div
          key={name}
          className={styles.unit}
          data-unit
          data-side={place}
          inert={place !== 0}
          // Until the first move places it.
          style={place === 0 ? undefined : { transform: `translateX(calc(${place} * (100% + ${GAP}px)))` }}
        >
          {render(name)}
        </div>
      ))}
    </div>
  );
}
