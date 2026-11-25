import { describe, expect, it } from 'vitest';
import { browserName, describeError, withoutToken } from './diagnostics.js';

describe('withoutToken', () => {
  it('hides tokens in addresses', () => {
    expect(withoutToken('failed: ws://h:8765/client?token=secret')).toBe('failed: ws://h:8765/client?token=...');
    expect(withoutToken('http://h/?a=1&token=s%20x&b=2#info')).toBe('http://h/?a=1&token=...&b=2#info');
  });

  it('leaves the rest alone', () => {
    expect(withoutToken('Unexpected token < in JSON')).toBe('Unexpected token < in JSON');
  });
});

describe('describeError', () => {
  it('takes anything that can be thrown', () => {
    expect(describeError(new TypeError('x is null'))).toBe('TypeError: x is null');
    expect(describeError('text')).toBe('text');
    expect(describeError(undefined)).toBe('undefined');
    expect(describeError(new Error('at /?token=secret'))).toBe('Error: at /?token=...');
  });
});

describe('browserName', () => {
  const chrome = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

  it('tells Chrome from those made of it', () => {
    expect(browserName(chrome)).toBe('Chrome 142');
    expect(browserName(chrome.replace('Chrome/', 'SamsungBrowser/29.0 Chrome/'))).toBe('SamsungBrowser 29 (Chrome 142)');
    expect(browserName(`${chrome} EdgA/141.0`)).toBe('EdgA 141 (Chrome 142)');
  });

  it('shows everything of another', () => {
    expect(browserName('Firefox/130')).toBe('Firefox/130');
  });
});
