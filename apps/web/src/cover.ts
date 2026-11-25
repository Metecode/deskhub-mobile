// Cover frames (ART1, ARS1) as pixels for a canvas.
import { parseArtFrame, type Media } from '@deskhub-mobile/protocol';

export interface Cover {
  id: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

/** RGB565, little endian, to RGBA. The low bits repeat the high ones, so white stays white. */
export function rgb565ToRgba(data: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
  const pixels = data.byteLength >> 1;
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    const v = data[i * 2]! | (data[i * 2 + 1]! << 8);
    const [r, g, b] = [v >> 11, (v >> 5) & 63, v & 31];
    rgba[i * 4] = (r << 3) | (r >> 2);
    rgba[i * 4 + 1] = (g << 2) | (g >> 4);
    rgba[i * 4 + 2] = (b << 3) | (b >> 2);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** null when it isn't a valid cover. */
export function readCover(frame: ArrayBuffer): { from: 'pc' | 'server'; cover: Cover } | null {
  const data = new Uint8Array(frame);
  const art = parseArtFrame(data);
  if (!art || art.magic === 'STM1') return null;
  const { id, width, height, pixelOffset } = art;
  const cover = { id, width, height, rgba: rgb565ToRgba(data.subarray(pixelOffset)) };
  return { from: art.magic === 'ART1' ? 'pc' : 'server', cover };
}

/** The cover if it belongs to what is playing (ui_media_has_art in ui.c). */
export function coverOf(media: Media, cover: Cover | null): Cover | null {
  return media.active && cover !== null && cover.id !== 0 && cover.id === media.artId ? cover : null;
}
