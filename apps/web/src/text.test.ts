import { describe, expect, it } from 'vitest';
import { alertText, formatNumber, libraryText, monthDay, monthName, percent, printerError, printerSpeed } from './text.js';

describe('numbers', () => {
  it('are written as in Turkish', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatNumber(1.25, 1)).toBe('1,3');
    expect(formatNumber(2, 1)).toBe('2,0');
    expect(percent(38)).toBe('%38');
  });
});

describe('what the companion says in English', () => {
  it.each([
    ['Claude needs your permission to use Bash', 'Claude Bash için izin istiyor'],
    ['Claude needs your permission', 'Claude izin istiyor'],
    ['Claude is waiting for you', 'Claude seni bekliyor'],
    ['Claude is waiting for your input', 'Claude yanıtını bekliyor'],
    ['Finished. Waiting for your reply', 'Bitti, yanıtını bekliyor'],
    ['Claude has something new to say', 'Claude has something new to say'],
    ['', ''],
  ])('%s', (text, turkish) => expect(alertText(text)).toBe(turkish));

  it('months', () => {
    expect(['Jan', 'Dec', 'Xyz', 'toString'].map(monthName)).toEqual(['Oca', 'Ara', 'Xyz', 'toString']);
    expect(['Nov 16', 'Feb 1', 'Nov', '', 'Xyz 1'].map(monthDay)).toEqual(['16 Kas', '1 Şub', 'Nov', '', 'Xyz 1']);
  });

  it('printers', () => {
    expect(['Silent', 'Ludicrous', '100%', 'Warp', ''].map(printerSpeed)).toEqual(['Sessiz', 'Çılgın', '%100', 'Warp', '']);
    expect(printerError('Error 0300-0100')).toBe('Hata 0300-0100');
    expect(printerError('Error: lid open')).toBe('Error: lid open');
  });

  it('libraries', () => {
    expect(libraryText('312 movies, 45 shows, 2,104 episodes')).toBe('312 film, 45 dizi, 2.104 bölüm');
    expect(libraryText('1 movie, 1 song')).toBe('1 film, 1 şarkı');
    expect(libraryText('something else')).toBe('something else');
  });
});

describe('components', () => {
  const sources = import.meta.glob<string>('./{pages,components}/*.tsx', { query: '?raw', import: 'default', eager: true });
  const files = Object.keys(sources);

  it('are found', () => expect(files.length).toBeGreaterThan(20));

  it.each(files)('%s has no text of its own', (file) => {
    const source = sources[file]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // Between tags, and in the attributes that are read out.
    const texts = [...source.matchAll(/(?<![=-])>\s*([^<>{}()=;]*\p{L}{2,}[^<>{}()=;]*)\s*<\/?[a-zA-Z]/gu)].map((m) => m[1]!.trim());
    const attributes = [...source.matchAll(/\b(?:aria-label|title|hint|placeholder|alt)="([^"]+)"/g)].map((m) => m[1]!);
    expect([...texts, ...attributes]).toEqual([]);
  });
});
