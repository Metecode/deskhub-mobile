import type { WeatherSettings } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  daysFrom,
  hoursFrom,
  parseWeather,
  REFRESH_MS,
  RETRY_MS,
  TIMEOUT_MS,
  WeatherStore,
  weatherUrl,
} from './weather.js';

const PLACE: WeatherSettings = { latitude: 41.01, longitude: 28.98, city: 'İstanbul', units: 'metric' };
const T = 1_800_000_000;

const BODY = {
  current: {
    temperature_2m: 12.4,
    apparent_temperature: 10.1,
    relative_humidity_2m: 71,
    weather_code: 2,
    is_day: 1,
    wind_speed_10m: 14.6,
  },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => T + i * 3600),
    temperature_2m: Array.from({ length: 24 }, (_, i) => i),
    weather_code: Array(24).fill(61),
    precipitation_probability: Array(24).fill(40),
  },
  daily: {
    time: Array.from({ length: 6 }, (_, i) => T + i * 86_400),
    weather_code: Array(6).fill(3),
    temperature_2m_max: Array(6).fill(15.2),
    temperature_2m_min: Array(6).fill(-1.4),
    precipitation_probability_max: Array(6).fill(80),
  },
};

describe('weatherUrl', () => {
  it('is the query of weather.c', () => {
    expect(weatherUrl(PLACE)).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=41.01&longitude=28.98' +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m' +
        '&hourly=temperature_2m,weather_code,precipitation_probability' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&timezone=auto&timeformat=unixtime&forecast_days=6&forecast_hours=24&wind_speed_unit=kmh',
    );
    expect(weatherUrl({ ...PLACE, units: 'imperial' })).toMatch(
      /forecast_hours=24&temperature_unit=fahrenheit&wind_speed_unit=mph$/,
    );
  });

  it('does not have the city', () => {
    expect(weatherUrl(PLACE)).not.toContain('stanbul');
  });
});

describe('parseWeather', () => {
  it('reads a forecast', () => {
    const w = parseWeather(BODY, T)!;
    expect(w).toMatchObject({ fetched: T, temp: 12.4, feels: 10.1, humidity: 71, code: 2, isDay: true, wind: 14.6 });
    expect(w.hours).toHaveLength(24);
    expect(w.hours[2]).toEqual({ time: T + 7200, temp: 2, code: 61, precip: 40 });
    expect(w.days).toHaveLength(6);
    expect(w.days[1]).toEqual({ time: T + 86_400, hi: 15.2, lo: -1.4, code: 3, precip: 80 });
  });

  it.each([null, 'x', [], {}, { current: {}, hourly: {} }, { ...BODY, daily: null }])('refuses %j', (body) => {
    expect(parseWeather(body, T)).toBeNull();
  });

  it('takes missing values as 0', () => {
    const w = parseWeather({ current: {}, hourly: { time: [T, null] }, daily: {} }, T)!;
    expect(w).toMatchObject({ temp: 0, isDay: false, days: [] });
    expect(w.hours).toEqual([
      { time: T, temp: 0, code: 0, precip: 0 },
      { time: 0, temp: 0, code: 0, precip: 0 },
    ]);
  });

  it('leaves out hours and days that are over', () => {
    const w = parseWeather(BODY, T)!;
    expect(hoursFrom(w, T + 3599)).toHaveLength(24);
    expect(hoursFrom(w, T + 3600)).toHaveLength(23);
    expect(daysFrom(w, T + 2 * 86_400)).toHaveLength(4);
    expect(hoursFrom(w, T + 9 * 86_400)).toEqual([]);
  });
});

