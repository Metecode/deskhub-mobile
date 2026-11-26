import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RemindersMessage } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger, type Logger } from './log.js';
import { RemindersService } from './remindersService.js';

const REMINDERS = [
  {
    id: 'olcum',
    title: 'Kilo ve bel ölçümü',
    day: 'monday',
    fields: [
      { key: 'kg', label: 'Kilo', unit: 'kg' },
      { key: 'cm', label: 'Bel', unit: 'cm' },
    ],
  },
  { id: 'su', title: 'Bitkileri sula', day: 'thursday' },
];

let dir: string;
let now: Date;
let published: RemindersMessage[];

function service(log: Logger = silentLogger): RemindersService {
  return new RemindersService({
    file: join(dir, 'reminders.json'),
    dataDir: join(dir, 'data'),
    publish: (m) => published.push(m),
    log,
    now: () => now,
  });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reminders-'));
  await writeFile(join(dir, 'reminders.json'), JSON.stringify(REMINDERS), 'utf8');
  now = new Date(2026, 10, 30, 8); // a Monday
  published = [];
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('RemindersService', () => {
  it("shows today's reminders only", async () => {
    const s = service();
    await s.load();
    expect(s.message().reminders.map((r) => r.id)).toEqual(['olcum']);
    now = new Date(2026, 11, 3, 8); // Thursday
    expect(s.message().reminders).toMatchObject([{ id: 'su', fields: [], done: false, last: null }]);
    // Whatever the day, the measured ones.
    expect(s.message().measured).toEqual([{ id: 'olcum', title: 'Kilo ve bel ölçümü', fields: REMINDERS[0]!.fields }]);
  });

  it('saves an entry, marks it done and keeps it for the next start', async () => {
    const s = service();
    await s.load();
    expect(await s.save('olcum', { kg: 78.4, cm: 86 })).toBe(true);
    expect(published.at(-1)!.reminders[0]).toMatchObject({ done: true, last: { values: { kg: 78.4, cm: 86 } }, previous: null });

    now = new Date(2026, 11, 7, 8); // a week on
    const again = service();
    await again.load();
    expect(again.message().reminders[0]).toMatchObject({ done: false, last: { values: { kg: 78.4, cm: 86 } } });
    await again.save('olcum', { cm: 85, kg: 77.9 });
    expect(published.at(-1)!.reminders[0]).toMatchObject({ last: { values: { kg: 77.9, cm: 85 } }, previous: { values: { kg: 78.4 } } });
  });

  it('refuses an unknown reminder, or other fields', async () => {
    const s = service();
    await s.load();
    expect(await s.save('nope', { kg: 1 })).toBe(false);
    expect(await s.save('olcum', { kg: 1 })).toBe(false);
    expect(await s.save('olcum', { kg: 1, cm: 2, x: 3 })).toBe(false);
    await expect(readFile(join(dir, 'data', 'measurements.jsonl'), 'utf8')).rejects.toThrow();
  });

  it('gives the last half year for the chart', async () => {
    const s = service();
    await s.load();
    now = new Date(2026, 0, 5, 8);
    await s.save('olcum', { kg: 82, cm: 90 });
    now = new Date(2026, 10, 30, 8);
    await s.save('olcum', { kg: 78, cm: 86 });
    expect(s.measurements('olcum')).toEqual({
      type: 'bridge.measurements',
      id: 'olcum',
      fields: REMINDERS[0]!.fields,
      entries: [{ at: now.getTime(), values: { kg: 78, cm: 86 } }],
    });
    expect(s.measurements('nope')).toBeNull();
  });

  it('skips a torn line, and has none without the file', async () => {
    const s = service();
    await s.load();
    await s.save('olcum', { kg: 78, cm: 86 });
    await writeFile(join(dir, 'data', 'measurements.jsonl'), `${await readFile(join(dir, 'data', 'measurements.jsonl'), 'utf8')}{"id":"ol`, 'utf8');
    await s.load();
    expect(s.measurements('olcum')!.entries).toHaveLength(1);

    await rm(join(dir, 'reminders.json'));
    await s.load();
    expect(s.message().reminders).toEqual([]);
  });

  it('warns about a wrong file and has none', async () => {
    const warnings: string[] = [];
    await writeFile(join(dir, 'reminders.json'), JSON.stringify([{ id: 'X Y', title: '', day: 'someday' }]), 'utf8');
    const s = service({ info() {}, warn: (m) => warnings.push(m) });
    await s.load();
    expect(s.message().reminders).toEqual([]);
    expect(warnings[0]).toContain('reminders.example.json');
  });
});
