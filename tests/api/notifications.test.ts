import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notificationAPI } from '@/lib/api/notifications';
import { installBrowserSession, seedSession } from '../support/browser-session';
import fixture from '../../../tracevault-contracts/http/fixtures/notifications.json';
beforeEach(() => { installBrowserSession(); seedSession('access-one', null); });
afterEach(() => vi.unstubAllGlobals());
it('uses the canonical owned history and explicit false preference values', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: fixture.list }))).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { preferences: [], channels: [] } })));
  vi.stubGlobal('fetch', fetcher);
  const page = await notificationAPI.list('00000000-0000-4000-8000-000000000004');
  expect(page.notifications[0].body_text).toBe(fixture.list.notifications[0].body_text);
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer access-one');
  expect(fetcher.mock.calls[0][0]).toContain('before_id=00000000-0000-4000-8000-000000000004');
  await notificationAPI.savePreferences([{ type: 'WELCOME', email_enabled: false, push_enabled: false, sms_enabled: false }], new AbortController().signal);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(fixture.update);
});
it('keeps notification outages visible instead of inventing empty history', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } }), { status: 503 })));
  await expect(notificationAPI.list('')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});
it('registers a browser token only through the authenticated owned device route', async () => {
  const device = fixture.devices.devices[0];
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { device } })));
  vi.stubGlobal('fetch', fetcher);
  const result = await notificationAPI.registerDevice('provider-token', '웹 브라우저', new AbortController().signal);
  expect(result.device.id).toBe(device.id);
  expect(fetcher.mock.calls[0][0]).toContain('/api/v1/notifications/devices');
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer access-one');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ token: 'provider-token', platform: 'web', device_name: '웹 브라우저' });
});
