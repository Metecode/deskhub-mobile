import { describe, expect, it } from 'vitest';
import { cacheName, filesToKeep, handlingOf, oldCaches } from './rules.js';

const ORIGIN = 'http://192.168.1.20:8765';
const of = (url: string, mode = 'no-cors', method = 'GET') =>
  handlingOf({ method, mode, url: new URL(url, ORIGIN).href }, ORIGIN);

describe('handlingOf', () => {
  it('answers the page, however it was opened', () => {
    expect(of('/', 'navigate')).toBe('page');
    expect(of('/?token=secret', 'navigate')).toBe('page');
    expect(of('/?a=1#info', 'navigate')).toBe('page');
  });

  it('answers files with a hash from the copy', () => {
    expect(of('/assets/index-abc123.js')).toBe('asset');
    expect(of('/assets/inter-abc123.woff2', 'cors')).toBe('asset');
  });

  it.each(['/client', '/client?token=secret', '/ws', '/firmware', '/build.json', '/sw.js', '/icon-192.png', '/', '/?token=x'])(
    'leaves %s alone when it is not a page being opened',
    (url) => expect(of(url)).toBeNull(),
  );

  it.each(['/client', '/assets/index-abc123.js', '/other', '/screenshot'])('leaves %s alone as a page', (url) =>
    expect(of(url, 'navigate')).toBeNull(),
  );

  it('leaves addresses with a query alone', () => {
    expect(of('/assets/index-abc123.js?token=secret')).toBeNull();
  });

  it.each(['POST', 'PUT', 'DELETE', 'HEAD'])('leaves %s alone', (method) => {
    expect(of('/', 'navigate', method)).toBeNull();
    expect(of('/assets/index-abc123.js', 'no-cors', method)).toBeNull();
  });

  it('leaves other origins alone', () => {
    for (const url of ['https://api.open-meteo.com/v1/forecast', 'http://192.168.1.20:5173/', 'https://192.168.1.20:8765/']) {
      expect(of(url, 'navigate')).toBeNull();
      expect(of(new URL('/assets/a.js', url).href)).toBeNull();
    }
  });
});

describe('oldCaches', () => {
  it('only names this app and other builds', () => {
    expect(oldCaches([cacheName('a'), cacheName('b'), 'of another app'], 'b')).toEqual([cacheName('a')]);
  });
});

describe('filesToKeep', () => {
  it('keeps the page and the files with a hash', () => {
    expect(filesToKeep({ build: 'b', files: ['/assets/index-a1.js', '/assets/x_y-Z.woff2'] }, 'b')).toEqual([
      '/',
      '/assets/index-a1.js',
      '/assets/x_y-Z.woff2',
    ]);
  });

  it('keeps nothing else', () => {
    const files = ['/sw.js', '/client', 'https://example.com/assets/a.js', '/assets/../client', '/assets/a?token=x', 5];
    expect(filesToKeep({ build: 'b', files }, 'b')).toEqual(['/']);
  });

  it.each([null, {}, { build: 'a', files: [] }, { build: 'b' }, 'text'])('refuses %j', (manifest) => {
    expect(() => filesToKeep(manifest, 'b')).toThrow();
  });
});
