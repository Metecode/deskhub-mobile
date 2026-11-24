import { describe, expect, it } from 'vitest';
import { parseArtFrame } from './art.js';

function frame(magic: string, w: number, h: number, kind?: number, extra = 0): Uint8Array {
  const header = kind === undefined ? 12 : 16;
  const data = new Uint8Array(header + w * h * 2 + extra);
  const view = new DataView(data.buffer);
  for (let i = 0; i < 4; i++) data[i] = magic.charCodeAt(i);
  view.setUint32(4, 0xc0000001, true);
  view.setUint16(8, w, true);
  view.setUint16(10, h, true);
  if (kind !== undefined) view.setUint16(12, kind, true);
  return data;
}

describe('parseArtFrame', () => {
  it.each(['ART1', 'ARS1'] as const)('reads %s', (magic) => {
    expect(parseArtFrame(frame(magic, 280, 280))).toEqual({
      magic,
      id: 0xc0000001,
      width: 280,
      height: 280,
      pixelOffset: 12,
    });
  });

  it('reads STM1', () => {
    expect(parseArtFrame(frame('STM1', 400, 240, 2))).toEqual({
      magic: 'STM1',
      id: 0xc0000001,
      width: 400,
      height: 240,
      kind: 2,
      pixelOffset: 16,
    });
  });

  it('reads a frame that is a view into a larger buffer', () => {
    const data = frame('ART1', 2, 2);
    const shifted = new Uint8Array(data.byteLength + 3);
    shifted.set(data, 3);
    expect(parseArtFrame(shifted.subarray(3))).toMatchObject({ width: 2, height: 2 });
  });

  it.each([
    ['an empty frame', new Uint8Array()],
    ['a bare magic', frame('ART1', 1, 1).subarray(0, 4)],
    ['an unknown magic', frame('XYZ1', 2, 2)],
    ['no width', frame('ART1', 0, 2)],
    ['art that is too wide', frame('ART1', 321, 1)],
    ['trailing bytes', frame('ART1', 2, 2, undefined, 1)],
    ['a cut off STM1 header', frame('STM1', 1, 1)],
    ['an unknown STM1 kind', frame('STM1', 2, 2, 3)],
    ['a Steam cover that is too tall', frame('STM1', 1, 241, 0)],
  ])('rejects %s', (_name, data) => {
    expect(parseArtFrame(data)).toBeNull();
  });
});
