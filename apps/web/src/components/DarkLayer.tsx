// The dark screen: black, or a large dim clock that moves every minute (firmware/main/ui_saver.c).
// Really turning the screen off is beyond a web page.
import type { DarkStyle } from '@deskhub-mobile/protocol';
import { useEffect, useRef, useState } from 'react';
import { formatClock, formatDate } from '../time.js';
import styles from './DarkLayer.module.css';

interface DarkLayerProps {
  style: DarkStyle;
  /** Epoch seconds. */
  now: number;
  onWake: () => void;
}

function MovingClock({ now }: { now: number }) {
  const minute = Math.floor(now / 60);
  const [place, setPlace] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => setPlace({ x: Math.random(), y: Math.random() }), [minute]);
  return (
    // Off from the left by a share of the free room, and the same from the top.
    <div
      className={styles.clock}
      style={{
        left: `${place.x * 100}%`,
        top: `${place.y * 100}%`,
        transform: `translate(${-place.x * 100}%, ${-place.y * 100}%)`,
      }}
    >
      <p className={styles.time}>{formatClock(now)}</p>
      <p className={styles.date}>{formatDate(now)}</p>
    </div>
  );
}

export function DarkLayer({ style, now, onWake }: DarkLayerProps) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = layer.current!;
    // The touch only wakes: with the layer gone, its click would land on what is below.
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      onWake();
    };
    element.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => element.removeEventListener('touchend', onTouchEnd);
  }, [onWake]);
  return (
    <div
      ref={layer}
      className={styles.layer}
      onClick={(e) => {
        e.stopPropagation();
        onWake();
      }}
    >
      {style === 'clock' && (
        <div className={styles.room}>
          <MovingClock now={now} />
        </div>
      )}
    </div>
  );
}
