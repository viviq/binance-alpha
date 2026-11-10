import { parseTrustProxy } from '../utils/trustProxy';

describe('parseTrustProxy', () => {
  it('defaults to one hop in production and off elsewhere', () => {
    expect(parseTrustProxy(undefined, 'production')).toBe(1);
    expect(parseTrustProxy('', 'production')).toBe(1);
    expect(parseTrustProxy(undefined, 'development')).toBe(false);
  });

  it('parses booleans, hop counts and address lists', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false', 'production')).toBe(false);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
