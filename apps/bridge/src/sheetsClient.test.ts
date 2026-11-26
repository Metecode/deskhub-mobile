import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertion, parseKey, readGoogleSheet, SCOPE } from './sheetsClient.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY = {
  type: 'service_account',
  client_email: 'bulletin@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  token_uri: 'https://oauth2.example/token',
};
const NOW = new Date('2026-11-30T05:00:00Z');

let dir: string;
let keyFile: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sheets-'));
  keyFile = join(dir, 'key.json');
  await writeFile(keyFile, JSON.stringify(KEY), 'utf8');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('assertion', () => {
  it('is a JWT signed with the key, read-only, for an hour', () => {
    const [header, claims, signature] = assertion(parseKey(JSON.stringify(KEY)), NOW).split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toEqual({
      iss: KEY.client_email,
      scope: SCOPE,
      aud: KEY.token_uri,
      iat: 1796014800,
      exp: 1796018400,
    });
    expect(SCOPE).toMatch(/spreadsheets\.readonly$/);
    const valid = createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'));
    expect(valid).toBe(true);
  });
});

describe('parseKey', () => {
  it('takes a service account key only', () => {
    expect(() => parseKey(JSON.stringify({ type: 'authorized_user' }))).toThrow('service account');
  });
});

describe('readGoogleSheet', () => {
  it('gets a token, then the tabs asked for as they are shown', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url) === KEY.token_uri) return Response.json({ access_token: 'tok', expires_in: 3600 });
      return Response.json({ valueRanges: [{ values: [['Sembol', 'Adet 13.11.2026 dahil'], ['ETF1', '1,5']] }, {}] });
    }) as typeof fetch;

    const sheet = await readGoogleSheet({ keyFile, sheetId: 'SHEET-ID', tabs: ['Pozisyonlar', "Bob's"], fetch: fake, now: () => NOW });

    expect(String(calls[0]!.init?.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    const values = new URL(calls[1]!.url);
    expect(values.pathname).toBe('/v4/spreadsheets/SHEET-ID/values:batchGet');
    expect(values.searchParams.getAll('ranges')).toEqual(["'Pozisyonlar'", "'Bob''s'"]);
    expect(values.searchParams.get('valueRenderOption')).toBe('FORMATTED_VALUE');
    expect((calls[1]!.init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(sheet).toEqual({
      readAt: NOW,
      tabs: [
        { name: 'Pozisyonlar', rows: [['Sembol', 'Adet 13.11.2026 dahil'], ['ETF1', '1,5']] },
        { name: "Bob's", rows: [] },
      ],
    });
  });

  it('says only the status when Google refuses', async () => {
    const refuse = (async () => new Response('{"error":"the sheet named X"}', { status: 403 })) as typeof fetch;
    await expect(readGoogleSheet({ keyFile, sheetId: 'S', fetch: refuse, now: () => NOW })).rejects.toThrow(/^token: HTTP 403$/);
  });
});
