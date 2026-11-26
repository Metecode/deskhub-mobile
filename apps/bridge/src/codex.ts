// Codex CLI, signed in with the user's ChatGPT plan, writes the bulletin (docs/plan-phase6.md).
//
// It may only search the web: no shell, no ChatGPT apps (connectors), a read-only sandbox, and nothing
// kept. Every run is checked first, and Codex isn't run at all when it would be billed by the token.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { BulletinError } from '@deskhub-mobile/protocol';

/** The features turned off for every run. Each must show as off before Codex is run. */
export const DISABLED_FEATURES = ['shell_tool', 'apps'] as const;

const GLOBAL_FLAGS = ['--search', ...DISABLED_FEATURES.flatMap((name) => ['--disable', name])];

/** The arguments of a run; the prompt comes on stdin. */
export const runArgs = (outFile: string): string[] => [
  ...GLOBAL_FLAGS,
  'exec',
  '--ephemeral',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-o',
  outFile,
  '-',
];

/** Long enough for a thorough search; the trial took 2 minutes. */
export const RUN_TIMEOUT_MS = 15 * 60_000;
const CHECK_TIMEOUT_MS = 30_000;

export interface Spawned {
  code: number | null;
  output: string;
  timedOut: boolean;
}

/** Runs a program without a shell. Its output is returned, never logged. */
export type SpawnFn = (
  file: string,
  args: readonly string[],
  options: { cwd?: string; input?: string; timeoutMs: number; env: NodeJS.ProcessEnv },
) => Promise<Spawned>;

export const spawnProgram: SpawnFn = (file, args, { cwd, input, timeoutMs, env }) =>
  new Promise((resolve) => {
    const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    // Both streams: `login status` writes to stderr. Only the checks read it, and they are short.
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        if (output.length < 64_000) output += chunk;
      });
    }
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: null, output, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });

export interface FindOptions {
  env: NodeJS.ProcessEnv;
  exists?: (path: string) => boolean;
  list?: (dir: string) => string[];
}

const listDir = (dir: string): string[] => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

/** Compares "26.1120.50957" style versions by their numbers. */
function versionOf(folder: string): number[] {
  return (folder.match(/-(\d+(?:\.\d+)*)/)?.[1] ?? '0').split('.').map(Number);
}

function newer(a: string, b: string): number {
  const [x, y] = [versionOf(a), versionOf(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * CODEX_PATH, else codex.exe on the PATH, else the newest copy that comes with the VS Code extension (its
 * folder changes with every update). Only an .exe: a .cmd can't be run without a shell.
 */
export function findCodex({ env, exists = existsSync, list = listDir }: FindOptions): string | null {
  const given = env.CODEX_PATH?.trim();
  if (given) return exists(given) ? given : null;
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex';
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (dir && exists(join(dir, exe))) return join(dir, exe);
  }
  const home = env.USERPROFILE ?? env.HOME;
  if (!home) return null;
  const extensions = join(home, '.vscode', 'extensions');
  const folders = list(extensions)
    .filter((name) => name.startsWith('openai.chatgpt-'))
    .sort(newer)
    .reverse();
  for (const folder of folders) {
    const path = join(extensions, folder, 'bin', 'windows-x86_64', exe);
    if (exists(path)) return path;
  }
  return null;
}

/** What Codex is given: the environment without anything that would bill by the token. */
export function codexEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  delete out.OPENAI_API_KEY;
  delete out.CODEX_API_KEY;
  return out;
}

/** Which features `features list` shows as on, of those that must be off; unknown ones count as on. */
export function stillOn(featuresList: string): string[] {
  return DISABLED_FEATURES.filter((name) => {
    const line = featuresList.split(/\r?\n/).find((l) => l.trim().split(/\s+/)[0] === name);
    return !line || !/\sfalse\s*$/.test(line);
  });
}

/** Everything a run needs, checked. null: it may run. */
export async function checkCodex(path: string, env: NodeJS.ProcessEnv, run: SpawnFn): Promise<BulletinError | null> {
  if (env.OPENAI_API_KEY?.trim() || env.CODEX_API_KEY?.trim()) return 'api_key_set';
  const childEnv = codexEnv(env);
  const status = await run(path, ['login', 'status'], { timeoutMs: CHECK_TIMEOUT_MS, env: childEnv });
  if (status.code === null && !status.timedOut) return 'codex_missing';
  // "Logged in using ChatGPT"; with an API key it says so instead, and that would be billed.
  if (/api key/i.test(status.output)) return 'api_key_set';
  if (status.code !== 0 || !/ChatGPT/.test(status.output)) return 'codex_signed_out';
  const features = await run(path, [...GLOBAL_FLAGS.slice(1), 'features', 'list'], {
    timeoutMs: CHECK_TIMEOUT_MS,
    env: childEnv,
  });
  if (features.code !== 0 || stillOn(features.output).length) return 'unsafe_flags';
  return null;
}
