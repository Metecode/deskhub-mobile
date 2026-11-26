// The morning bulletin on the phone: its sections, what is read aloud, and how (docs/plan-phase6.md).
import type { BulletinMessage, Entry } from '@deskhub-mobile/protocol';
import { SAYABLE, T } from './text.js';

/** The local day, as the bridge writes it. */
export const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** There is a bulletin to show. */
export const hasBulletin = (b: BulletinMessage | null): b is BulletinMessage & { markdown: string } =>
  !!b && b.state !== 'off' && !!b.markdown;

/** Today's is there. */
export const bulletinIsToday = (b: BulletinMessage | null, nowMs: number): boolean =>
  hasBulletin(b) && b.date === dayOf(nowMs) && b.state !== 'running';

export interface Section {
  /** As the heading says it, without "0." and the like. */
  title: string;
  /** For an anchor. */
  id: string;
  /** Its text, heading left out. */
  body: string;
}

const stripNumber = (title: string) => title.replace(/^\d+[.)]\s*/, '').replace(/[*_`]/g, '').trim();

/** The id of a heading, the same for the chips and the page. */
export const sectionId = (title: string): string =>
  `b-${stripNumber(title)
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/g, '-')
    .replace(/^-|-$/g, '')}`;

/** The `## ` sections, in order. Text before the first one is left out. */
export function sectionsOf(markdown: string): Section[] {
  const out: Section[] = [];
  const parts = markdown.replace(/\r\n/g, '\n').split(/^##\s+(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const title = stripNumber(parts[i] ?? '');
    out.push({ title, id: sectionId(parts[i] ?? ''), body: (parts[i + 1] ?? '').trim() });
  }
  return out;
}

/**
 * The bulletin around its portfolio section, which the bridge's table takes the place of: the text before
 * it, the section's heading, and the text from its body on. null: there is none.
 */
export function splitAtPortfolio(markdown: string): { before: string; heading: string; after: string } | null {
  const found = /^##\s+(.*portföy.*)$/im.exec(markdown);
  if (!found) return null;
  return {
    before: markdown.slice(0, found.index),
    heading: found[1]!.trim(),
    after: markdown.slice(found.index + found[0].length),
  };
}

/** A short name for a chip: "Bir bakışta", "Piyasa tablosu" -> "Piyasa". */
export const chipName = (title: string): string => {
  const first = title.split(/[—–:(]/)[0]!.trim();
  const words = first.split(/\s+/);
  return words.length > 2 ? words.slice(0, 2).join(' ') : first;
};

/**
 * Codex doesn't always write the sections as `## ` headings: a line that is all bold and starts with a
 * number ("**2. Piyasa tablosu**") is one too.
 */
export const normalizeHeadings = (markdown: string): string =>
  markdown.replace(/^\*\*(\d+[.)]\s+[^*\n]+?)\*\*[ \t]*$/gm, '## $1');

/** The concrete step: the line that says "Somut adım", wherever it is, else the last line if it is in bold. */
export function closingLine(markdown: string): string {
  const lines = markdown.trim().split('\n').map((l) => l.trim());
  const step = lines.find((l) => /^\*{0,2}Somut adım:/i.test(l));
  const last = lines.at(-1) ?? '';
  const line = step ?? (/^\*\*.+\*\*$/.test(last) ? last : '');
  return line.replace(/\*\*/g, '').replace(/^Somut adım:\s*/i, '').trim();
}

/** Markdown as it would be said: no tables, code, links' addresses, price tags or marks. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, '')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line))
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
    .replace(/\[(?:kapanış|seans|vadeli|piyasa|spot|banka|teorik|beklenti|gösterge)[^\]]*\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** Written out for the voice: "−0,25" as "eksi 0,25", "%3" as "yüzde 3". */
export function sayable(text: string): string {
  let out = text;
  for (const [pattern, to] of SAYABLE) out = out.replace(pattern, to as string);
  return out.replace(/\s+/g, ' ').trim();
}

/** Sentences to read one by one; long texts stop half-way in some browsers. */
export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9"“])/))
    .map((s) => sayable(s))
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

export interface Reading {
  /** What the bar says is being read. */
  title: string;
  sentences: string[];
}

/** "Bir bakışta" and the top developments, whatever Codex calls them ("En önemli 3 gelişme", "... üç başlık"). */
const SHORT = [/bir bakışta/i, /önemli/i];
const SKIP_ALL = [/kaynaklar/i];

/** Short: "at a glance", the top developments and the concrete step. All: everything but the sources. */
export function readingOf(markdown: string, whole: boolean): Reading {
  const sections = sectionsOf(markdown).filter((s) =>
    whole ? !SKIP_ALL.some((p) => p.test(s.title)) : SHORT.some((p) => p.test(s.title)),
  );
  const parts = sections.flatMap((s) => [s.title, plainText(s.body)]);
  const step = closingLine(markdown);
  if (step && !whole) parts.push(step);
  return { title: whole ? T.speech.all : T.speech.short, sentences: sentences(parts.join('\n')) };
}

/** The change since the entry before, per field, with its sign: "−0,5 kg". */
export function changeOf(last: Entry | null, previous: Entry | null, key: string): number | null {
  const a = last?.values[key];
  const b = previous?.values[key];
  return a === undefined || b === undefined ? null : Math.round((a - b) * 10) / 10;
}

/** For each entry, the mean of the entries in the 4 weeks up to it. */
export function movingAverage(entries: readonly Entry[], key: string, windowMs = 28 * 24 * 3600_000): (number | null)[] {
  return entries.map((entry) => {
    const values = entries
      .filter((e) => e.at <= entry.at && e.at > entry.at - windowMs)
      .map((e) => e.values[key])
      .filter((v): v is number => typeof v === 'number');
    return values.length ? values.reduce((a, v) => a + v, 0) / values.length : null;
  });
}
