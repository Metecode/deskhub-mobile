/**
 * Splits a request target. Unlike new URL() it can't throw, whatever a client
 * sends ("//" is enough to make new URL("//", base) throw).
 */
export function parseTarget(url = '/'): { pathname: string; params: URLSearchParams } {
  const q = url.indexOf('?');
  return q < 0
    ? { pathname: url, params: new URLSearchParams() }
    : { pathname: url.slice(0, q), params: new URLSearchParams(url.slice(q + 1)) };
}
