import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Bridge } from './server.js';
import { HUB_TOKEN, startBridge, TestSocket } from './testing.js';

let bridge: Bridge;
let webRoot: string;

beforeEach(async () => {
  webRoot = await mkdtemp(join(tmpdir(), 'deskhub-mobile-'));
  await writeFile(join(webRoot, 'index.html'), '<title>app</title>');
  await mkdir(join(webRoot, 'assets'));
  await writeFile(join(webRoot, 'assets', 'app-abc123.js'), '1');
  bridge = await startBridge({ webRoot });
});

afterEach(async () => {
  await bridge.close();
  await rm(webRoot, { recursive: true });
});

const url = (path: string) => `http://127.0.0.1:${bridge.port}${path}`;

/** Sends the path as it is; fetch() would clean it up. */
function rawStatus(path: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request({ port: bridge.port, host: '127.0.0.1', path }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('web app', () => {
  it('serves the build', async () => {
    const page = await fetch(url('/?token=abc'));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>app</title>');
    expect(page.headers.get('cache-control')).toBe('no-cache');
    const asset = await fetch(url('/assets/app-abc123.js'));
    expect(asset.headers.get('cache-control')).toContain('immutable');
  });

  it.each(['/nope', '/../package.json', '/..%2fpackage.json', '/%2e%2e/package.json', '/%', '//nope'])(
    'answers %s with a client error',
    async (path) => {
      const status = await rawStatus(path);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    },
  );

  it.each(['//', 'http://[', '/\\'])('survives the odd request target %s', async (path) => {
    await rawStatus(path);
    expect((await fetch(url('/'))).status).toBe(200);
  });

  it('answers "/" with a status below 500 when there is no build', async () => {
    const bare = await startBridge();
    const res = await fetch(`http://127.0.0.1:${bare.port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('pnpm build');
    await bare.close();
  });

  it('only takes GET and HEAD', async () => {
    expect((await fetch(url('/'), { method: 'HEAD' })).status).toBe(200);
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await fetch(url('/'), { method })).status).toBe(405);
    }
  });
});

describe('board endpoints', () => {
  it.each(['', '?token=wrong', `?token=${HUB_TOKEN}`])(
    'refuses a firmware upload (%s) so that deskhub-flash does not turn to USB',
    async (query) => {
      const body = new Uint8Array(2 * 1024 * 1024);
      const res = await fetch(url(`/firmware${query}`), { method: 'POST', body });
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain('token');
    },
  );

  it.each(['/screenshot', '/tap', '/perf'])('refuses %s without the token and does nothing with it', async (path) => {
    expect((await fetch(url(path))).status).toBe(403);
    expect((await fetch(url(`${path}?token=wrong`))).status).toBe(403);
    expect((await fetch(url(`${path}?token=${HUB_TOKEN}&x=1&y=1`))).status).toBe(501);
  });
});

describe('upgrade', () => {
  it.each(['/', '/nope', '/ws/', '//'])('refuses %s', async (path) => {
    await expect(new TestSocket(bridge.port, path).open()).rejects.toThrow();
    expect((await fetch(url('/'))).status).toBe(200);
  });
});
