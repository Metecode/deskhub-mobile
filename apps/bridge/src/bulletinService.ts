// Writes the day's bulletin once, when Desk Hub is first opened that day (docs/plan-phase6.md).
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  GRAM_GOLD,
  USDTRY,
  type BulletinError,
  type BulletinMessage,
  type Portfolio,
  type Price,
} from '@deskhub-mobile/protocol';
import { checkBulletin } from './bulletinCheck.js';
import { fullPrompt, parsePrompt, type PromptSettings } from './bulletinPrompt.js';
import { checkCodex, codexEnv, findCodex, RUN_TIMEOUT_MS, runArgs, spawnProgram, type SpawnFn } from './codex.js';
import type { Logger } from './log.js';
import { forPrompt, type Sheet } from './sheet.js';

/** Between two runs, and before the one retry. */
export const RETRY_MS = 10 * 60_000;
/** Bulletins kept. */
export const KEEP_DAYS = 14;
const CHECK_EVERY_MS = 60_000;

/** The day, local time. */
export const dayOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "06:00" as minutes after midnight. Throws with a message for the user. */
export function parseFrom(text: string): number {
  const found = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  if (!found) throw new Error(`BULLETIN_FROM: "${text}" is not a time like 06:00.`);
  return Number(found[1]) * 60 + Number(found[2]);
}

/** What the portfolio step gives; until there is one, nothing. */
export interface PortfolioMaker {
  /** The holdings in the sheet, for the prices that are needed. */
  holdings(sheet: Sheet, settings: PromptSettings): string[];
  make(sheet: Sheet, prices: readonly Price[], settings: PromptSettings): { portfolio: Portfolio; notes: BulletinMessage['notes'] };
}

export interface BulletinServiceOptions {
  promptFile: string;
  dataDir: string;
  /** Minutes after midnight, local time. */
  from: number;
  env: NodeJS.ProcessEnv;
  publish: (message: BulletinMessage) => void;
  log: Logger;
  spawn?: SpawnFn;
  findCodex?: (env: NodeJS.ProcessEnv) => string | null;
  readSheet?: () => Promise<Sheet | null>;
  portfolio?: PortfolioMaker;
  now?: () => Date;
}

/** What is saved next to the Markdown. */
type Saved = Omit<BulletinMessage, 'type' | 'state' | 'markdown' | 'error' | 'retryAt' | 'startedAt'>;

export class BulletinService {
  readonly #o: Required<Omit<BulletinServiceOptions, 'readSheet' | 'portfolio'>> &
    Pick<BulletinServiceOptions, 'readSheet' | 'portfolio'>;
  #message: BulletinMessage = { type: 'bridge.bulletin', state: 'off' };
  #running = false;
  #lastStart = -Infinity;
  /** Of today: failures, and whether the retry is waiting. */
  #failures = { day: '', count: 0 };
  #timer: NodeJS.Timeout | undefined;

