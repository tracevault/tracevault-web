import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installBrowserSession, seedSession } from '../support/browser-session';
import { getSession } from '@/lib/auth';
import { browserLogin } from '@/lib/api/login';
import { twoFactorAPI } from '@/lib/api/two-factor';
import tokenSuccess from '../../../tracevault-contracts/http/fixtures/token-success.json';

beforeEach(() => installBrowserSession());
afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

it('passes either factor to public login and preserves the typed challenge without storing a session', async () => {
  const fetcher = vi.fn(async () => response({ success: false, error: { code: 'SECOND_FACTOR_REQUIRED', message: 'factor required' } }, 412));
  vi.stubGlobal('fetch', fetcher);
  for (const factor of [{}, { totp_code: '012345' }, { recovery_code: 'a'.repeat(32) }]) {
    await expect(browserLogin({ email: 'a@example.test', password: 'Password123!', ...factor })).rejects.toMatchObject({ code: 'SECOND_FACTOR_REQUIRED' });
    expect(JSON.parse((fetcher.mock.calls.at(-1)! as unknown as [string, RequestInit])[1].body as string)).toMatchObject(factor);
    expect(getSession()).toBeNull();
  }
});

it.each([false, true])('does not replay rejected proof or revoke the session after credential error (initial refresh %s)', async expired => {
  seedSession(expired ? 'expired' : 'valid', 'refresh-one', 'factor-owner');
  let calls = 0;
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/auth/refresh')) return response(tokenSuccess);
    if (new Headers(init.headers).get('Authorization') === 'Bearer expired') return response({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
    calls++;
    expect(JSON.parse(init.body as string)).toEqual({ current_password: 'Password123!', recovery_code: 'a'.repeat(32) });
    expect(init.cache).toBe('no-store');
    return response({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'incorrect factor' } }, 401);
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(twoFactorAPI.regenerate({ current_password: 'Password123!', recovery_code: 'a'.repeat(32) })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  expect(calls).toBe(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(expired ? 1 : 0);
  expect(getSession()?.id).toBe('factor-owner');
});

it('returns codes only to the caller, and does not cache them in browser persistence', async () => {
  seedSession('valid', 'refresh', 'owner');
  const codes = Array.from({ length: 10 }, (_, i) => i.toString(16).padStart(32, '0'));
  const fetcher = vi.fn(async () => response({ success: true, data: { recovery_codes: codes, sessions_revoked: true } }));
  vi.stubGlobal('fetch', fetcher);
  await expect(twoFactorAPI.enable({ current_password: 'Password123!', factor_id: '11111111-1111-4111-8111-111111111111', totp_code: '012345' })).resolves.toEqual({ recovery_codes: codes, sessions_revoked: true });
  expect(getSession()).toMatchObject({ accessToken: 'valid', refreshToken: 'refresh', id: 'owner' });
});
