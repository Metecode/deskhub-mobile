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
import { loadToken, takeTokenFromUrl } from './token.js';

takeTokenFromUrl();

const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const connection = new Connection(`${scheme}//${location.host}/client`, loadToken());
connection.connect();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') connection.wake();
});
window.addEventListener('online', () => connection.wake());

goFullscreenOnTap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App connection={connection} />
  </StrictMode>,
);
