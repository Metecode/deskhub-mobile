import { describe, expect, it } from 'vitest';
import { splitToken } from './token.js';

describe('splitToken', () => {
  it('takes the token out of the URL', () => {
    expect(splitToken('http://192.168.1.5:8765/?token=a%20b')).toEqual({ token: 'a b', clean: '/' });
  });

  it('leaves the rest of the URL alone', () => {
    expect(splitToken('http://h/x?a=1&token=t&b=2#c')).toEqual({ token: 't', clean: '/x?a=1&b=2#c' });
  });

  it('also cleans up an empty token', () => {
    expect(splitToken('http://h/?token=')).toEqual({ token: '', clean: '/' });
  });

  it('finds nothing without one', () => {
    expect(splitToken('http://h/?tokens=1')).toBeNull();
  });
});
