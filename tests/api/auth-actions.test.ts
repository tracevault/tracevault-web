import { afterEach, expect, it, vi } from 'vitest';
import { readActionFragment } from '@/lib/auth/action-link';
import { authActionsAPI } from '@/lib/api/auth-actions';
import { installBrowserSession, seedSession } from '../support/browser-session';

afterEach(() => vi.unstubAllGlobals());
const link = { action_id: '12345678-1234-1234-1234-123456789001', token: 'A'.repeat(43) };
it('reads only a single canonical fragment pair without consuming an action', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const fragment = new URLSearchParams(link).toString();
  expect(readActionFragment(new URL(`https://example.test/reset-password#${fragment}`))).toEqual(link);
  for (const suffix of [`?${fragment}`, `?source=email#${fragment}`, `#${fragment}&token=${link.token}`, `#${fragment}&extra=1`, `#action_id=${link.action_id}&token=${'B'.repeat(43)}`, '#action_id=invalid&token=A']) {
    expect(readActionFragment(new URL(`https://example.test/reset-password${suffix}`))).toBeNull();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('puts secrets only in explicit POST bodies and never sends current credentials on public completion', async () => {
  installBrowserSession(); seedSession('current-access', 'current-refresh', 'current');
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: { success: true, accepted: true } }), { status: 200 })));
  vi.stubGlobal('fetch', fetch);
  await authActionsAPI.verify(link);
  await authActionsAPI.reset(link, 'Replacement123!');
  await authActionsAPI.requestReset('owner@example.test');
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).not.toContain(link.token);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  }
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(link);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ ...link, new_password: 'Replacement123!' });
  await authActionsAPI.requestVerification();
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({});
  expect(new Headers(fetch.mock.calls[3][1].headers).get('Authorization')).toBe('Bearer current-access');
});
