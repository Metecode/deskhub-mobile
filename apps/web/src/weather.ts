// The weather, from Open-Meteo, fetched by the phone itself so that it goes on while the
// PC is off. The query, the timing and the fallbacks are those of firmware/main/weather.c.
import type { WeatherSettings } from '@deskhub-mobile/protocol';
import { loadJson, saveJson } from './saved.js';

export const REFRESH_MS = 15 * 60_000;
export const RETRY_MS = 60_000;
export const TIMEOUT_MS = 10_000;

const HOURS = 24;
const DAYS = 6;
const KEY = 'deskhub-mobile.weather';

export interface HourForecast {
  /** Epoch seconds. */
  time: number;
  temp: number;
  code: number;
  /** % */
  precip: number;
}

export interface DayForecast {
  /** Local midnight of the place, epoch seconds. */
  time: number;
  hi: number;
  lo: number;
  code: number;
  /** % */
  precip: number;
}

export interface Weather {
  /** Epoch seconds. */
  fetched: number;
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  /** WMO weather code. */
  code: number;
  isDay: boolean;
  hours: readonly HourForecast[];
  days: readonly DayForecast[];
}

export function weatherUrl({ latitude, longitude, units }: WeatherSettings): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m' +
    '&hourly=temperature_2m,weather_code,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&timeformat=unixtime&forecast_days=6&forecast_hours=24' +
    (units === 'imperial' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '&wind_speed_unit=kmh')
  );
}

type Json = Record<string, unknown>;

const object = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
const number = (value: unknown): number => (typeof value === 'number' ? value : 0);

/** Null when it isn't a forecast. `fetched` is in epoch seconds. */
export function parseWeather(body: unknown, fetched: number): Weather | null {
  const root = object(body);
  const current = object(root?.current);
  const hourly = object(root?.hourly);
  const daily = object(root?.daily);
  if (!current || !hourly || !daily) return null;

  const at = (from: Json, key: string, i: number) => {
    const values = from[key];
    return Array.isArray(values) ? number(values[i]) : 0;
  };
  const times = (from: Json, max: number) => (Array.isArray(from.time) ? from.time.slice(0, max).map(number) : []);
  return {
    fetched,
    temp: number(current.temperature_2m),
    feels: number(current.apparent_temperature),
    humidity: Math.trunc(number(current.relative_humidity_2m)),
    wind: number(current.wind_speed_10m),
    code: Math.trunc(number(current.weather_code)),
    isDay: number(current.is_day) !== 0,
    hours: times(hourly, HOURS).map((time, i) => ({
      time,
      temp: at(hourly, 'temperature_2m', i),
      code: at(hourly, 'weather_code', i),
      precip: at(hourly, 'precipitation_probability', i),
    })),
    days: times(daily, DAYS).map((time, i) => ({
      time,
      hi: at(daily, 'temperature_2m_max', i),
      lo: at(daily, 'temperature_2m_min', i),
      code: at(daily, 'weather_code', i),
      precip: at(daily, 'precipitation_probability_max', i),
    })),
  };
}

/** The hours that aren't over yet. */
export const hoursFrom = (w: Weather, now: number) => w.hours.filter((h) => h.time + 3600 > now);

/** Local midnight plus a few hours, to be on the right date (ui_weather.c). */
export const dayTime = (d: DayForecast) => d.time + 6 * 3600;

/** The days that aren't over yet. */
export const daysFrom = (w: Weather, now: number) => w.days.filter((d) => d.time + 86_400 > now);

export interface WeatherState {
  /** undefined: the bridge hasn't said yet. null: no location is set. */
  settings: WeatherSettings | null | undefined;
  /** The last data, however old. */
  weather: Weather | null;
}

function loadState(): WeatherState {
  const saved = object(loadJson(KEY));
  const settings = object(saved?.settings) as WeatherSettings | null;
  const weather = object(saved?.weather) as Weather | null;
  if (!settings || typeof settings.latitude !== 'number' || typeof settings.longitude !== 'number')
    return { settings: undefined, weather: null };
  const usable =
    weather && typeof weather.fetched === 'number' && Array.isArray(weather.hours) && Array.isArray(weather.days);
  return { settings, weather: usable ? weather : null };
}

/** Holds the weather and keeps it fresh. */
export class WeatherStore {
  #state = loadState();
  readonly #listeners = new Set<() => void>();
  readonly #fetch: typeof fetch;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** When the next fetch is due, ms. */
  #due = 0;
  #request: AbortController | null = null;

  constructor(fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.#fetch = fetchFn;
    const { settings, weather } = this.#state;
    if (!settings) return;
    // Saved data may still be good. A clock that was set back must not delay the next fetch.
    const left = weather ? weather.fetched * 1000 + REFRESH_MS - Date.now() : 0;
    this.#schedule(left > 0 && left <= REFRESH_MS ? left : 0);
  }

  readonly getState = (): WeatherState => this.#state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** What the bridge says. undefined changes nothing. */
  setSettings(settings: WeatherSettings | null | undefined): void {
    const old = this.#state.settings;
    if (settings === undefined || JSON.stringify(settings) === JSON.stringify(old)) return;
    if (settings === null) {
      this.#stop();
      this.#update({ settings, weather: null });
      return;
    }
    if (old && weatherUrl(old) === weatherUrl(settings)) {
      this.#update({ settings });
      return;
    }
    this.#stop();
    this.#update({ settings, weather: null });
    this.#schedule(0);
  }

  /** Timers sleep with the phone: fetches now if a fetch is due. */
  wake(): void {
    if (this.#state.settings && !this.#request && Date.now() >= this.#due) this.#schedule(0);
  }

  stop(): void {
    this.#stop();
  }

  #schedule(ms: number): void {
    clearTimeout(this.#timer);
    this.#due = Date.now() + ms;
    this.#timer = setTimeout(() => void this.#run(), ms);
  }

  #stop(): void {
    clearTimeout(this.#timer);
    this.#request?.abort();
    this.#request = null;
  }

  async #run(): Promise<void> {
    const { settings } = this.#state;
    if (!settings || this.#request) return;
    const request = new AbortController();
    this.#request = request;
    const timeout = setTimeout(() => request.abort(), TIMEOUT_MS);
    const weather = await this.#load(weatherUrl(settings), request.signal);
    clearTimeout(timeout);
    // Stopped, or on to another place.
    if (this.#request !== request) return;
    this.#request = null;
    if (weather) this.#update({ weather });
    this.#schedule(weather ? REFRESH_MS : RETRY_MS);
  }

  async #load(url: string, signal: AbortSignal): Promise<Weather | null> {
    try {
      const res = await this.#fetch(url, {
        signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      return res.ok ? parseWeather(await res.json(), Math.floor(Date.now() / 1000)) : null;
    } catch {
      return null;
    }
  }

  #update(change: Partial<WeatherState>): void {
    this.#state = { ...this.#state, ...change };
    const { settings } = this.#state;
    saveJson(KEY, settings ? this.#state : null);
    for (const listener of this.#listeners) listener();
  }
}
