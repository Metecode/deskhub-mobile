// When the page reloads by itself: for a new build, and after an error.
import type { AlertStore } from './alerts.js';
import { loadJson, saveJson } from './saved.js';
import type { TimerStore } from './timer.js';

/** How long nobody must have touched the screen before a new build is loaded. */
export const UNTOUCHED_MS = 60_000;

/** For how long a build isn't loaded again when that didn't work. */
export const SAME_BUILD_MS = 60 * 60_000;

/** How long an error's note stays before the page reloads. */
export const ERROR_MS = 30_000;

/** Not more than this many reloads after errors... */
export const ERROR_RELOADS = 3;
/** ...in this time. */
export const ERROR_WINDOW_MS = 10 * 60_000;

const UPDATE_KEY = 'deskhub-mobile.update';
const ERRORS_KEY = 'deskhub-mobile.errorReloads';

/**
 * Nothing that a reload would disturb: no active alert, and no timer that runs or has ended.
 * After a reload there is no sound until the next touch, so a running timer would end silently.
 */
export function isCalm(alerts: Pick<AlertStore, 'getState'>, timer: Pick<TimerStore, 'getState'>): boolean {
  const { status, done } = timer.getState();
  return alerts.getState() === null && status !== 'running' && !done;
}

export interface UpdateFacts {
  /** This page's build. */
  own: string;
  /** The bridge's. null: not known. */
  served: string | null;
  calm: boolean;
  /** ms. */
  lastTouch: number;
  now: number;
}

/** Whether to reload for a new build now. Remembers it if so. */
export function takeUpdate({ own, served, calm, lastTouch, now }: UpdateFacts): boolean {
  // The dev server brings its own reloads.
  if (own === 'dev' || !served || served === own || !calm) return false;
  // A touch from the future: the clock was set back.
  if (now - lastTouch < UNTOUCHED_MS && now >= lastTouch) return false;
  const last = (loadJson(UPDATE_KEY) ?? {}) as { build?: unknown; at?: unknown };
  const tried = last.build === served && typeof last.at === 'number' && now >= last.at;
  if (tried && now - (last.at as number) < SAME_BUILD_MS) return false;
  saveJson(UPDATE_KEY, { build: served, at: now });
  return true;
}

/** Whether to reload after an error now. Remembers it if so. */
export function takeErrorReload(now: number): boolean {
  const saved = loadJson(ERRORS_KEY);
  const times = (Array.isArray(saved) ? saved : []).filter(
    (t): t is number => typeof t === 'number' && t <= now && now - t < ERROR_WINDOW_MS,
  );
  if (times.length >= ERROR_RELOADS) return false;
  saveJson(ERRORS_KEY, [...times, now]);
  return true;
}
