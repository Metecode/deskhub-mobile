// Headers of the binary frames (RGB565 little endian pictures).
// Source: firmware/main/hub_server.c, on_binary and on_steam_art.
//
//   ART1 / ARS1: magic | u32 art_id | u16 w | u16 h | pixels
//   STM1:        magic | u32 appid  | u16 w | u16 h | u16 kind | u16 0 | pixels

export type ArtFrame =
  | { magic: 'ART1' | 'ARS1'; id: number; width: number; height: number; pixelOffset: 12 }
  | { magic: 'STM1'; id: number; width: number; height: number; kind: number; pixelOffset: 16 };

/** Reads a frame's header, or null when the board would reject the frame. Never throws. */
export function parseArtFrame(data: Uint8Array): ArtFrame | null {
  if (data.byteLength < 12) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  const id = view.getUint32(4, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  if (width === 0 || height === 0) return null;

  if (magic === 'STM1') {
    if (data.byteLength < 16) return null;
    const kind = view.getUint16(12, true);
    if (kind > 2 || width > 400 || height > 240) return null;
    if (data.byteLength !== 16 + width * height * 2) return null;
    return { magic, id, width, height, kind, pixelOffset: 16 };
  }
  if (magic === 'ART1' || magic === 'ARS1') {
    if (width > 320 || height > 320) return null;
    if (data.byteLength !== 12 + width * height * 2) return null;
    return { magic, id, width, height, pixelOffset: 12 };
  }
  return null;
}
