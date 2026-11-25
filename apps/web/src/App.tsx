import { visibleWidgets, type Page } from '@deskhub-mobile/protocol';
import { useState, useSyncExternalStore } from 'react';
import { calendarBadge } from './agenda.js';
import styles from './App.module.css';
import { Rail } from './components/Rail.js';
import { TokenForm } from './components/TokenForm.js';
import { isOnline, type Connection } from './connection.js';
import { useNow, usePortrait } from './hooks.js';
import { pageToShow, tabsOf } from './nav.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { HomePage } from './pages/HomePage.js';
import { MediaPage } from './pages/MediaPage.js';
import { ShortcutsPage } from './pages/ShortcutsPage.js';
import { StatsPage } from './pages/StatsPage.js';
import { WeatherPage } from './pages/WeatherPage.js';
import { saveToken } from './token.js';
import type { WeatherStore } from './weather.js';

export function App({ connection, weather }: { connection: Connection; weather: WeatherStore }) {
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  const forecast = useSyncExternalStore(weather.subscribe, weather.getState);
  const [page, setPage] = useState<Page>('home');
  const now = Math.floor(useNow(1000) / 1000);
  const portrait = usePortrait();

  if (state.link === 'bad_token') {
    return (
      <TokenForm
        onSubmit={(token) => {
          saveToken(token);
          connection.setToken(token);
        }}
      />
    );
  }

  const { pages, nav } = state.layout;
  const current = pageToShow(page, pages);
  // Not needed when Home shows the events already (ui_calendar_badge in ui.c).
  const homeHasEvents = visibleWidgets(state.home, pages).some((g) => g.widget === 'events');
  const show = () => {
    switch (current) {
      case 'home':
        return <HomePage state={state} weather={forecast} now={now} connection={connection} onOpen={setPage} />;
      case 'stats':
        return <StatsPage state={state} />;
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
        onSelect={setPage}
        calendarBadge={homeHasEvents ? null : calendarBadge(state.events.events, now)}
        link={state.link}
        online={isOnline(state)}
      />
      <div className={styles.page}>{show()}</div>
    </div>
  );
}
