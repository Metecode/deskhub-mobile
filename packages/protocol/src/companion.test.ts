import { describe, expect, it } from 'vitest';
import { parseCompanionMessage, parseMessage, TYPES_WITHOUT_SCHEMA } from './companion.js';
import { normalizeStats } from './stats.js';

// The message Stats.sample() builds on a PC with an NVIDIA GPU.
const SAMPLE = {
  type: 'stats',
  cpu: 30.2,
  ram_used: 18.41,
  ram_total: 31.9,
  net_down: 1843.2,
  net_up: 220.5,
  disk: 58.1,
  cpu_name: 'AMD Ryzen 7 7800X3D 8-Core',
  gpu_name: 'GeForce RTX 4070',
  gpu: 48,
  gpu_temp: 52,
  vram_used: 6.21,
  vram_total: 12,
};

const { gpu, gpu_temp, vram_used, vram_total, ...NO_GPU } = { ...SAMPLE, gpu_name: '' };

describe('parseCompanionMessage', () => {
  it('knows stats, with and without a GPU', () => {
    expect(parseCompanionMessage(JSON.stringify(SAMPLE))).toEqual({
      kind: 'known',
      type: 'stats',
      message: SAMPLE,
      raw: SAMPLE,
    });
    expect(parseMessage(NO_GPU).kind).toBe('known');
    expect(parseMessage({ ...NO_GPU, gpu: null }).kind).toBe('known');
    expect(parseMessage({ type: 'stats' }).kind).toBe('known');
  });

  it('keeps fields it does not know', () => {
    expect(parseMessage({ ...SAMPLE, fan_rpm: 900 })).toMatchObject({ kind: 'known', message: { fan_rpm: 900 } });
  });

  it('knows hello, hello_ok and ping', () => {
    for (const m of [{ type: 'hello', token: 't' }, { type: 'hello' }, { type: 'hello_ok', version: '0.1.0' }, { type: 'ping' }])
      expect(parseMessage(m)).toMatchObject({ kind: 'known', type: m.type });
  });

  it('keeps the raw message when a schema does not fit', () => {
    const raw = { ...SAMPLE, cpu: 'busy' };
    const parsed = parseMessage(raw);
    expect(parsed).toMatchObject({ kind: 'mismatch', type: 'stats', raw });
    expect(parsed.kind === 'mismatch' && parsed.issues).toContain('cpu');
  });

  it('passes unknown types through untouched', () => {
    const raw = { type: 'weather_v9', nested: { a: [1, 2] } };
    expect(parseCompanionMessage(JSON.stringify(raw))).toEqual({ kind: 'unknown', type: 'weather_v9', raw });
  });

  it('treats the types without a schema as unknown', () => {
    expect(TYPES_WITHOUT_SCHEMA).toContain('printer');
    for (const type of TYPES_WITHOUT_SCHEMA) expect(parseMessage({ type })).toMatchObject({ kind: 'unknown', type });
  });

  it.each(['__proto__', 'constructor', 'toString'])('does not trip over the type %s', (type) => {
    expect(parseMessage({ type }).kind).toBe('unknown');
  });

  it.each([{}, { type: 3 }, [], null, 1, 'stats'])('has no type for %j', (value) => {
    expect(parseMessage(value)).toMatchObject({ kind: 'unknown', type: '' });
  });

  it.each(['', 'nope', '{"type":'])('reports %j as invalid', (text) => {
    expect(parseCompanionMessage(text)).toEqual({ kind: 'invalid' });
  });
});

describe('normalizeStats', () => {
  it('reads what the companion sends', () => {
    expect(normalizeStats(SAMPLE)).toEqual({
      cpu: 30.2,
      cpuTemp: null,
      ramUsed: 18.41,
      ramTotal: 31.9,
      gpu: 48,
      gpuTemp: 52,
      vramUsed: 6.21,
      vramTotal: 12,
      netDown: 1843.2,
      netUp: 220.5,
      disk: 58.1,
      cpuName: 'AMD Ryzen 7 7800X3D 8-Core',
      gpuName: 'GeForce RTX 4070',
    });
  });

  it('has no GPU when the fields are left out or null', () => {
    const none = { gpu: null, gpuTemp: null, vramUsed: 0, vramTotal: 0 };
    expect(normalizeStats(NO_GPU)).toMatchObject(none);
    expect(normalizeStats({ ...NO_GPU, gpu: null, gpu_temp: null })).toMatchObject(none);
  });

  it('tells a GPU at 0% from no GPU', () => {
    expect(normalizeStats({ ...SAMPLE, gpu: 0 }).gpu).toBe(0);
  });

  it('falls back like the board on mistyped fields', () => {
    expect(normalizeStats({ type: 'stats', cpu: '30', gpu: 'busy', disk: null, cpu_name: 7 })).toMatchObject({
      cpu: 0,
      gpu: null,
      disk: 0,
      cpuName: '',
    });
  });

  it('reads temperatures, with negative ones unknown', () => {
    expect(normalizeStats({ type: 'stats', cpu_temp: 61.5, gpu_temp: -1 })).toMatchObject({
      cpuTemp: 61.5,
      gpuTemp: null,
    });
    expect(normalizeStats({ type: 'stats', cpu_temp: 0 }).cpuTemp).toBe(0);
  });

  it('does not cut long names to the size of the board buffers', () => {
    expect(normalizeStats({ type: 'stats', cpu_name: 'x'.repeat(90) }).cpuName).toHaveLength(90);
  });
});