describe('WeatherStore', () => {
  let storage: Map<string, string>;
  let respond: () => Promise<Response>;
  const calls = vi.fn<(url: string, init: RequestInit) => void>();
  let stores: WeatherStore[];

  const ok = async () => Response.json(BODY);
  const create = () => {
    const store = new WeatherStore((url, init) => {
      calls(String(url), init!);
      return respond();
    });
    stores.push(store);
    return store;
  };
  const pass = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], now: T * 1000 });
    storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    });
    calls.mockReset();
    respond = ok;
    stores = [];
  });

  afterEach(() => {
    for (const store of stores) store.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Lets the response be read, which takes real turns of the event loop. */
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  };
  const started = async (settings: WeatherSettings = PLACE) => {
    const store = create();
    store.setSettings(settings);
    await pass(0);
    await settle();
    return store;
  };

  it('does nothing without a location', async () => {
    const store = create();
    store.setSettings(undefined);
    store.setSettings(null);
    store.wake();
    await pass(REFRESH_MS * 2);
    expect(calls).not.toHaveBeenCalled();
    expect(store.getState()).toEqual({ settings: null, weather: null });
  });

  it('fetches at once, without cookies or a referrer', async () => {
    const store = await started();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0]).toEqual([
      weatherUrl(PLACE),
      expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }),
    ]);
    expect(store.getState()).toMatchObject({ settings: PLACE, weather: { temp: 12.4, fetched: T } });
  });

  it('fetches again every 15 minutes', async () => {
    await started();
    await pass(REFRESH_MS - 1);
    expect(calls).toHaveBeenCalledTimes(1);
    await pass(1);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['an error', () => Promise.reject(new TypeError('offline'))],
    ['a bad status', async () => new Response('{}', { status: 503 })],
    ['something else', async () => Response.json({ error: true })],
    ['bad JSON', async () => new Response('nope')],
  ])('keeps the old data after %s and tries again after 60 seconds', async (_name, failure) => {
    const store = await started();
    respond = failure;
    await pass(REFRESH_MS);
    await settle();
    expect(calls).toHaveBeenCalledTimes(2);
    expect(store.getState().weather?.fetched).toBe(T);
    await pass(RETRY_MS - 1);
    expect(calls).toHaveBeenCalledTimes(2);
    respond = ok;
    await pass(1);
    await settle();
    expect(calls).toHaveBeenCalledTimes(3);
    expect(store.getState().weather?.fetched).toBe(T + (REFRESH_MS + RETRY_MS) / 1000);
    await pass(REFRESH_MS - 1);
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it('gives up on a request after 10 seconds', async () => {
    respond = () =>
      new Promise((_resolve, reject) => {
        const { signal } = calls.mock.lastCall![1];
        signal!.addEventListener('abort', () => reject(signal!.reason));
      });
    await started();
    const { signal } = calls.mock.lastCall![1];
    await pass(TIMEOUT_MS - 1);
    expect(signal!.aborted).toBe(false);
    await pass(1);
    expect(signal!.aborted).toBe(true);
    await settle();
    await pass(RETRY_MS);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('keeps the data across a reload and only fetches when it is due', async () => {
    const before = await started();
    before.stop();
    await pass(REFRESH_MS / 3);
    const store = create();
    expect(store.getState()).toMatchObject({ settings: PLACE, weather: { temp: 12.4 } });
    // The bridge says the same again.
    store.setSettings(PLACE);
    await pass((REFRESH_MS * 2) / 3 - 1);
    expect(calls).toHaveBeenCalledTimes(1);
    await pass(1);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('goes on without the bridge', async () => {
    (await started()).stop();
    await pass(REFRESH_MS * 5);
    const store = create();
    await pass(0);
    await settle();
    expect(store.getState().weather?.fetched).toBe(T + (REFRESH_MS * 5) / 1000);
  });

  it('does not wait for a clock that was set back', async () => {
    (await started()).stop();
    vi.setSystemTime((T - 86_400) * 1000);
    create();
    await pass(0);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it.each(['nope', '{}', '[]', '{"settings":{"latitude":1}}', '{"settings":5,"weather":{}}'])(
    'survives %j in storage',
    (text) => {
      storage.set('deskhub-mobile.weather', text);
      expect(create().getState()).toEqual({ settings: undefined, weather: null });
    },
  );

  it('drops the data of another place, but not for another name', async () => {
    const store = await started();
    store.setSettings({ ...PLACE, city: 'Home' });
    expect(store.getState().weather).not.toBeNull();
    store.setSettings({ ...PLACE, units: 'imperial' });
    expect(store.getState().weather).toBeNull();
    await pass(0);
    expect(calls.mock.lastCall![0]).toContain('fahrenheit');
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer for a place that is no longer set', async () => {
    let answer!: (res: Response) => void;
    respond = () => new Promise((resolve) => (answer = resolve));
    const store = await started();
    store.setSettings(null);
    answer(Response.json(BODY));
    await settle();
    await pass(REFRESH_MS * 2);
    expect(store.getState()).toEqual({ settings: null, weather: null });
    expect(storage.size).toBe(0);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('wake() fetches when a timer overslept, and only then', async () => {
    const store = await started();
    store.wake();
    await pass(0);
    expect(calls).toHaveBeenCalledTimes(1);
    vi.setSystemTime((T + 3600) * 1000);
    store.wake();
    await pass(0);
    expect(calls).toHaveBeenCalledTimes(2);
    store.wake();
    await pass(0);
    expect(calls).toHaveBeenCalledTimes(2);
  });
});