  constructor(options: BulletinServiceOptions) {
    this.#o = {
      spawn: spawnProgram,
      findCodex: (env) => findCodex({ env }),
      now: () => new Date(),
      ...options,
    };
  }

  get message(): BulletinMessage {
    return this.#message;
  }

  get #bulletins(): string {
    return join(this.#o.dataDir, 'bulletin');
  }

  /** Shows the last bulletin there is, then checks every minute. Doesn't wait for a run. */
  async start(): Promise<void> {
    await this.#loadLast();
    this.#timer = setInterval(() => void this.maybeRun(), CHECK_EVERY_MS);
    void this.maybeRun();
  }

  stop(): void {
    clearInterval(this.#timer);
  }

  /** A phone connected: Desk Hub was opened. */
  opened(): void {
    void this.maybeRun();
  }

  /** "Try again" on a phone. */
  async runNow(): Promise<void> {
    if (this.#running || this.#o.now().getTime() - this.#lastStart < RETRY_MS) return;
    if (!(await this.#hasPrompt())) return this.#set({ type: 'bridge.bulletin', state: 'off' });
    await this.#run();
  }

  async maybeRun(): Promise<void> {
    if (this.#running) return;
    const now = this.#o.now();
    if (!(await this.#hasPrompt())) {
      if (this.#message.state !== 'off') this.#set({ type: 'bridge.bulletin', state: 'off' });
      return;
    }
    if (this.#message.state === 'off') await this.#loadLast();
    const today = dayOf(now);
    if (this.#message.state === 'ready' && this.#message.date === today) return;
    if (now.getHours() * 60 + now.getMinutes() < this.#o.from) return;
    if (this.#failures.day === today) {
      // One retry, 10 minutes on; after that only "Try again".
      if (this.#failures.count >= 2 || now.getTime() - this.#lastStart < RETRY_MS) return;
    }
    await this.#run();
  }

  async #hasPrompt(): Promise<boolean> {
    try {
      await readFile(this.#o.promptFile, { encoding: 'utf8', flag: 'r' });
      return true;
    } catch {
      return false;
    }
  }

  async #run(): Promise<void> {
    this.#running = true;
    const started = this.#o.now();
    this.#lastStart = started.getTime();
    const day = dayOf(started);
    this.#set({ ...this.#previous(), state: 'running', startedAt: started.getTime() });
    const ms = () => this.#o.now().getTime() - started.getTime();
    try {
      const error = await this.#write(day, started);
      if (error) {
        this.#fail(day, error);
        this.#o.log.warn(`bulletin: ${error} after ${Math.round(ms() / 1000)} s`);
      } else {
        this.#o.log.info(`bulletin: written in ${Math.round(ms() / 1000)} s`);
      }
    } catch (e) {
      this.#fail(day, 'failed');
      this.#o.log.warn(`bulletin: ${(e as Error).message}`);
    } finally {
      this.#running = false;
    }
  }

  /** Writes and publishes it; an error, or null. */
  async #write(day: string, started: Date): Promise<BulletinError | null> {
    const { env, log } = this.#o;
    let prompt;
    try {
      prompt = parsePrompt(await readFile(this.#o.promptFile, 'utf8'));
    } catch (e) {
      log.warn(`bulletin: ${(e as Error).message}`);
      return 'failed';
    }
    const codex = this.#o.findCodex(env);
    if (!codex) return 'codex_missing';
    const refused = await checkCodex(codex, env, this.#o.spawn);
    if (refused) return refused;

    let sheet: Sheet | null = null;
    try {
      sheet = (await this.#o.readSheet?.()) ?? null;
    } catch (e) {
      log.warn(`bulletin: the sheet couldn't be read: ${(e as Error).message}`);
    }
    const { settings } = prompt;
    let holdings = [...new Set([...settings.fallback, ...settings.stocks, ...settings.rewards])];
    if (sheet && this.#o.portfolio) {
      try {
        holdings = this.#o.portfolio.holdings(sheet, settings);
      } catch (e) {
        // A sheet that can't be made sense of is as one that can't be read.
        log.warn(`bulletin: ${(e as Error).message}`);
        sheet = null;
      }
    }
    const wanted = [...new Set([...holdings, ...settings.watch])];

    const work = join(this.#o.dataDir, 'codex-work');
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
    await mkdir(this.#bulletins, { recursive: true });
    const outFile = join(this.#bulletins, `${day}.out.md`);
    await rm(outFile, { force: true });

    const result = await this.#o.spawn(codex, runArgs(outFile), {
      cwd: work,
      input: fullPrompt(prompt, sheet ? forPrompt(sheet) : null, wanted),
      timeoutMs: RUN_TIMEOUT_MS,
      env: codexEnv(env),
    });
    if (result.timedOut) return 'timeout';
    if (result.code !== 0) return 'failed';
    let output = '';
    try {
      output = await readFile(outFile, 'utf8');
    } catch {
      // As empty.
    }
    await rm(outFile, { force: true });
    if (!output.trim()) return 'empty';

    const checked = checkBulletin(output, [...wanted, USDTRY, GRAM_GOLD], holdings, this.#o.now());
    const notes = [...checked.notes];
    // Only when there is one to read.
    if (!sheet && this.#o.readSheet) notes.unshift({ code: 'sheet_unreadable' });
    let portfolio: Portfolio | null = null;
    if (sheet && this.#o.portfolio) {
      try {
        const made = this.#o.portfolio.make(sheet, checked.prices, settings);
        portfolio = made.portfolio;
        notes.push(...(made.notes ?? []));
      } catch (e) {
        log.warn(`bulletin: ${(e as Error).message}`);
        notes.unshift({ code: 'sheet_unreadable' });
      }
    }
    const saved: Saved = {
      date: day,
      madeAt: this.#o.now().getTime(),
      portfolio,
      prices: checked.prices,
      sources: checked.sources,
      notes,
    };
    await writeFile(join(this.#bulletins, `${day}.md`), checked.markdown, 'utf8');
    await writeFile(join(this.#bulletins, `${day}.json`), JSON.stringify(saved), 'utf8');
    await this.#prune(started);
    this.#set({ type: 'bridge.bulletin', state: 'ready', ...saved, markdown: checked.markdown });
    return null;
  }

  #fail(day: string, error: BulletinError): void {
    this.#failures = { day, count: this.#failures.day === day ? this.#failures.count + 1 : 1 };
    this.#set({ ...this.#previous(), state: 'failed', error, retryAt: this.#lastStart + RETRY_MS });
  }

  /** The last bulletin's content, to keep showing while another is written or failed. */
  #previous(): BulletinMessage {
    const { type, date, madeAt, markdown, portfolio, prices, sources, notes } = this.#message;
    return { type, state: 'ready', date, madeAt, markdown, portfolio, prices, sources, notes };
  }

  async #loadLast(): Promise<void> {
    if (!(await this.#hasPrompt())) return;
    const days = (await readdir(this.#bulletins).catch(() => [] as string[]))
      .map((name) => /^(\d{4}-\d{2}-\d{2})\.md$/.exec(name)?.[1])
      .filter((d): d is string => !!d)
      .sort();
    const day = days.at(-1);
    if (!day) {
      this.#set({ type: 'bridge.bulletin', state: 'ready' });
      return;
    }
    try {
      const markdown = await readFile(join(this.#bulletins, `${day}.md`), 'utf8');
      const saved = JSON.parse(await readFile(join(this.#bulletins, `${day}.json`), 'utf8').catch(() => '{}')) as Saved;
      this.#set({ type: 'bridge.bulletin', state: 'ready', ...saved, date: day, markdown });
    } catch (e) {
      this.#o.log.warn(`bulletin: ${day} couldn't be read: ${(e as Error).message}`);
      this.#set({ type: 'bridge.bulletin', state: 'ready' });
    }
  }

  async #prune(now: Date): Promise<void> {
    const oldest = dayOf(new Date(now.getTime() - KEEP_DAYS * 24 * 3600_000));
    for (const name of await readdir(this.#bulletins).catch(() => [] as string[])) {
      const day = /^(\d{4}-\d{2}-\d{2})\./.exec(name)?.[1];
      if (day && day < oldest) await rm(join(this.#bulletins, name), { force: true });
    }
  }

  #set(message: BulletinMessage): void {
    this.#message = message;
    this.#o.publish(message);
  }
}
