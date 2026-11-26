// Reads the user's sheet with a Google service account, read-only (docs/plan-phase6.md). No Google
// library: a JWT signed with Node's crypto, then two plain requests.
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Sheet } from './sheet.js';

export const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TIMEOUT_MS = 20_000;

/**
 * The tabs that the bulletin needs. Not Belgeler (account numbers, links to statements), nor Nakit ve
 * Döviz or Gelirler: Codex searches the web, so it sees no more than it needs.
 */
export const DEFAULT_TABS = ['Özet', 'Pozisyonlar', 'Alımlar', 'Altın Alımları', 'Kontrol'];

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export function parseKey(text: string): ServiceAccount {
  const key = JSON.parse(text) as Partial<ServiceAccount> & { type?: string };
  if (key.type !== 'service_account' || !key.client_email || !key.private_key)
    throw new Error('the key file is not a service account key (JSON)');
  return { client_email: key.client_email, private_key: key.private_key, token_uri: key.token_uri ?? 'https://oauth2.googleapis.com/token' };
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/** The signed request for a token. */
export function assertion(key: ServiceAccount, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: key.token_uri, iat, exp: iat + 3600 }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

export interface SheetsOptions {
  keyFile: string;
  sheetId: string;
  tabs?: readonly string[];
  fetch?: typeof fetch;
  now?: () => Date;
}

async function json(response: Response, what: string): Promise<unknown> {
  // Google's error text may name the sheet; only the status goes into the log.
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status}`);
  return response.json();
}

/** The sheet's tabs, as their values are shown (Turkish numbers stay "1.234,56"). Throws when it can't. */
export async function readGoogleSheet({
  keyFile,
  sheetId,
  tabs = DEFAULT_TABS,
  fetch: get = fetch,
  now = () => new Date(),
}: SheetsOptions): Promise<Sheet> {
  const key = parseKey(await readFile(keyFile, 'utf8'));
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);
  const token = (await json(
    await get(key.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assertion(key, now()) }),
      signal: signal(),
    }),
    'token',
  )) as { access_token?: string };
  if (!token.access_token) throw new Error('token: none in the answer');

  const ranges = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' });
  // A tab's name in A1 notation, quoted.
  for (const tab of tabs) ranges.append('ranges', `'${tab.replaceAll("'", "''")}'`);
  const values = (await json(
    await get(`${API}/${encodeURIComponent(sheetId)}/values:batchGet?${ranges}`, {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: signal(),
    }),
    'values',
  )) as { valueRanges?: { values?: unknown[][] }[] };

  return {
    readAt: now(),
    tabs: tabs.map((name, i) => ({
      name,
      rows: (values.valueRanges?.[i]?.values ?? []).map((row) => row.map((cell) => String(cell ?? ''))),
    })),
  };
}
