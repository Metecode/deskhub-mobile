import type { Values } from '@deskhub-mobile/protocol';
import { useCallback, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { calendarBadge } from './agenda.js';
import { hasBulletin, readingOf } from './bulletin.js';
import type { AlertStore } from './alerts.js';
import styles from './App.module.css';
import type { BurnInStore } from './burnIn.js';
import { DarkLayer } from './components/DarkLayer.js';
import { Dock } from './components/Dock.js';
import { ErrorBoundary } from './components/ErrorNote.js';
import { Panel } from './components/Panel.js';
import { SpeechBar } from './components/SpeechBar.js';
import { SwipeStage } from './components/SwipeStage.js';
import { TimesUp } from './components/TimesUp.js';
import { TokenForm } from './components/TokenForm.js';
import type { Connection } from './connection.js';
import type { DarkStore } from './dark.js';
import type { ErrorStore, InfoRoute } from './diagnostics.js';
import type { LaunchStore } from './games.js';
import { homeGrid } from './homeLayout.js';
import { useNow, usePortrait } from './hooks.js';
import type { LinkStore } from './linkQuality.js';
import { bulletinBadge, showMorning, type MorningStore } from './morning.js';
import { dockOf, viewToShow, type PageName, type View } from './nav.js';
import type { OfflineStore } from './offline.js';
import { AiPage } from './pages/AiPage.js';
import { AllPage } from './pages/AllPage.js';
import { BulletinPage } from './pages/BulletinPage.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { GamesPage } from './pages/GamesPage.js';
import { GitHubPage } from './pages/GitHubPage.js';
import { HomePage } from './pages/HomePage.js';
import { InfoPage } from './pages/InfoPage.js';
import infoStyles from './pages/InfoPage.module.css';
import { MeasurementsPage } from './pages/MeasurementsPage.js';
import { MediaPage } from './pages/MediaPage.js';
import { MorningPage } from './pages/MorningPage.js';
import { PrinterPage } from './pages/PrinterPage.js';
import { ShortcutsPage } from './pages/ShortcutsPage.js';
import { StatsPage, type StatsView } from './pages/StatsPage.js';
import { TabsPage } from './pages/TabsPage.js';
import { TimerPage } from './pages/TimerPage.js';
import { WeatherPage } from './pages/WeatherPage.js';
import type { Sound } from './sound.js';
import type { SpeechStore } from './speech.js';
import type { SpeedTestStore } from './speedTest.js';
import { orderTabs, type TabOrderStore } from './tabOrder.js';
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
  burnIn: BurnInStore;
  link: LinkStore;
  tabOrder: TabOrderStore;
  speech: SpeechStore;
  morning: MorningStore;
  /** Whether a reload would disturb nothing. */
  calm: () => boolean;
}

/** "Sonra" on a reminder puts it off for this long. */
const LATER_MS = 2 * 3600_000;

/** So that an error while rendering is the page's and not the app's. */
const Show = ({ render }: { render: () => ReactNode }) => render();

