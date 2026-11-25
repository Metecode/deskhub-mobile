import { randomBytes } from 'node:crypto';
import type { WeatherSettings } from '@deskhub-mobile/protocol';
import { parseOrigins } from './origins.js';

export interface Config {
  mock: boolean;
  hubToken: string;
  port: number;
  clientToken: string;
  clientOrigins: string[];
  weather: WeatherSettings | null;
  warnings: string[];
}

function readWeather(value: (key: string) => string): WeatherSettings | null {
  const coordinate = (key: string, max: number) => {
    const text = value(key);
    if (!text) throw new Error(`${key} is not set. The weather needs both WEATHER_LATITUDE and WEATHER_LONGITUDE.`);
    const n = Number(text);
    if (!(Math.abs(n) <= max)) throw new Error(`${key}: "${text}" is not a number from -${max} to ${max}.`);
    return n;
  };
  const units = value('WEATHER_UNITS') || 'metric';
  if (units !== 'metric' && units !== 'imperial')
    throw new Error(`WEATHER_UNITS: "${units}" is neither "metric" nor "imperial".`);
  if (!value('WEATHER_LATITUDE') && !value('WEATHER_LONGITUDE')) return null;
  return {
    latitude: coordinate('WEATHER_LATITUDE', 90),
    longitude: coordinate('WEATHER_LONGITUDE', 180),
    city: value('WEATHER_CITY'),
    units,
  };
}

/** Reads the settings. Throws an Error with a message for the user when one is missing or wrong. */
export function readConfig(env: Record<string, string | undefined>, mock: boolean): Config {
  const value = (key: string) => env[key]?.trim() ?? '';
  const warnings: string[] = [];

  const clientToken = value('CLIENT_TOKEN');
  if (!clientToken)
    throw new Error('CLIENT_TOKEN is not set. Copy .env.example to .env and set it; phones need it to connect.');

  let hubToken = value('HUB_TOKEN');
  if (!hubToken) {
    if (!mock) throw new Error("HUB_TOKEN is not set. Use the token from the companion's config.toml.");
    hubToken = randomBytes(16).toString('hex');
  } else if (hubToken === 'change-me' && !mock) {
    warnings.push('HUB_TOKEN is still "change-me": any program on this PC can pose as the companion.');
  }
  if (clientToken === hubToken) warnings.push('CLIENT_TOKEN and HUB_TOKEN are the same; use two different ones.');

  const portText = value('HUB_PORT') || '8765';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`HUB_PORT: "${portText}" is not a port.`);

  return {
    mock,
    hubToken,
    port,
    clientToken,
    clientOrigins: parseOrigins(value('CLIENT_ORIGINS')),
    weather: readWeather(value),
    warnings,
  };
}
