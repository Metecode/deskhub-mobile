import { visibleWidgets, type Page } from '@deskhub-mobile/protocol';
import { useState, useSyncExternalStore } from 'react';
import { calendarBadge } from './agenda.js';
import type { AlertStore } from './alerts.js';
import styles from './App.module.css';
import { DarkLayer } from './components/DarkLayer.js';
import { Rail } from './components/Rail.js';
import { TimesUp } from './components/TimesUp.js';
import { TokenForm } from './components/TokenForm.js';
import { isOnline, type Connection } from './connection.js';
import type { DarkStore } from './dark.js';
import type { ErrorStore, InfoRoute } from './diagnostics.js';
import type { LaunchStore } from './games.js';
import { useNow, usePortrait } from './hooks.js';
import { pageToShow, tabsOf } from './nav.js';
import type { OfflineStore } from './offline.js';
import { AiPage } from './pages/AiPage.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { GamesPage } from './pages/GamesPage.js';
import { GitHubPage } from './pages/GitHubPage.js';
import { HomePage } from './pages/HomePage.js';
import { InfoPage } from './pages/InfoPage.js';
import infoStyles from './pages/InfoPage.module.css';
import { MediaPage } from './pages/MediaPage.js';
import { PrinterPage } from './pages/PrinterPage.js';
import { ShortcutsPage } from './pages/ShortcutsPage.js';
import { StatsPage, type StatsView } from './pages/StatsPage.js';
import { TimerPage } from './pages/TimerPage.js';
import { WeatherPage } from './pages/WeatherPage.js';
import type { Sound } from './sound.js';
import type { SpeedTestStore } from './speedTest.js';
import { formatDuration } from './time.js';
import type { TimerStore } from './timer.js';
import { saveToken } from './token.js';
import type { WakeLockStore } from './wakeLock.js';
import type { WeatherStore } from './weather.js';

export interface Stores {
  connection: Connection;
  weather: WeatherStore;
  alerts: AlertStore;
  timer: TimerStore;
  dark: DarkStore;
  speedTest: SpeedTestStore;
  launches: LaunchStore;
  sound: Sound;
  wakeLock: WakeLockStore;
  offline: OfflineStore;
  errors: ErrorStore;
  info: InfoRoute;
}

export function App(stores: Stores) {
  const { connection, weather, alerts, timer, dark, speedTest, launches, sound, wakeLock, offline, errors, info } = stores;
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  const forecast = useSyncExternalStore(weather.subscribe, weather.getState);
  const alert = useSyncExternalStore(alerts.subscribe, alerts.getState);
  const timerState = useSyncExternalStore(timer.subscribe, timer.getState);
  const darkStyle = useSyncExternalStore(dark.subscribe, dark.getState);
  const [page, setPage] = useState<Page>('home');
  const [statsView, setStatsView] = useState<StatsView>('pc');
  const now = Math.floor(useNow(1000) / 1000);
  const portrait = usePortrait();
  const infoOpen = useSyncExternalStore(info.subscribe, info.getState);
  const infoPage = infoOpen && (
    <InfoPage state={state} wakeLock={wakeLock} offline={offline} errors={errors} now={now} onClose={info.close} />
  );

  if (state.link === 'bad_token') {
    if (infoPage) return <div className={infoStyles.alone}>{infoPage}</div>;
    return (
      <TokenForm
        onSubmit={(token) => {
          saveToken(token);
          connection.setToken(token);
        }}
      />
    );
  }

  // The Internet is a view of the stats page (ui_show_page in ui.c).
  const open = (target: Page) => {
    info.close();
    if (target === 'network') setStatsView('net');
    setPage(target === 'network' ? 'stats' : target);
  };
  const alertAction = (action: 'focus' | 'dismiss') => {
    if (alert) connection.send({ type: 'alert_action', id: alert.id, action });
    alerts.hide();
  };

  const { pages, nav } = state.layout;
  const current = pageToShow(page, pages);
  // Not needed when Home shows the events already (ui_calendar_badge in ui.c).
  const homeHasEvents = visibleWidgets(state.home, pages).some((g) => g.widget === 'events');
  const show = () => {
    switch (current) {
      case 'home':
        return (
          <HomePage
            state={state}
            weather={forecast}
            alert={alert}
            onAlertAction={alertAction}
            now={now}
            connection={connection}
            launches={launches}
            onOpen={open}
          />
        );
      case 'stats':
        return (
          <StatsPage
            state={state}
            connection={connection}
            speedTest={speedTest}
            view={statsView}
            onView={setStatsView}
            now={now}
          />
        );
      case 'ai':
        return <AiPage state={state} alert={alert} onAlertAction={alertAction} now={now} />;
      case 'printer':
        return <PrinterPage state={state} />;
      case 'games':
        return <GamesPage state={state} connection={connection} launches={launches} now={now} />;
      case 'github':
        return <GitHubPage state={state} />;
      case 'timer':
        return <TimerPage timer={timer} sound={sound} />;
      case 'calendar':
        return <CalendarPage state={state} now={now} />;
      case 'weather':
        return <WeatherPage state={forecast} now={now} />;
      case 'media':
        return <MediaPage state={state} connection={connection} />;
      case 'shortcuts':
        return <ShortcutsPage state={state} connection={connection} />;
    }
  };

  return (
    <div className={styles.app} data-nav={portrait ? 'bottom' : nav}>
      <Rail
        tabs={tabsOf(pages)}
        current={current}
        onSelect={(tab) => {
          info.close();
          setPage(tab);
        }}
        badges={{
          calendar: homeHasEvents ? null : calendarBadge(state.events.events, now),
          ai: alert && 'var(--accent)',
        }}
        texts={{ timer: timerState.status === 'idle' ? null : formatDuration(timerState.left) }}
        link={state.link}
        online={isOnline(state)}
        onStatus={infoOpen ? info.close : info.open}
      />
      <div className={styles.page}>{infoPage || show()}</div>
      {darkStyle && <DarkLayer style={darkStyle} now={now} onWake={dark.wake} />}
      {timerState.done && <TimesUp timer={timer} total={timerState.total} sound={sound} onTouch={dark.wake} />}
    </div>
  );
}
