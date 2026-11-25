import type { Media } from '@deskhub-mobile/protocol';

/** Where playback is at `now`, given a message from `at` (both ms): it goes on by itself (media_tick). */
export function positionAt(media: Media, at: number, now: number): number {
  const { pos, dur, active, playing } = media;
  if (!active || !playing || dur <= 0 || pos >= dur) return pos;
  return Math.min(dur, pos + Math.max(0, Math.floor((now - at) / 1000)));
}
