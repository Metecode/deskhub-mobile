import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const env = { HUB_TOKEN: 'hub', CLIENT_TOKEN: 'client' };

describe('readConfig', () => {
  it('has defaults', () => {
    expect(readConfig(env, false)).toEqual({
      mock: false,
      hubToken: 'hub',
      port: 8765,
      clientToken: 'client',
      clientOrigins: [],
      warnings: [],
    });
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
    expect(readConfig({ HUB_TOKEN: 'x', CLIENT_TOKEN: 'x' }, false).warnings).toHaveLength(1);
  });

  it.each(['0', '65536', 'abc', '80.5'])('refuses port %s', (HUB_PORT) => {
    expect(() => readConfig({ ...env, HUB_PORT }, false)).toThrow('HUB_PORT');
  });

  it('reads CLIENT_ORIGINS', () => {
    const { clientOrigins } = readConfig({ ...env, CLIENT_ORIGINS: ' http://hub.lan:8765/, https://x.example ,' }, false);
    expect(clientOrigins).toEqual(['http://hub.lan:8765', 'https://x.example']);
  });

  it.each(['hub.lan', '*', 'http://hub.lan/path', 'ftp://hub.lan'])('refuses the origin %s', (CLIENT_ORIGINS) => {
    expect(() => readConfig({ ...env, CLIENT_ORIGINS }, false)).toThrow('CLIENT_ORIGINS');
  });
});
