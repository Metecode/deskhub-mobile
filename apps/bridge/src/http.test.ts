import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Bridge } from './server.js';
import { connectClient, HUB_TOKEN, startBridge, TestSocket } from './testing.js';

let bridge: Bridge;
let webRoot: string;

beforeEach(async () => {
  webRoot = await mkdtemp(join(tmpdir(), 'deskhub-mobile-'));
  await writeFile(join(webRoot, 'index.html'), '<title>app</title>');
  await mkdir(join(webRoot, 'assets'));
  await writeFile(join(webRoot, 'assets', 'app-abc123.js'), '1');
  await writeFile(join(webRoot, 'sw.js'), '2');
  await writeFile(join(webRoot, 'manifest.webmanifest'), '{}');
  await writeFile(join(webRoot, 'build.json'), '{"build":"one","files":[]}');
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

  it('serves the service worker and the manifest so that they are never kept', async () => {
    const worker = await fetch(url('/sw.js'));
    expect(worker.headers.get('content-type')).toContain('text/javascript');
    expect(worker.headers.get('cache-control')).toBe('no-cache');
    const manifest = await fetch(url('/manifest.webmanifest'));
    expect(manifest.headers.get('content-type')).toBe('application/manifest+json');
    expect(manifest.headers.get('cache-control')).toBe('no-cache');
  });

  it('sends headers alone for HEAD', async () => {
    const res = await fetch(url('/'), { method: 'HEAD' });
    expect(res.headers.get('content-length')).toBe('18');
    expect(await res.text()).toBe('');
  });

  describe('a new build', () => {
    const build = async (name: string) => {
      await rm(join(webRoot, 'build.json'), { force: true });
      await rm(join(webRoot, 'assets'), { recursive: true });
      await writeFile(join(webRoot, 'index.html'), `<title>${name}</title>`);
      await mkdir(join(webRoot, 'assets'));
      await writeFile(join(webRoot, 'assets', `app-${name}.js`), name);
    };
    const finish = (name: string) => writeFile(join(webRoot, 'build.json'), JSON.stringify({ build: name, files: [] }));
    const body = async (path: string) => (await fetch(url(path))).text();

    it('is served without a restart, once it is complete', async () => {
      expect(await body('/')).toContain('app');
      await build('two');
      expect(await body('/')).toContain('app');
      expect((await fetch(url('/assets/app-two.js'))).status).toBe(404);
      expect(await body('/assets/app-abc123.js')).toBe('1');
      await finish('two');
      expect(await body('/')).toContain('two');
      expect(await body('/assets/app-two.js')).toBe('two');
    });

    it('leaves the files of the one before for pages that are still open', async () => {
      expect(await body('/')).toContain('app');
      await build('two');
      await finish('two');
      expect(await body('/assets/app-abc123.js')).toBe('1');
      await build('three');
      await finish('three');
      expect(await body('/assets/app-two.js')).toBe('two');
      expect((await fetch(url('/assets/app-abc123.js'))).status).toBe(404);
    });

    it('changes nothing when it is broken', async () => {
      expect(await body('/')).toContain('app');
      for (const text of ['', '{', '{}', 'null']) {
        await writeFile(join(webRoot, 'build.json'), text);
        expect(await body('/')).toContain('app');
      }
    });

    it('is told to phones', async () => {
      const client = await connectClient(bridge);
      expect(await client.next()).toMatchObject({ type: 'bridge.snapshot', build: 'one' });
      await build('two');
      await finish('two');
      bridge.hub.touch();
      expect(await client.next()).toEqual({ type: 'bridge.status', pc_online: true, build: 'two' });
    });
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
