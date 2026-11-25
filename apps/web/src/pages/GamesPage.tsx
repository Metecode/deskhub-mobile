// Games: the one being played, and the recent ones, which a tap starts on the PC
// (firmware/main/ui_games.c).
import { useSyncExternalStore } from 'react';
import { CoverArt } from '../components/CoverArt.js';
import { Icon } from '../components/Icon.js';
import { isOnline, type BridgeState, type Connection } from '../connection.js';
import { formatPlaytime, idleText, playingText, sessionSeconds, type LaunchStore } from '../games.js';
import styles from './GamesPage.module.css';

interface GamesProps {
  state: BridgeState;
  connection: Connection;
  launches: LaunchStore;
  /** Epoch seconds. */
  now: number;
}

export function GamesPage({ state, connection, launches, now }: GamesProps) {
  const launching = useSyncExternalStore(launches.subscribe, launches.getState);
  const { steam, gameCovers } = state;
  const online = isOnline(state);
  const playing = steam?.playing;
  const header = playing && gameCovers.header?.id === playing.appid ? gameCovers.header : null;
  const texts = steam && playing ? playingText(steam, sessionSeconds(steam, state, now)) : null;

  return (
    <main className={styles.page}>
      <section className={styles.top}>
        {playing && texts ? (
          <>
            <CoverArt cover={header} icon="sports_esports" iconSize={48} className={styles.header} />
            <div className={styles.now}>
              <h2 className={styles.playing}>NOW PLAYING</h2>
              <p className={styles.name}>{playing.name}</p>
              <p className={styles.time}>{texts.time}</p>
              <p className={styles.total}>{texts.total}</p>
            </div>
          </>
        ) : (
          <>
            <div className={styles.idle}>
              <Icon name="sports_esports" size={80} color="var(--dim)" />
              <div>
                <p className={styles.name}>No game running</p>
                <p className={styles.total}>{idleText(steam, online)}</p>
              </div>
            </div>
            {steam && steam.friends.length > 0 && (
              <div className={styles.friends}>
                <h2 className={styles.caption}>FRIENDS IN GAME</h2>
                {steam.friends.map(({ name, game }, i) => (
                  <p key={i} className={styles.friend}>
                    <span>{name}</span>
                    <span>{game}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.recent}>
        <h2 className={styles.caption}>RECENT{'  •  '}TAP TO PLAY</h2>
        <div className={styles.tiles}>
          {steam?.recent.map(({ appid, name, total }) => (
            <button
              key={appid}
              type="button"
              className={styles.tile}
              disabled={!online || launching !== null}
              data-launching={launching === appid || undefined}
              onClick={() => launches.launch(appid, () => connection.send({ type: 'steam_launch', appid }))}
            >
              <span className={styles.portrait}>
                <CoverArt
                  cover={gameCovers.portraits.get(appid) ?? null}
                  icon="sports_esports"
                  iconSize={48}
                  className={styles.cover}
                />
                {total > 0 && <span className={styles.hours}>{formatPlaytime(total)}</span>}
              </span>
              <span className={styles.tileName}>{launching === appid ? 'Starting...' : name}</span>
            </button>
          ))}
        </div>
        {steam?.found && steam.recent.length === 0 && <p className={styles.empty}>No recent games</p>}
      </section>
    </main>
  );
}
