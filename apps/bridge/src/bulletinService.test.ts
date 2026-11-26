import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BulletinMessage } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BulletinService, KEEP_DAYS, parseFrom, RETRY_MS } from './bulletinService.js';
import type { SpawnFn } from './codex.js';
import { silentLogger } from './log.js';

const OUTPUT = `# Sabah bülteni

## 0. Bir bakışta
- Örnek.

## Kaynaklar
- [A](https://a.example/)

\`\`\`prices
{"ticker":"ETF1","price":10,"previous_close":9,"currency":"USD","kind":"close","at":"2026-11-27T13:00:00-05:00","source":"https://a.example/"}
\`\`\`
`;

let dir: string;
let now: Date;
let published: BulletinMessage[];
let runs: { input: string; env: NodeJS.ProcessEnv }[];
let answer: 'ok' | 'fail' | 'timeout';

/** Codex as the service sees it: the checks pass, a run writes OUTPUT to the -o file. */
const spawn: SpawnFn = async (_file, args, { input, env }) => {
  if (args.includes('login')) return { code: 0, output: 'Logged in using ChatGPT', timedOut: false };
  if (args.includes('features'))
    return { code: 0, output: 'apps  stable  false\nshell_tool  stable  false', timedOut: false };
  runs.push({ input: input ?? '', env });
  if (answer === 'timeout') return { code: null, output: '', timedOut: true };
  if (answer === 'fail') return { code: 1, output: '', timedOut: false };
  const out = args[args.indexOf('-o') + 1] ?? '';
  await writeFile(out, OUTPUT, 'utf8');
  return { code: 0, output: '', timedOut: false };
};

function service(env: NodeJS.ProcessEnv = {}): BulletinService {
  return new BulletinService({
    promptFile: join(dir, 'bulletin.prompt.md'),
    dataDir: join(dir, 'data'),
    from: parseFrom('06:00'),
    env,
    publish: (message) => published.push(message),
    log: silentLogger,
    spawn,
    findCodex: () => 'codex.exe',
    now: () => now,
  });
}

const last = () => published.at(-1);
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bulletin-'));
  await writeFile(join(dir, 'bulletin.prompt.md'), '---\nfallback: ETF1\n---\nRolün: örnek.\n', 'utf8');
  now = local(30, 8);
  published = [];
  runs = [];
  answer = 'ok';
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('BulletinService', () => {
  it('writes the day’s bulletin once, on the first opening', async () => {
    const s = service();
    await s.maybeRun();
    expect(runs).toHaveLength(1);
    // Set up but empty, then the run.
    expect(published.map((m) => [m.state, !!m.markdown])).toEqual([
      ['ready', false],
      ['running', false],
      ['ready', true],
    ]);
    const ready = last()!;
    expect(ready.date).toBe('2026-11-30');
    expect(ready.markdown).toContain('Bir bakışta');
    expect(ready.markdown).not.toContain('```prices');
    expect(ready.prices?.map((p) => p.ticker)).toEqual(['ETF1']);
    // No sheet set up: no note about it.
    expect(ready.notes).toEqual([]);
    expect(runs[0]!.input).toContain('Rolün: örnek.');
    expect(runs[0]!.input).not.toContain('fallback:');

    await s.maybeRun();
    expect(runs).toHaveLength(1);
  });

  it('waits until BULLETIN_FROM', async () => {
    now = local(30, 5, 59);
    await service().maybeRun();
    expect(runs).toHaveLength(0);
  });

  it('is off without a prompt file', async () => {
    await rm(join(dir, 'bulletin.prompt.md'));
    const s = service();
    await s.maybeRun();
    expect(runs).toHaveLength(0);
    expect(s.message.state).toBe('off');
  });

  it('keeps it for the next start', async () => {
    await service().maybeRun();
    published = [];
    const again = service();
    await again.start();
    again.stop();
    expect(runs).toHaveLength(1);
    expect(again.message).toMatchObject({ state: 'ready', date: '2026-11-30', prices: [{ ticker: 'ETF1' }] });
  });

  it('retries once after 10 minutes, then waits for "Try again"', async () => {
    answer = 'fail';
    const s = service();
    await s.maybeRun();
    expect(last()).toMatchObject({ state: 'failed', error: 'failed', retryAt: now.getTime() + RETRY_MS });

    now = new Date(now.getTime() + RETRY_MS - 1000);
    await s.maybeRun();
    expect(runs).toHaveLength(1);

    now = new Date(now.getTime() + 1000);
    answer = 'timeout';
    await s.maybeRun();
    expect(runs).toHaveLength(2);
    expect(last()).toMatchObject({ state: 'failed', error: 'timeout' });

    now = new Date(now.getTime() + 2 * RETRY_MS);
    await s.maybeRun();
    expect(runs).toHaveLength(2);

    answer = 'ok';
    await s.runNow();
    expect(runs).toHaveLength(3);
    expect(last()?.state).toBe('ready');
  });

  it('lets "Try again" run only 10 minutes after the last start', async () => {
    const s = service();
    await s.maybeRun();
    await s.runNow();
    expect(runs).toHaveLength(1);
    now = new Date(now.getTime() + RETRY_MS);
    await s.runNow();
    expect(runs).toHaveLength(2);
  });

  it('keeps showing the last bulletin while it writes or fails', async () => {
    const s = service();
    await s.maybeRun();
    now = new Date(2026, 11, 1, 8);
    answer = 'fail';
    await s.maybeRun();
    const running = published.at(-2)!;
    expect(running).toMatchObject({ state: 'running', date: '2026-11-30' });
    expect(running.markdown).toContain('Bir bakışta');
    expect(last()).toMatchObject({ state: 'failed', date: '2026-11-30', error: 'failed' });
  });

  it('never runs with an API key set', async () => {
    const s = service({ OPENAI_API_KEY: 'sk-x' });
    await s.maybeRun();
    expect(runs).toHaveLength(0);
    expect(last()).toMatchObject({ state: 'failed', error: 'api_key_set' });
  });

  it(`keeps ${KEEP_DAYS} days`, async () => {
    const bulletins = join(dir, 'data', 'bulletin');
    const s = service();
    await s.maybeRun();
    await writeFile(join(bulletins, '2026-11-01.md'), 'old', 'utf8');
    await writeFile(join(bulletins, '2026-11-01.json'), '{}', 'utf8');
    await writeFile(join(bulletins, '2026-11-20.md'), 'kept', 'utf8');
    now = new Date(2026, 11, 1, 8);
    await s.maybeRun();
    expect((await readdir(bulletins)).sort()).toEqual([
      '2026-11-20.md',
      '2026-11-30.json',
      '2026-11-30.md',
      '2026-12-01.json',
      '2026-12-01.md',
    ]);
  });
});

describe('BulletinService with a sheet', () => {
  it('still writes the bulletin, with a note, when the sheet can’t be read', async () => {
    const s = new BulletinService({
      promptFile: join(dir, 'bulletin.prompt.md'),
      dataDir: join(dir, 'data'),
      from: 0,
      env: {},
      publish: (message) => published.push(message),
      log: silentLogger,
      spawn,
      findCodex: () => 'codex.exe',
      readSheet: async () => {
        throw new Error('token: HTTP 403');
      },
      now: () => now,
    });
    await s.maybeRun();
    expect(last()).toMatchObject({ state: 'ready', notes: [{ code: 'sheet_unreadable' }] });
    expect(runs[0]!.input).toContain('Portföy dosyası okunamadı');
  });
});
