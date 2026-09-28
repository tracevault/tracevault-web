import { beforeEach, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { QueryClient } from '@tanstack/react-query';
import { installBrowserSession, seedSession } from '../support/browser-session';
import { getSession, startSession, clearTokens, SESSION_KEY, withSessionLock, writeSessionLocked } from '@/lib/auth';
import { observeAuthSession } from '@/lib/auth/lifecycle';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, apiFile, logoutSession } from '@/lib/api/client';
import tokenSuccess from '../../../tracevault-contracts/http/fixtures/token-success.json';

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data }), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.unstubAllGlobals();
  installBrowserSession();
  vi.stubGlobal('crypto', webcrypto);
  useAuthStore.setState({ user: null, sessionId: null, isAuthenticated: false, isHydrated: false });
});

it('coordinates two independent client modules using one shared single-use refresh', async () => {
  seedSession('expired', 'refresh-one');
  vi.resetModules();
  const secondTab = await import('@/lib/api/client');
  const entered = deferred<void>(); const release = deferred<void>();
  let rotations = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/auth/refresh')) {
      rotations++;
      entered.resolve(); await release.promise;
      return new Response(JSON.stringify(tokenSuccess));
    }
    return new Headers(options.headers).get('Authorization') === 'Bearer access-two' ? json({ owner: 'alice' }) : json(null, 401);
  }));
  const first = apiClient('/users'); const second = secondTab.apiClient('/users');
  await entered.promise; release.resolve();
  expect(await Promise.all([first, second])).toEqual([{ owner: 'alice' }, { owner: 'alice' }]);
  expect(rotations).toBe(1);
  expect(getSession()).toMatchObject({ id: 'test-login', accessToken: 'access-two', refreshToken: 'refresh-two' });
});

it.each([200, 401])('rejects late HTTP %s from a previous account without retrying as the new owner', async status => {
  await startSession('alice-access', 'alice-refresh');
  const pending = deferred<Response>();
  const fetcher = vi.fn(() => pending.promise); vi.stubGlobal('fetch', fetcher);
  const oldRequest = apiClient('/owned/mutation', { method: 'POST' });
  const bob = await startSession('bob-access', 'bob-refresh');
  pending.resolve(json({ owner: 'alice' }, status));
  await expect(oldRequest).rejects.toMatchObject({ name: 'AuthError' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getSession()).toEqual(bob);
});

it('rejects a JSON body that finishes decoding after the session changes', async () => {
  await startSession('alice-access', 'alice-refresh');
  const entered = deferred<void>(); const body = deferred<unknown>();
  const response = json({});
  response.json = async () => { entered.resolve(); return body.promise; };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const request = apiClient('/users'); await entered.promise;
  await startSession('bob-access', 'bob-refresh'); body.resolve({ success: true, data: { owner: 'alice' } });
  await expect(request).rejects.toMatchObject({ name: 'AuthError' });
});

it('rejects an otherwise valid downloaded file when its session changes during body consumption', async () => {
  await startSession('alice-access', 'alice-refresh');
  const bytes = new TextEncoder().encode('private alice report');
  const expected = { filename: 'report.pdf', media_type: 'application/pdf', size_bytes: String(bytes.length), sha256: createHash('sha256').update(bytes).digest('hex') };
  const response = new Response(bytes, { headers: { 'Content-Type': expected.media_type, 'Content-Length': expected.size_bytes, 'X-Content-SHA256': expected.sha256, 'Content-Disposition': 'attachment; filename="report.pdf"' } });
  const entered = deferred<void>(); const release = deferred<ArrayBuffer>();
  response.arrayBuffer = async () => { entered.resolve(); return release.promise; };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const request = apiFile('/download', expected); await entered.promise;
  await startSession('bob-access', 'bob-refresh'); release.resolve(bytes.buffer);
  await expect(request).rejects.toMatchObject({ name: 'AuthError' });
});

it('serializes logout behind pending refresh and cannot clear a subsequent login', async () => {
  const alice = await startSession('expired', 'refresh-one');
  const entered = deferred<void>(); const release = deferred<void>();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/auth/refresh')) { entered.resolve(); await release.promise; return new Response(JSON.stringify(tokenSuccess)); }
    return json(null, 401);
  }));
  // Capture rejection immediately; clearing the session can win before retry.
  const request = apiClient('/users').catch(error => error);
  await entered.promise;
  const logout = clearTokens(alice.id);
  release.resolve(); await logout; await request;
  expect(getSession()).toBeNull();
  const bob = await startSession('bob-access', 'bob-refresh');
  await clearTokens(alice.id);
  expect(getSession()).toEqual(bob);
});

