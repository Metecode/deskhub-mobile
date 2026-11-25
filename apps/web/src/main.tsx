import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import './theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Connection } from './connection.js';
import { goFullscreenOnTap } from './fullscreen.js';
import { loadLayout, saveLayout } from './layoutStore.js';
import { loadToken, takeTokenFromUrl } from './token.js';
import { WeatherStore } from './weather.js';

takeTokenFromUrl();

const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const connection = new Connection(`${scheme}//${location.host}/client`, loadToken(), loadLayout());
const weather = new WeatherStore();

let saved = connection.getState();
connection.subscribe(() => {
  const state = connection.getState();
  weather.setSettings(state.weather);
  if (state.layout !== saved.layout || state.home !== saved.home) saveLayout(state);
  saved = state;
});
connection.connect();

function wake(): void {
  connection.wake();
  weather.wake();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') wake();
});
window.addEventListener('online', wake);

goFullscreenOnTap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App connection={connection} weather={weather} />
  </StrictMode>,
);
