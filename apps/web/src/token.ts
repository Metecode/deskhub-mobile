// The client token: comes in once through the link, then lives in localStorage.
import { TOKEN_PARAM } from '@deskhub-mobile/protocol';

const KEY = 'deskhub-mobile.token';

// Storage can be blocked (private mode, site settings); then it lasts for this page only.
let current: string | null = null;

export function loadToken(): string | null {
  try {
    current ??= localStorage.getItem(KEY);
  } catch {
    // Blocked: keep what we have.
  }
  return current;
}

export function saveToken(token: string): void {
  current = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Blocked: see above.
  }
}

/** The token in a page URL and the URL without it, or null when it has none. */
export function splitToken(href: string): { token: string; clean: string } | null {
  const url = new URL(href);
  const token = url.searchParams.get(TOKEN_PARAM);
  if (token === null) return null;
  url.searchParams.delete(TOKEN_PARAM);
  return { token, clean: url.pathname + url.search + url.hash };
}

/** Saves the token from the link, then takes it out of the address bar and the history. */
export function takeTokenFromUrl(): void {
  const found = splitToken(location.href);
  if (!found) return;
  if (found.token) saveToken(found.token);
  history.replaceState(history.state, '', found.clean);
}