it('rejects stale login completion even when both logins target the same account', async () => {
  const first = await startSession('alice-one', 'refresh-one', null);
  await expect(startSession('alice-two', 'refresh-two', null)).rejects.toMatchObject({ name: 'AuthError' });
  expect(getSession()).toEqual(first);
});

it('does not refresh unsafely when origin-wide Web Locks are unavailable', async () => {
  seedSession('expired', 'refresh-one');
  vi.stubGlobal('navigator', {});
  const fetcher = vi.fn().mockResolvedValue(json(null, 401)); vi.stubGlobal('fetch', fetcher);
  await expect(apiClient('/users')).rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getSession()?.refreshToken).toBe('refresh-one');
});

it('ignores legacy persisted authenticated flags and separately written credentials', () => {
  localStorage.setItem('tracevault_access_token', 'legacy-access');
  localStorage.setItem('tracevault_refresh_token', 'legacy-refresh');
  localStorage.setItem('tracevault-auth-storage', JSON.stringify({ state: { isAuthenticated: true, user: { id: 'alice' } } }));
  const queries = new QueryClient(); queries.setQueryData(['portfolio'], { owner: 'alice' });
  const stop = observeAuthSession(queries);
  expect(getSession()).toBeNull();
  expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, isHydrated: true });
  expect(queries.getQueryData(['portfolio'])).toBeUndefined(); stop();
});

it('clears profile/cache on same-tab and other-tab identity transitions but preserves them on rotation', async () => {
  const queries = new QueryClient(); const stop = observeAuthSession(queries);
  const alice = await startSession('alice-access', 'alice-refresh');
  expect(useAuthStore.getState()).toMatchObject({ sessionId: alice.id, isAuthenticated: true });
  queries.setQueryData(['portfolio'], { owner: 'alice' });
  await withSessionLock(() => writeSessionLocked({ ...alice, accessToken: 'alice-new' }));
  expect(queries.getQueryData(['portfolio'])).toEqual({ owner: 'alice' });
  seedSession('bob-access', 'bob-refresh', 'bob-login');
  const change = new Event('storage'); Object.defineProperty(change, 'key', { value: SESSION_KEY });
  window.dispatchEvent(change);
  expect(useAuthStore.getState()).toMatchObject({ sessionId: 'bob-login', user: null, isAuthenticated: true });
  expect(queries.getQueryData(['portfolio'])).toBeUndefined();
  localStorage.removeItem(SESSION_KEY); window.dispatchEvent(change);
  expect(useAuthStore.getState()).toMatchObject({ sessionId: null, isAuthenticated: false }); stop();
});

it('logout reads the replacement token after a competing refresh and prevents another rotation', async () => {
  await startSession('expired', 'refresh-one');
  const entered = deferred<void>(); const release = deferred<void>();
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/auth/refresh')) {
      entered.resolve(); await release.promise;
      return new Response(JSON.stringify(tokenSuccess));
    }
    if (url.endsWith('/auth/logout')) {
      expect(JSON.parse(options.body as string)).toEqual({ refresh_token: 'refresh-two' });
      expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-two');
      return json({});
    }
    return json(null, 401);
  });
  vi.stubGlobal('fetch', fetcher);
  const oldRequest = apiClient('/users').catch(error => error);
  await entered.promise;
  const logout = logoutSession(); release.resolve();
  await logout; await oldRequest;
  expect(getSession()).toBeNull();
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/logout'))).toHaveLength(1);
});

it('clears local logout state even when the remote revocation fails', async () => {
  await startSession('alice-access', 'alice-refresh');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')));
  await expect(logoutSession()).rejects.toThrow('Network failed');
  expect(getSession()).toBeNull();
});

it('classifies an old account network failure as a session change, preventing automatic query retry', async () => {
  await startSession('alice-access', 'alice-refresh');
  const release = deferred<void>();
  vi.stubGlobal('fetch', vi.fn(async () => { await release.promise; throw new TypeError('Old request disconnected'); }));
  const request = apiClient('/users');
  await startSession('bob-access', 'bob-refresh'); release.resolve();
  await expect(request).rejects.toMatchObject({ name: 'AuthError' });
});
