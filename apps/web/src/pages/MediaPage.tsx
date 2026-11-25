// Media: what plays on the PC and, with a Plex or Jellyfin server, next to it what plays
// there (firmware/main/ui_media.c).
import type { Media, MediaServer, MediaTarget } from '@deskhub-mobile/protocol';
import { useCallback } from 'react';
import { CoverArt } from '../components/CoverArt.js';
import { Empty } from '../components/Empty.js';
import { PlayerButtons, SeekBar } from '../components/PlayerControls.js';
import { isOnline, pcMedia, type BridgeState, type Connection } from '../connection.js';
import { coverOf, type Cover } from '../cover.js';
import type { IconName } from '../icons.js';
import { statusHint } from '../status.js';
import { libraryText, T } from '../text.js';
import styles from './MediaPage.module.css';

interface PlayerProps {
  type: MediaTarget;
  media: Media;
  at: number;
  cover: Cover | null;
  online: boolean;
  connection: Connection;
}

function usePlayer(type: MediaTarget, connection: Connection) {
  const seek = useCallback((seconds: number) => connection.sendMedia(type, 'seek', seconds), [type, connection]);
  return { seek, command: (cmd: 'toggle' | 'next' | 'prev') => connection.sendMedia(type, cmd) };
}

function FullPlayer({ type, media, at, cover, online, connection }: PlayerProps) {
  const { seek, command } = usePlayer(type, connection);
  return (
    <main className={styles.full}>
      <CoverArt cover={cover} icon="music_note" iconSize={80} className={styles.bigCover} />
      <div className={styles.column}>
        <p className={styles.source}>{media.source}</p>
        <h1 className={styles.title}>{media.title}</h1>
        <p className={styles.artist}>{media.artist}</p>
        <p className={styles.album}>{media.album}</p>
        <SeekBar media={media} at={at} disabled={!online} onSeek={seek} />
        {media.controls && <PlayerButtons playing={media.playing} disabled={!online} onCommand={command} />}
      </div>
    </main>
  );
}

interface CardProps extends PlayerProps {
  icon: IconName;
  source: string;
  /** Title and the two lines under it while nothing plays. */
  idle: readonly [string, string, string];
}

function PlayerCard({ type, media, at, cover, online, connection, icon, source, idle }: CardProps) {
  const { seek, command } = usePlayer(type, connection);
  const [title, artist, album] = media.active ? [media.title, media.artist, media.album] : idle;
  return (
    <section className={`${styles.player} card`} data-idle={!media.active || undefined}>
      <div className={styles.top}>
        <CoverArt
          cover={cover}
          icon={icon}
          iconSize={48}
          className={type === 'media_server' ? styles.poster : styles.smallCover}
        />
        <div className={styles.lines}>
          <p className={styles.source}>{source}</p>
          <h1>{title}</h1>
          <p className={styles.cardArtist}>{artist}</p>
          <p className={styles.cardAlbum}>{album}</p>
        </div>
      </div>
      {media.active && media.dur > 0 && <SeekBar media={media} at={at} disabled={!online} onSeek={seek} />}
      {media.active && media.controls && (
        <PlayerButtons small playing={media.playing} disabled={!online} onCommand={command} />
      )}
    </section>
  );
}

/** "Beans, Plex", or just "Plex" when the server kept its default name. */
function serverSource({ name, kind, now, transcoding }: MediaServer): string {
  const brand = kind === 'plex' ? 'Plex' : kind === 'jellyfin' ? 'Jellyfin' : '';
  const both = brand !== '' && brand.toLowerCase() !== name.toLowerCase();
  return `${name}${both ? `, ${brand}` : ''}${now.active && transcoding > 0 ? `, ${T.media.transcoding}` : ''}`;
}

export function MediaPage({ state, connection }: { state: BridgeState; connection: Connection }) {
  const online = isOnline(state);
  const media = pcMedia(state);
  const { server, covers } = state;
  const common = { online, connection };
  const pc = { ...common, type: 'media', media, at: state.mediaAt, cover: coverOf(media, covers.pc) } as const;

  if (!server.configured) {
    if (media.active) return <FullPlayer {...pc} />;
    return <Empty icon="music_note" title={T.media.nothing} hint={statusHint(state) || T.media.playOnPc} />;
  }
  return (
    <main className={styles.split}>
      <PlayerCard
        {...pc}
        icon="music_note"
        source={media.active ? media.source : T.media.thisPc}
        idle={[online ? T.media.nothingHere : T.pcOffline, statusHint(state), '']}
      />
      <PlayerCard
        {...common}
        type="media_server"
        media={server.now}
        at={state.serverAt}
        cover={coverOf(server.now, covers.server)}
        icon="movie"
        source={serverSource(server)}
        idle={[
          server.online ? T.media.nothing : T.media.cantReach(server.name),
          server.online ? libraryText(server.library) : '',
          server.version,
        ]}
      />
    </main>
  );
}
