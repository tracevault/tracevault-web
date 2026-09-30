import { ApiRequestError, AuthError } from '@/types';

export const SESSION_KEY = 'tracevault_session_v1';
export const SESSION_LOCK = 'tracevault-auth-session-v1';
const SESSION_EVENT = 'tracevault:session';
export interface BrowserSession {
  version: 1;
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
}

export function getSession(): BrowserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || typeof value.id !== 'string' || !value.id ||
        !(value.accessToken === null || typeof value.accessToken === 'string' && value.accessToken) ||
        !(value.refreshToken === null || typeof value.refreshToken === 'string' && value.refreshToken) ||
        (!value.accessToken && !value.refreshToken)) return null;
    return value;
  } catch { return null; }
}

export function assertSession(id: string): BrowserSession {
  const session = getSession();
  if (!session || session.id !== id) throw new AuthError('Session changed; please retry from the current account');
  return session;
}

/** Every writer uses this same origin-wide lock, including login and logout. */
export async function withSessionLock<T>(action: () => Promise<T> | T): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new ApiRequestError('AUTH_COORDINATION_UNAVAILABLE', '안전한 로그인 처리를 지원하는 브라우저와 HTTPS 연결을 사용해 주세요.');
  }
  return navigator.locks.request(SESSION_LOCK, { signal: AbortSignal.timeout(15_000) }, action);
}

/** Only call while holding SESSION_LOCK. A single write publishes both tokens. */
export function writeSessionLocked(session: BrowserSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  // Remove incompatible legacy credentials rather than guessing their login identity.
  localStorage.removeItem('tracevault_access_token');
  localStorage.removeItem('tracevault_refresh_token');
  localStorage.removeItem('tracevault-auth-storage');
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export async function startSession(accessToken: string, refreshToken: string, expectedId: string | null = getSession()?.id ?? null): Promise<BrowserSession> {
  if (!accessToken || !refreshToken) throw new ApiRequestError('INVALID_RESPONSE', 'Missing login credentials');
  return withSessionLock(() => {
    if ((getSession()?.id ?? null) !== expectedId) throw new AuthError('Session changed during login');
    const session: BrowserSession = { version: 1, id: crypto.randomUUID(), accessToken, refreshToken };
    writeSessionLocked(session);
    return session;
  });
}

export async function clearTokens(expectedId?: string): Promise<void> {
  await withSessionLock(() => {
    if (expectedId && getSession()?.id !== expectedId) return;
    writeSessionLocked(null);
  });
}

export function subscribeSession(listener: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', storage);
  window.addEventListener(SESSION_EVENT, listener);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(SESSION_EVENT, listener);
  };
}

export const getAccessToken = () => getSession()?.accessToken ?? null;
export const getRefreshToken = () => getSession()?.refreshToken ?? null;
export const hasTokens = () => getSession() !== null;
