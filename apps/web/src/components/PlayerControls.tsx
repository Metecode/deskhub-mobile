// The seek bar and the buttons of the Media page (firmware/main/ui_media.c).
import type { Media } from '@deskhub-mobile/protocol';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNow } from '../hooks.js';
import { positionAt } from '../position.js';
import { T } from '../text.js';
import { formatDuration } from '../time.js';
import { Icon } from './Icon.js';
import styles from './PlayerControls.module.css';

interface SeekBarProps {
  media: Media;
  /** When `media` arrived, ms. */
  at: number;
  disabled: boolean;
  onSeek: (seconds: number) => void;
}

export function SeekBar({ media, at, disabled, onSeek }: SeekBarProps) {
  const now = useNow(1000);
  const input = useRef<HTMLInputElement>(null);
  /** Where the finger is. */
  const [drag, setDrag] = useState<number | null>(null);
  /** Where a seek went, until the next message. */
  const [sought, setSought] = useState({ at: 0, pos: 0, since: 0 });

  // React's onChange is the DOM's "input"; only "change" tells when the finger is lifted.
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const commit = () => {
      const pos = Number(element.value);
      setDrag(null);
      setSought({ at, pos, since: Date.now() });
      onSeek(pos);
    };
    element.addEventListener('change', commit);
    return () => element.removeEventListener('change', commit);
  }, [at, onSeek]);

  const known = sought.at === at ? positionAt({ ...media, pos: sought.pos }, sought.since, now) : positionAt(media, at, now);
  const pos = drag ?? known;
  const max = Math.max(1, media.dur);
  return (
    <div className={styles.seek}>
      <input
        ref={input}
        type="range"
        className={styles.slider}
        style={{ '--done': `${(100 * Math.min(pos, max)) / max}%` } as CSSProperties}
        aria-label={T.media.position}
        min={0}
        max={max}
        value={pos}
        disabled={disabled || !media.canSeek || media.dur <= 0}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerCancel={() => setDrag(null)}
      />
      <div className={styles.times}>
        <span>{formatDuration(pos)}</span>
        <span>{media.dur > 0 && formatDuration(media.dur)}</span>
      </div>
    </div>
  );
}

interface ButtonsProps {
  playing: boolean;
  disabled: boolean;
  /** Smaller, for the cards of the split view. */
  small?: boolean;
  onCommand: (cmd: 'toggle' | 'next' | 'prev') => void;
}

export function PlayerButtons({ playing, disabled, small = false, onCommand }: ButtonsProps) {
  const iconSize = small ? 28 : 38;
  return (
    <div className={`${styles.buttons} ${small ? styles.small : ''}`}>
      <button type="button" aria-label={T.media.previous} disabled={disabled} onClick={() => onCommand('prev')}>
        <Icon name="skip_previous" size={iconSize} />
      </button>
      <button
        type="button"
        className={styles.play}
        aria-label={playing ? T.media.pause : T.media.play}
        disabled={disabled}
        onClick={() => onCommand('toggle')}
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} size={small ? 32 : 42} />
      </button>
      <button type="button" aria-label={T.media.next} disabled={disabled} onClick={() => onCommand('next')}>
        <Icon name="skip_next" size={iconSize} />
      </button>
    </div>
  );
}
