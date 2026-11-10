import { requireAdmin } from '../middleware/adminAuth';

jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

function run(token: string | undefined, headers: Record<string, string>) {
  if (token === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = token;

  const res: any = { statusCode: 0, status: jest.fn(function (this: any, c: number) { this.statusCode = c; return this; }), json: jest.fn() };
  const next = jest.fn();
  requireAdmin({ headers, method: 'POST', originalUrl: '/api/cleanup', ip: '127.0.0.1' } as any, res, next);
  return { status: res.statusCode, nextCalled: next.mock.calls.length === 1 };
}

describe('requireAdmin', () => {
  const original = process.env.ADMIN_TOKEN;
  afterAll(() => { process.env.ADMIN_TOKEN = original; });

  it('disables admin routes when ADMIN_TOKEN is not configured', () => {
    expect(run(undefined, { authorization: 'Bearer anything' })).toEqual({ status: 503, nextCalled: false });
  });

  it('rejects missing or wrong tokens', () => {
    expect(run('s3cret', {})).toEqual({ status: 401, nextCalled: false });
    expect(run('s3cret', { authorization: 'Bearer wrong' })).toEqual({ status: 401, nextCalled: false });
    expect(run('s3cret', { authorization: 'Bearer s3cret-but-longer' })).toEqual({ status: 401, nextCalled: false });
  });

  it('accepts a Bearer token or the X-Admin-Token header', () => {
    expect(run('s3cret', { authorization: 'Bearer s3cret' }).nextCalled).toBe(true);
    expect(run('s3cret', { 'x-admin-token': 's3cret' }).nextCalled).toBe(true);
  });
});
