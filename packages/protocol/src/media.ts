// Now playing on the PC, and on the Plex or Jellyfin server.
// Source: on_media and on_media_server in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool, int, text, type Fields } from './fields.js';

/** What a media command is for: the PC or the media server. */
export type MediaTarget = 'media' | 'media_server';

export interface Media {
  active: boolean;
  playing: boolean;
  canSeek: boolean;
  /** False for a source that can't be remote controlled. */
  controls: boolean;
  /** Seconds. */
  pos: number;
  /** Seconds, 0 when unknown. */
  dur: number;
  /** 0: no cover. */
  artId: number;
  title: string;
  artist: string;
  album: string;
  source: string;
}

export interface MediaServer {
  /** False: no server is set up and the Media page shows the PC only. */
  configured: boolean;
  online: boolean;
  streams: number;
  transcoding: number;
  name: string;
  /** "plex" or "jellyfin" */
  kind: string;
  version: string;
  library: string;
  now: Media;
}

function readMedia(m: Fields): Media {
  return {
    active: bool(m, 'active'),
    playing: bool(m, 'playing'),
    canSeek: bool(m, 'can_seek'),
    controls: m.controls !== false,
    pos: int(m, 'pos'),
    dur: int(m, 'dur'),
    artId: int(m, 'art_id'),
    title: text(m, 'title'),
    artist: text(m, 'artist'),
    album: text(m, 'album'),
    source: text(m, 'source'),
  };
}

export const NO_MEDIA: Media = readMedia({});

export function normalizeMedia(raw: RawMessage): Media {
  return readMedia(raw);
}

export function normalizeMediaServer(raw: RawMessage): MediaServer {
  return {
    configured: bool(raw, 'configured'),
    online: bool(raw, 'online'),
    streams: int(raw, 'streams'),
    transcoding: int(raw, 'transcoding'),
    name: text(raw, 'name'),
    kind: text(raw, 'kind'),
    version: text(raw, 'version'),
    library: text(raw, 'library'),
    now: readMedia(raw),
  };
}
