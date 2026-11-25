import { useEffect, useRef } from 'react';
import type { Cover } from '../cover.js';
import type { IconName } from '../icons.js';
import styles from './CoverArt.module.css';
import { Icon } from './Icon.js';

interface CoverArtProps {
  cover: Cover | null;
  /** In its place when there is none. */
  icon: IconName;
  iconSize: number;
  className?: string;
}

/** A cover that fills its box. */
export function CoverArt({ cover, icon, iconSize, className = '' }: CoverArtProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!cover || !canvas.current) return;
    canvas.current.width = cover.width;
    canvas.current.height = cover.height;
    canvas.current.getContext('2d')?.putImageData(new ImageData(cover.rgba, cover.width, cover.height), 0, 0);
  }, [cover]);
  return (
    <div className={`${styles.frame} ${className}`}>
      {cover ? <canvas ref={canvas} className={styles.image} /> : <Icon name={icon} size={iconSize} color="var(--dim)" />}
    </div>
  );
}
