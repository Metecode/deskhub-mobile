import { describe, expect, it } from 'vitest';
import {
  bulletinIsToday,
  changeOf,
  chipName,
  closingLine,
  dayOf,
  movingAverage,
  plainText,
  readingOf,
  sayable,
  sectionId,
  sectionsOf,
  sentences,
} from './bulletin.js';

const MD = `# Sabah yatırım bülteni — 30 Kasım 2026
**Veri kesimi: 07:20 TSİ**

## 0. Bir bakışta

- **Kritik mesaj:** Fed tutanakları bu akşam.
- Günlük değişim: **+42,10 $**.

## 1. En önemli 3 gelişme

1. **Örnek A anlaşma duyurdu.** Olay: 27 Kas. [Duyuru](https://example.com/a)
2. Altın %0,3 yükseldi [spot 30 Kas 07:00 TSİ].

## 2. Piyasa tablosu

| Varlık | Son değer |
|---|---:|
| S&P 500 | 6.950,12 |

BIST 100 −0,72 düştü.

## Kaynaklar

- [A](https://example.com/a)

**Somut adım: Bugün işlem gerekmiyor.**`;

describe('sectionsOf', () => {
  it('splits at the ## headings, without their numbers', () => {
    expect(sectionsOf(MD).map((s) => s.title)).toEqual(['Bir bakışta', 'En önemli 3 gelişme', 'Piyasa tablosu', 'Kaynaklar']);
    expect(sectionsOf(MD)[0]!.id).toBe('b-bir-bakışta');
    expect(sectionId('2. Piyasa tablosu')).toBe('b-piyasa-tablosu');
  });

  it('gives chips short names', () => {
    expect(chipName('Piyasa tablosu')).toBe('Piyasa tablosu');
    expect(chipName('Takvim — TSİ')).toBe('Takvim');
    expect(chipName('En önemli 3 gelişme')).toBe('En önemli');
  });
});

describe('closingLine', () => {
  it('is the last line in bold, without "Somut adım"', () => {
    expect(closingLine(MD)).toBe('Bugün işlem gerekmiyor.');
    expect(closingLine('Metin\n\nson satır')).toBe('');
  });
});

describe('what is read aloud', () => {
  it('leaves out tables, addresses and price tags', () => {
    const text = plainText(sectionsOf(MD)[2]!.body + '\n' + sectionsOf(MD)[1]!.body);
    expect(text).not.toContain('|');
    expect(text).not.toContain('https');
    expect(text).not.toContain('spot 30 Kas');
    expect(text).toContain('Duyuru');
  });

  it('writes out signs, percentages, dollars and abbreviations', () => {
    expect(sayable('BIST 100 −0,72; altın %0,3; +42,10 $; 07:20 TSİ; K/Z')).toBe(
      'Borsa İstanbul 100 eksi 0,72; altın yüzde 0,3; artı 42,10 dolar; 07:20 Türkiye saati; kâr zarar',
    );
  });

  it('keeps a dash between words', () => {
    expect(sayable('ABD-Çin')).toBe('ABD-Çin');
  });

  it('reads sentence by sentence', () => {
    expect(sentences('Bir. İki! Üç 3,5 kez.\nDört')).toEqual(['Bir.', 'İki!', 'Üç 3,5 kez.', 'Dört']);
  });

  it('short: at a glance, the developments and the concrete step', () => {
    const { sentences: said } = readingOf(MD, false);
    expect(said[0]).toBe('Bir bakışta');
    expect(said).toContain('En önemli 3 gelişme');
    expect(said.at(-1)).toBe('Bugün işlem gerekmiyor.');
    expect(said.join(' ')).not.toContain('Piyasa tablosu');
  });

  it('all: everything but the sources', () => {
    const said = readingOf(MD, true).sentences.join(' ');
    expect(said).toContain('Piyasa tablosu');
    expect(said).toContain('Borsa İstanbul 100 eksi 0,72 düştü.');
    expect(said).not.toContain('Kaynaklar');
  });
});

describe('bulletinIsToday', () => {
  const now = new Date(2026, 10, 30, 8).getTime();
  it('is so only for a ready one of today', () => {
    expect(dayOf(now)).toBe('2026-11-30');
    expect(bulletinIsToday({ type: 'bridge.bulletin', state: 'ready', date: '2026-11-30', markdown: 'x' }, now)).toBe(true);
    expect(bulletinIsToday({ type: 'bridge.bulletin', state: 'ready', date: '2026-11-29', markdown: 'x' }, now)).toBe(false);
    expect(bulletinIsToday({ type: 'bridge.bulletin', state: 'running', date: '2026-11-30', markdown: 'x' }, now)).toBe(false);
    expect(bulletinIsToday(null, now)).toBe(false);
  });
});

describe('measurements', () => {
  const day = 24 * 3600_000;
  const e = (d: number, kg: number) => ({ at: d * day, values: { kg } });

  it('gives the change since the one before', () => {
    expect(changeOf(e(7, 77.9), e(0, 78.4), 'kg')).toBe(-0.5);
    expect(changeOf(e(7, 77.9), null, 'kg')).toBeNull();
  });

  it('averages the 4 weeks up to each entry', () => {
    const entries = [e(0, 80), e(7, 79), e(14, 78), e(21, 77), e(28, 76)];
    expect(movingAverage(entries, 'kg')).toEqual([80, 79.5, 79, 78.5, 77.5]);
  });
});

describe('splitAtPortfolio', () => {
  it("cuts the bulletin around its portfolio section, for the bridge's table", async () => {
    const { splitAtPortfolio } = await import('./bulletin.js');
    const split = splitAtPortfolio('## 2. Piyasa\nA\n\n## 3. Portföyüm\nYorum: B\n\n## 4. Hisseler\nC')!;
    expect(split.before).toBe('## 2. Piyasa\nA\n\n');
    expect(split.heading).toBe('3. Portföyüm');
    expect(split.after).toBe('\nYorum: B\n\n## 4. Hisseler\nC');
    expect(splitAtPortfolio('## Piyasa\nA')).toBeNull();
  });
});

describe('normalizeHeadings', () => {
  it('makes numbered lines all in bold into headings, and leaves other bold lines', async () => {
    const { normalizeHeadings } = await import('./bulletin.js');
    const md = normalizeHeadings(
      [
        '**26 Kasım — bülten**',
        '',
        '**0. Bir bakışta**',
        '',
        'ABD tatilde.',
        '',
        '**1. En önemli üç başlık**',
        '1. **Olay.** Açıklama.',
        '',
        '**Yorum:** bir.',
        '',
        '**Somut adım: Bugün işlem gerekmiyor.**',
        '',
        '## Kaynaklar',
        '- [A](https://a.example)',
      ].join('\n'),
    );
    expect(sectionsOf(md).map((s) => s.title)).toEqual(['Bir bakışta', 'En önemli üç başlık', 'Kaynaklar']);
    expect(md).toContain('**26 Kasım — bülten**');
    expect(md).toContain('**Yorum:** bir.');
    expect(closingLine(md)).toBe('Bugün işlem gerekmiyor.');
    const said = readingOf(md, false).sentences;
    expect(said[0]).toBe('Bir bakışta');
    expect(said).toContain('ABD tatilde.');
    expect(said.at(-1)).toBe('Bugün işlem gerekmiyor.');
  });
});
