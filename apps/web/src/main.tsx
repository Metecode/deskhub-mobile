import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import './theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertStore } from './alerts.js';
import { App } from './App.js';
import { bulletinIsToday, dayOf } from './bulletin.js';
import { BurnInStore } from './burnIn.js';
import { ErrorBoundary } from './components/ErrorNote.js';
import { Connection } from './connection.js';
import { DarkStore } from './dark.js';
import { ErrorStore, InfoRoute } from './diagnostics.js';
import { EventsStore } from './eventsStore.js';
import { goFullscreenOnTap } from './fullscreen.js';
import { LaunchStore } from './games.js';
import { loadLayout, saveLayout } from './layoutStore.js';
import { LinkStore, PING_MS } from './linkQuality.js';
import { morningReading, MorningStore } from './morning.js';
import { OfflineStore } from './offline.js';
import { isCalm, takeUpdate } from './reload.js';
import { Sound } from './sound.js';
import { SpeechStore } from './speech.js';
import { SpeedTestStore } from './speedTest.js';
import { TabOrderStore } from './tabOrder.js';
import { TimerStore } from './timer.js';
import { loadToken, takeTokenFromUrl } from './token.js';
import { wakeLockEnvironment, WakeLockStore } from './wakeLock.js';
import { WeatherStore } from './weather.js';

const errors = new ErrorStore();
errors.listen();

takeTokenFromUrl();

const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const seconds = () => Math.floor(Date.now() / 1000);
const events = new EventsStore();
const connection = new Connection(`${scheme}//${location.host}/client`, loadToken(), {
  ...loadLayout(),
  events: events.load(seconds()),
});
const weather = new WeatherStore();
const sound = new Sound();
const speedTest = new SpeedTestStore();
const launches = new LaunchStore();
const wakeLock = new WakeLockStore(wakeLockEnvironment());
const offline = new OfflineStore(import.meta.env.PROD);
const info = new InfoRoute();

const speech = new SpeechStore();
const morning = new MorningStore();
const burnIn = new BurnInStore();
const tabOrder = new TabOrderStore();
const link = new LinkStore((id) => connection.ping(id));
connection.onPong = link.pong;

const darkReasons = () => {
  const { asleep, layout } = connection.getState();
  return { asleep, pcSleep: layout.pcSleep, night: layout.night };
};
const dark = new DarkStore(darkReasons());
const timer = new TimerStore(() => {
  dark.wake();
  burnIn.wake();
  sound.play('timer');
});
const alerts = new AlertStore(() => {
  dark.wake();
  burnIn.wake();
  sound.play('alert');
});
const calm = () => isCalm(alerts, timer);

let saved = connection.getState();
connection.subscribe(() => {
  const state = connection.getState();
  weather.setSettings(state.weather);
  dark.update(darkReasons());
  alerts.update(state.alert);
  if (state.link !== saved.link) link.reset();
  if (state.events !== saved.events) events.update(state.events, seconds());
  if (state.layout !== saved.layout || state.home !== saved.home) saveLayout(state);
  saved = state;
});
connection.connect();
dark.start();
burnIn.start();
timer.resume();
wakeLock.start();
void offline.start();

setInterval(() => {
  const { build } = connection.getState();
  if (takeUpdate({ own: __BUILD__, served: build, calm: calm(), lastTouch: burnIn.lastTouch, now: Date.now() }))
    location.reload();
}, 5000);

setInterval(() => {
  if (document.visibilityState === 'visible') link.ping();
}, PING_MS);

setInterval(() => {
  events.clean(seconds());
  // Refused before, perhaps not now.
  void wakeLock.update();
}, 60_000);

function wake(): void {
  connection.wake();
  weather.wake();
  timer.tick();
  dark.tick();
  burnIn.tick();
  void wakeLock.update();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') wake();
  else {
    burnIn.forget();
    link.reset();
  }
});
window.addEventListener('online', wake);

// Any touch lets the page make sounds from then on. And it keeps a dark screen awake, but
// the one that wakes it is the dark layer's.
for (const type of ['pointerup', 'click']) document.addEventListener(type, sound.unlock, true);
document.addEventListener(
  'pointerdown',
  () => {
    if (!dark.getState()) dark.wake();
  },
  true,
);

document.addEventListener('pointerdown', (e) => burnIn.down(e.pointerId), true);
for (const type of ['pointerup', 'pointercancel'] as const)
  document.addEventListener(type, (e) => burnIn.up(e.pointerId), true);

// The morning read aloud on the day's first touch, if that is turned on: Chrome speaks only after one.
document.addEventListener(
  'pointerdown',
  () => {
    const nowMs = Date.now();
    const { firstTouch, playing } = speech.getState();
    const { bulletin, events, reminders } = connection.getState();
    if (!firstTouch || playing || morning.getState().read === dayOf(nowMs) || !bulletinIsToday(bulletin, nowMs)) return;
    morning.markRead(nowMs);
    speech.play(
      morningReading({
        weather: weather.getState().weather,
        events: events.events,
        reminders: reminders?.reminders ?? [],
        bulletin,
        now: Math.floor(nowMs / 1000),
      }),
    );
  },
  true,
);

goFullscreenOnTap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary calm={calm} onError={errors.add}>
      <App
        connection={connection}
        weather={weather}
        alerts={alerts}
        timer={timer}
        dark={dark}
        speedTest={speedTest}
        launches={launches}
        sound={sound}
        wakeLock={wakeLock}
        offline={offline}
        errors={errors}
        info={info}
        burnIn={burnIn}
        link={link}
        tabOrder={tabOrder}
        speech={speech}
        morning={morning}
        calm={calm}
      />
    </ErrorBoundary>
  </StrictMode>,
);
