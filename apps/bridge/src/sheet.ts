// The user's spreadsheet as the bridge holds it: tabs of rows of text, as the Sheets API gives them.
import type { SheetForPrompt } from './bulletinPrompt.js';

export interface Sheet {
  tabs: { name: string; rows: string[][] }[];
  readAt: Date;
}

const cell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

export const toCsv = (rows: readonly (readonly string[])[]): string => rows.map((row) => row.map(cell).join(',')).join('\n');

export const forPrompt = (sheet: Sheet): SheetForPrompt => ({
  tabs: sheet.tabs.map((tab) => ({ name: tab.name, csv: toCsv(tab.rows) })),
  readAt: sheet.readAt,
});