export function App(stores: Stores) {
  const { connection, weather, alerts, timer, dark, speedTest, launches, sound, wakeLock, offline, errors, info } = stores;
  const { burnIn, calm, link, tabOrder, speech, morning } = stores;
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  const forecast = useSyncExternalStore(weather.subscribe, weather.getState);
  const alert = useSyncExternalStore(alerts.subscribe, alerts.getState);
  const timerState = useSyncExternalStore(timer.subscribe, timer.getState);
  const darkStyle = useSyncExternalStore(dark.subscribe, dark.getState);
  const linkState = useSyncExternalStore(link.subscribe, link.getState);
  const error = useSyncExternalStore(errors.subscribe, errors.getState);
  const order = useSyncExternalStore(tabOrder.subscribe, tabOrder.getState);
  const morningState = useSyncExternalStore(morning.subscribe, morning.getState);
  const [page, setPage] = useState<PageName | 'all' | 'tabs' | 'measurements'>('home');
  /** Reminders put off with "Sonra", until when (ms). */
  const [later, setLater] = useState<Readonly<Record<string, number>>>({});
  const askMeasurements = useCallback((id: string) => void connection.sendBridge({ type: 'bridge.measurements.get', id }), [connection]);
  const [statsView, setStatsView] = useState<StatsView>('pc');
  const now = Math.floor(useNow(1000) / 1000);
  const portrait = usePortrait();
  const { shift, dim } = useSyncExternalStore(burnIn.subscribe, burnIn.getState);
  const infoOpen = useSyncExternalStore(info.subscribe, info.getState);
  // The Internet is a view of the stats page (ui_show_page in ui.c).
  const open = (target: PageName | 'all' | 'tabs' | 'measurements') => {
    info.close();
    if (target === 'bulletin') morning.open(Date.now());
    if (target === 'network') setStatsView('net');
    if (target === 'stats') setStatsView('pc');
    setPage(target === 'network' ? 'stats' : target);
  };
  const infoPage = infoOpen && (
    <InfoPage
      state={state}
      link={linkState}
      wakeLock={wakeLock}
      offline={offline}
      errors={errors}
      speech={speech}
      now={now}
      onTabs={() => open('tabs')}
      onClose={info.close}
    />
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

  const reminder = state.reminders?.reminders.find((r) => !r.done && (later[r.id] ?? 0) <= now * 1000) ?? null;

  const alertAction = (action: 'focus' | 'dismiss') => {
    if (alert) connection.send({ type: 'alert_action', id: alert.id, action });
    alerts.hide();
  };

  const { pages, nav } = state.layout;
  const hasMarkdown = hasBulletin(state.bulletin);
  const bulletinOn = !!state.bulletin && state.bulletin.state !== 'off';
  const tabs = orderTabs(pages, order, bulletinOn ? ['bulletin'] : []);
  const dock = dockOf(tabs);
  const current = viewToShow(page, tabs);
  const openable = (target: 'weather' | 'calendar' | 'timer') => (tabs.includes(target) ? () => open(target) : null);
  const show = (view: View) => {
    switch (view) {
      case 'all':
        return (
          <AllPage
            tabs={dock.rest ?? []}
            state={state}
            weather={forecast}
            timer={timerState}
            error={error}
            now={now}
            onOpen={open}
            onTabs={() => open('tabs')}
            onMeasurements={state.reminders?.measured.length ? () => open('measurements') : null}
            onInfo={info.open}
          />
        );
      case 'tabs':
        return (
          <TabsPage tabs={tabs} usage={state.usage} onChange={tabOrder.set} onClose={() => open(dock.rest ? 'all' : 'home')} />
        );
      case 'measurements':
        return <MeasurementsPage state={state} ask={askMeasurements} onBack={() => open(dock.rest ? 'all' : 'home')} />;
      case 'bulletin':
        return (
          <BulletinPage
            bulletin={state.bulletin}
            speech={speech}
            now={now}
            onRetry={() => connection.sendBridge({ type: 'bridge.bulletin.run' })}
          />
        );
      case 'home':
        if (showMorning(state.bulletin, morningState, now * 1000))
          return (
            <MorningPage
              state={state}
              weather={forecast}
              speech={speech}
              now={now}
              onOpen={() => open('bulletin')}
              onClose={() => morning.close(Date.now())}
            />
          );
        return (
          <HomePage
            state={state}
            grid={homeGrid(state.home, pages)}
            weather={forecast}
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
        return <AiPage state={state} now={now} />;
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
    <div
      className={styles.app}
      data-layout={portrait ? 'upright' : nav === 'bottom' ? 'top' : nav}
      data-dim={dim || undefined}
      style={{ '--shift-x': `${shift.x}px`, '--shift-y': `${shift.y}px` } as CSSProperties}
    >
      <Panel
        state={state}
        weather={forecast}
        alert={alert}
        onAlertAction={alertAction}
        timer={timerState}
        link={linkState}
        now={now}
        onWeather={openable('weather')}
        onCalendar={openable('calendar')}
        onTimer={openable('timer')}
        onLink={infoOpen ? info.close : info.open}
        reminder={reminder && {
          item: reminder,
          onSave: (values: Values) => {
            connection.sendBridge({ type: 'bridge.reminder.save', id: reminder.id, values });
            open('measurements');
          },
          onLater: () => setLater({ ...later, [reminder.id]: Date.now() + LATER_MS }),
          onChart: () => open('measurements'),
        }}
      />
      <div className={styles.body}>
        <div className={styles.stage}>
          <SwipeStage
            // The diagnostics lie over the page: there is nothing next to them.
            views={infoOpen ? [] : dock.rest ? [...dock.tabs, 'all'] : dock.tabs}
            view={current}
            onChange={open}
            render={(view) => (
              <ErrorBoundary key={infoOpen ? 'info' : view} calm={calm} onError={errors.add}>
                {infoPage || <Show render={() => show(view)} />}
              </ErrorBoundary>
            )}
          />
          <SpeechBar
            speech={speech}
            onAll={hasMarkdown ? () => speech.play(readingOf(state.bulletin!.markdown!, true)) : null}
          />
        </div>
        <Dock
          dock={dock}
          view={current}
          onSelect={open}
          badges={{
            calendar: calendarBadge(state.events.events, now),
            ai: alert && 'var(--accent)',
            timer: timerState.status === 'idle' ? null : 'var(--good)',
            bulletin: bulletinBadge(state.bulletin, morningState, now * 1000) ? 'var(--accent)' : null,
          }}
          usage={state.usage}
        />
      </div>
      {darkStyle && <DarkLayer style={darkStyle} now={now} onWake={dark.wake} />}
      {timerState.done && <TimesUp timer={timer} total={timerState.total} sound={sound} now={now} onTouch={dark.wake} />}
    </div>
  );
}
