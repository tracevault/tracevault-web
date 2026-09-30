import { vi } from 'vitest';
import { getSession, SESSION_KEY } from '@/lib/auth';

/** Storage and Web Locks host substitutes; the real session implementation runs. */
export function installBrowserSession() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  });
  vi.stubGlobal('window', new EventTarget());
  let queue: Promise<unknown> = Promise.resolve();
  vi.stubGlobal('navigator', { locks: {
    request: (_name: string, options: { signal: AbortSignal }, action: () => unknown) => {
      const pending = queue.catch(() => {}).then(() => {
        options.signal.throwIfAborted();
        return action();
      });
      queue = pending;
      return pending;
    },
  } });
}

export function seedSession(access: string | null, refresh: string | null, id = 'test-login') {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, id, accessToken: access, refreshToken: refresh }));
}

// Existing transport fault tests can mutate stored values without mocking auth.
export const tokens = {
  get access() { return getSession()?.accessToken ?? null; },
  set access(value: string | null) { seedSession(value, getSession()?.refreshToken ?? null); },
  get refresh() { return getSession()?.refreshToken ?? null; },
  set refresh(value: string | null) { seedSession(getSession()?.accessToken ?? null, value); },
};
