import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCodex, codexEnv, findCodex, runArgs, stillOn, type SpawnFn, type Spawned } from './codex.js';

const FEATURES_OFF = 'apps                stable   false\nshell_tool          stable   false\nbrowser_use   stable  true\n';

/** Answers `login status` and `features list` like Codex 0.171 does. */
function fakeCodex(login: string, features = FEATURES_OFF, calls: string[][] = []): SpawnFn {
  return async (_file, args): Promise<Spawned> => {
    calls.push([...args]);
    if (args.includes('login')) return { code: login ? 0 : 1, output: login, timedOut: false };
    if (args.includes('features')) return { code: 0, output: features, timedOut: false };
    return { code: 0, output: '', timedOut: false };
  };
}

describe('runArgs', () => {
  it('only searches the web: no shell, no apps, read-only, nothing kept', () => {
    expect(runArgs('out.md')).toEqual([
      '--search',
      '--disable',
      'shell_tool',
      '--disable',
      'apps',
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'read-only',
      '-o',
      'out.md',
      '-',
    ]);
  });
});

describe('findCodex', () => {
  const home = join('C:', 'Users', 'me');
  const ext = (version: string) =>
    join(home, '.vscode', 'extensions', `openai.chatgpt-${version}-win32-x64`, 'bin', 'windows-x86_64', 'codex.exe');

  it('takes CODEX_PATH when it is there', () => {
    expect(findCodex({ env: { CODEX_PATH: 'D:\\codex.exe' }, exists: () => true })).toBe('D:\\codex.exe');
    expect(findCodex({ env: { CODEX_PATH: 'D:\\codex.exe' }, exists: () => false })).toBeNull();
  });

  it("takes the newest copy of the VS Code extension's", () => {
    const there = new Set([ext('26.1120.50957'), ext('26.902.1'), ext('3.0.0')]);
    const found = findCodex({
      env: { USERPROFILE: home, PATH: '' },
      exists: (p) => there.has(p),
      list: () => ['openai.chatgpt-26.902.1-win32-x64', 'openai.chatgpt-26.1120.50957-win32-x64', 'openai.chatgpt-3.0.0-win32-x64', 'other.ext-1.0'],
    });
    expect(found).toBe(ext('26.1120.50957'));
  });

  it('is null when there is none', () => {
    expect(findCodex({ env: { USERPROFILE: home, PATH: '' }, exists: () => false, list: () => [] })).toBeNull();
  });
});

describe('stillOn', () => {
  it('is empty when both are off', () => {
    expect(stillOn(FEATURES_OFF)).toEqual([]);
  });

  it('names one that is on, or missing', () => {
    expect(stillOn('apps  stable  true\nshell_tool  stable  false')).toEqual(['apps']);
    expect(stillOn('shell_tool  stable  false')).toEqual(['apps']);
  });
});

describe('codexEnv', () => {
  it('leaves out API keys', () => {
    expect(codexEnv({ PATH: 'x', OPENAI_API_KEY: 'sk', CODEX_API_KEY: 'k' })).toEqual({ PATH: 'x' });
  });
});

describe('checkCodex', () => {
  it('passes when signed in with ChatGPT and both features are off', async () => {
    const calls: string[][] = [];
    expect(await checkCodex('codex', {}, fakeCodex('Logged in using ChatGPT\n', FEATURES_OFF, calls))).toBeNull();
    expect(calls[1]).toEqual(['--disable', 'shell_tool', '--disable', 'apps', 'features', 'list']);
  });

  it('refuses when an API key would be used', async () => {
    expect(await checkCodex('codex', { OPENAI_API_KEY: 'sk-x' }, fakeCodex('Logged in using ChatGPT'))).toBe('api_key_set');
    expect(await checkCodex('codex', {}, fakeCodex('Logged in using an API key - sk-***'))).toBe('api_key_set');
  });

  it('refuses when signed out', async () => {
    expect(await checkCodex('codex', {}, fakeCodex(''))).toBe('codex_signed_out');
  });

  it('refuses when a feature is still on', async () => {
    const on = 'apps  stable  true\nshell_tool  stable  false\n';
    expect(await checkCodex('codex', {}, fakeCodex('Logged in using ChatGPT', on))).toBe('unsafe_flags');
  });

  it("says so when it can't be started", async () => {
    const missing: SpawnFn = async () => ({ code: null, output: '', timedOut: false });
    expect(await checkCodex('codex', {}, missing)).toBe('codex_missing');
  });
});
