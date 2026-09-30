import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installBrowserSession, seedSession } from '../support/browser-session';
import { clearTokens } from '@/lib/auth';
import { CLIENT_KEY, getLoginClientID } from '@/lib/auth/client-recognition';
import { browserLogin } from '@/lib/api/login';

beforeEach(() => installBrowserSession());
afterEach(() => vi.unstubAllGlobals());

it('shares recognition across concurrent modules and retains it through logout/account changes', async () => {
  const other = await import('@/lib/auth/client-recognition');
  const ids = await Promise.all([getLoginClientID(), other.getLoginClientID(), getLoginClientID()]);
  expect(new Set(ids).size).toBe(1);
  expect(ids[0]).toMatch(/^[0-9a-f-]{14}4[0-9a-f-]{21}$/);
  seedSession('a', 'r', 'alice'); await clearTokens('alice');
  expect(await getLoginClientID()).toBe(ids[0]);
  seedSession('b', 'r2', 'bob');
  expect(await getLoginClientID()).toBe(ids[0]);
  localStorage.clear();
  expect(await getLoginClientID()).not.toBe(ids[0]);
});

it('replaces malformed saved identifiers and omits unavailable recognition', async () => {
  localStorage.setItem(CLIENT_KEY, '00000000-0000-0000-0000-000000000000');
  expect(await getLoginClientID()).not.toBe('00000000-0000-0000-0000-000000000000');
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
  expect(await getLoginClientID()).toBeUndefined();
});

it('actual login transport supplies origin identifier, never caller-supplied recognition', async () => {
  const id = await getLoginClientID();
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: { access_token:'a',refresh_token:'r',user:{id:'fixture'} } }), {status:200})));
  vi.stubGlobal('fetch', fetch);
  await browserLogin({email:'a@example.test',password:'Password123!',...{client_id:'caller-value'}});
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:'a@example.test',password:'Password123!',client_id:id});
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
  await browserLogin({email:'a@example.test',password:'Password123!'});
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({email:'a@example.test',password:'Password123!'});
});
