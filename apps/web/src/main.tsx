import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import './theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertStore } from './alerts.js';
import { App } from './App.js';
import { Connection } from './connection.js';
import { DarkStore } from './dark.js';
import { goFullscreenOnTap } from './fullscreen.js';
import { loadLayout, saveLayout } from './layoutStore.js';
import { Sound } from './sound.js';
import { SpeedTestStore } from './speedTest.js';
import { TimerStore } from './timer.js';
import { loadToken, takeTokenFromUrl } from './token.js';
import { WeatherStore } from './weather.js';

takeTokenFromUrl();

const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const connection = new Connection(`${scheme}//${location.host}/client`, loadToken(), loadLayout());
const weather = new WeatherStore();
const sound = new Sound();
const speedTest = new SpeedTestStore();

const darkReasons = () => {
  const { asleep, layout } = connection.getState();
  return { asleep, pcSleep: layout.pcSleep, night: layout.night };
};
const dark = new DarkStore(darkReasons());
const timer = new TimerStore(() => {
  dark.wake();
  sound.play('timer');
});
const alerts = new AlertStore(() => {
  dark.wake();
  sound.play('alert');
});

let saved = connection.getState();
connection.subscribe(() => {
  const state = connection.getState();
  weather.setSettings(state.weather);
  dark.update(darkReasons());
  alerts.update(state.alert);
  if (state.layout !== saved.layout || state.home !== saved.home) saveLayout(state);
  saved = state;
});
connection.connect();
dark.start();
timer.resume();

function wake(): void {
  connection.wake();
  weather.wake();
  timer.tick();
  dark.tick();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') wake();
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

goFullscreenOnTap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      connection={connection}
      weather={weather}
      alerts={alerts}
      timer={timer}
      dark={dark}
      speedTest={speedTest}
      sound={sound}
    />
  </StrictMode>,
);
