// How weather is shown (weather_icon, weather_text and weather_color in
// firmware/main/weather.c). `code` is a WMO weather code.
import type { IconName } from './icons.js';

export function weatherIcon(code: number, isDay: boolean): IconName {
  if (code === 0) return isDay ? 'wb_sunny' : 'nights_stay';
  if (code <= 2) return isDay ? 'wb_cloudy' : 'nights_stay';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 57) return 'grain';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'umbrella';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'ac_unit';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

export function weatherColor(code: number, isDay: boolean): string {
  if (code <= 1) return isDay ? '#fbbf5a' : '#c08cff';
  if (code === 2) return isDay ? '#fcd38d' : '#a9b4ff';
  if (code === 3 || code === 45 || code === 48) return '#aeb7e0';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '#e6f0ff';
  if (code >= 95) return '#c08cff';
  return '#67e8f9'; // drizzle and rain
}

const TEXTS: Readonly<Record<number, string>> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Storm with hail',
  99: 'Storm with hail',
};

export const weatherText = (code: number): string => TEXTS[code] ?? 'Unknown';

/** "72°", rounded away from zero like ui_fmt_temp. */
export function formatTemp(t: number): string {
  // "+ 0" turns -0 into 0.
  return `${Math.trunc(t < 0 ? t - 0.5 : t + 0.5) + 0}°`;
}

/** "40%"; little chance of rain isn't worth showing. */
export const formatPrecip = (pct: number): string => (pct >= 10 ? `${Math.trunc(pct)}%` : '');

/** The hourly forecast has no is_day (ui_weather.c). */
export function isDaytime(t: number): boolean {
  const hour = new Date(t * 1000).getHours();
  return hour >= 6 && hour < 19;
}
