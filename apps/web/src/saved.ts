// JSON in localStorage. Storage can be blocked (private mode, site settings); then
// nothing is saved and everything else goes on.

export function loadJson(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

/** null removes it. */
export function saveJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked or full.
  }
}
