// What the diagnostics page (/#info) tells about this browser.
import { Store } from './store.js';

const HASH = '#info';

/** Whether the diagnostics page is open: part of the address, so that a link can open it too. */
export class InfoRoute extends Store<boolean> {
  constructor() {
    super(location.hash === HASH);
    const update = () => this.setState(location.hash === HASH);
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
  }

  readonly open = (): void => {
    if (!this.getState()) location.hash = HASH;
  };

  readonly close = (): void => {
    if (!this.getState()) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    this.setState(false);
  };
}

export interface LastError {
  /** ms. */
  at: number;
  text: string;
}

/** A token must not end up on the screen, where others can read it. */
export const withoutToken = (text: string): string => text.replace(/([?&]token=)[^&\s#"']*/g, '$1...');

export function describeError(e: unknown): string {
  return withoutToken(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
}

/** The last thing that went wrong on the page. */
export class ErrorStore extends Store<LastError | null> {
  constructor() {
    super(null);
  }

  readonly add = (e: unknown): void => this.setState({ at: Date.now(), text: describeError(e) });

  listen(): void {
    window.addEventListener('error', (e) => this.add(e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => this.add(e.reason));
  }
}

/** "Chrome 142", or the whole user agent when it isn't one. */
export function browserName(userAgent: string): string {
  const version = /\bChrome\/(\d+)/.exec(userAgent);
  if (!version) return userAgent;
  const other = /\b(Edg|EdgA|OPR|SamsungBrowser)\/(\d+)/.exec(userAgent);
  return other ? `${other[1]} ${other[2]} (Chrome ${version[1]})` : `Chrome ${version[1]}`;
}
