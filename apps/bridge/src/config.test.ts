import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const env = { HUB_TOKEN: 'hub', CLIENT_TOKEN: 'client-0123456789' };

describe('readConfig', () => {
  it('has defaults', () => {
    expect(readConfig({ ...env, LOCALAPPDATA: '/local' }, false, '/repo')).toEqual({
      mock: false,
      hubToken: 'hub',
      port: 8765,
      clientToken: 'client-0123456789',
      clientOrigins: [],
      weather: null,
      bulletin: { promptFile: resolve('/repo', 'bulletin.prompt.md'), from: 360 },
      remindersFile: resolve('/repo', 'reminders.json'),
      sheets: null,
      dataDir: join('/local', 'deskhub-mobile', 'data'),
      warnings: [],
    });
  });

  it('reads the bulletin settings', () => {
    const config = readConfig(
      { ...env, BULLETIN_PROMPT_FILE: 'my.md', BULLETIN_FROM: '7:15', DATA_DIR: 'data' },
      false,
      '/repo',
    );
    expect(config.bulletin).toEqual({ promptFile: resolve('/repo', 'my.md'), from: 435 });
    expect(config.dataDir).toBe(resolve('/repo', 'data'));
    expect(() => readConfig({ ...env, BULLETIN_FROM: '25:00' }, false)).toThrow('BULLETIN_FROM');
  });

  it('reads the sheet settings', () => {
    expect(readConfig({ ...env, SHEETS_ID: 'abc' }, false, '/repo').sheets).toEqual({
      sheetId: 'abc',
      keyFile: resolve('/repo', 'google-service-account.json'),
      tabs: ['Özet', 'Pozisyonlar', 'Alımlar', 'Altın Alımları', 'Kontrol'],
    });
    expect(readConfig({ ...env, SHEETS_ID: 'abc', SHEETS_TABS: ' A , B ,' }, false).sheets?.tabs).toEqual(['A', 'B']);
  });

  it.each([true, false])('needs CLIENT_TOKEN (mock: %s)', (mock) => {
    expect(() => readConfig({ HUB_TOKEN: 'hub' }, mock)).toThrow('CLIENT_TOKEN');
    expect(() => readConfig({ HUB_TOKEN: 'hub', CLIENT_TOKEN: '  ' }, mock)).toThrow('CLIENT_TOKEN');
  });

  it('needs HUB_TOKEN, except in mock mode', () => {
    expect(() => readConfig({ CLIENT_TOKEN: 'c' }, false)).toThrow('HUB_TOKEN');
    expect(readConfig({ CLIENT_TOKEN: 'c' }, true).hubToken).not.toBe('');
  });

  it('warns about weak tokens', () => {
    expect(readConfig({ ...env, HUB_TOKEN: 'change-me' }, false).warnings).toHaveLength(1);
    const same = 'x'.repeat(16);
    expect(readConfig({ HUB_TOKEN: same, CLIENT_TOKEN: same }, false).warnings).toHaveLength(1);
    expect(readConfig({ ...env, CLIENT_TOKEN: 'x'.repeat(15) }, false).warnings).toHaveLength(1);
  });

  it.each(['0', '65536', 'abc', '80.5'])('refuses port %s', (HUB_PORT) => {
    expect(() => readConfig({ ...env, HUB_PORT }, false)).toThrow('HUB_PORT');
  });

  it('reads the weather settings', () => {
    const place = { WEATHER_LATITUDE: '41.01', WEATHER_LONGITUDE: ' -28.9 ' };
    expect(readConfig({ ...env, ...place }, false).weather).toEqual({
      latitude: 41.01,
      longitude: -28.9,
      city: '',
      units: 'metric',
    });
    const more = { WEATHER_CITY: 'İstanbul', WEATHER_UNITS: 'imperial' };
    expect(readConfig({ ...env, ...place, ...more }, true).weather).toMatchObject({ city: 'İstanbul', units: 'imperial' });
    expect(readConfig({ ...env, ...more }, false).weather).toBeNull();
    const equator = { WEATHER_LATITUDE: '0', WEATHER_LONGITUDE: '0' };
    expect(readConfig({ ...env, ...equator }, false).weather).toMatchObject({ latitude: 0, longitude: 0 });
  });

  it.each([
    ['WEATHER_LONGITUDE', { WEATHER_LATITUDE: '41' }],
    ['WEATHER_LATITUDE', { WEATHER_LONGITUDE: '29' }],
    ['WEATHER_LATITUDE', { WEATHER_LATITUDE: '91', WEATHER_LONGITUDE: '29' }],
    ['WEATHER_LATITUDE', { WEATHER_LATITUDE: '41,01', WEATHER_LONGITUDE: '29' }],
    ['WEATHER_LONGITUDE', { WEATHER_LATITUDE: '41', WEATHER_LONGITUDE: '-180.5' }],
    ['WEATHER_UNITS', { WEATHER_UNITS: 'kelvin' }],
  ])('refuses a bad %s: %j', (key, settings) => {
    expect(() => readConfig({ ...env, ...settings }, false)).toThrow(key);
  });

  it('reads CLIENT_ORIGINS', () => {
    const { clientOrigins } = readConfig({ ...env, CLIENT_ORIGINS: ' http://hub.lan:8765/, https://x.example ,' }, false);
    expect(clientOrigins).toEqual(['http://hub.lan:8765', 'https://x.example']);
  });

  it.each(['hub.lan', '*', 'http://hub.lan/path', 'ftp://hub.lan'])('refuses the origin %s', (CLIENT_ORIGINS) => {
    expect(() => readConfig({ ...env, CLIENT_ORIGINS }, false)).toThrow('CLIENT_ORIGINS');
  });
});
