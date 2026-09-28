import { getSession, assertSession, withSessionLock, writeSessionLocked } from '@/lib/auth';
import type { BrowserSession } from '@/lib/auth';
import { AuthError, ApiRequestError } from '@/types';
import type { RefreshTokenResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const refreshes = new Map<string, Promise<string | null>>();

/** Decode the Gateway envelope exactly once, for public and authenticated calls. */
async function decode<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  let body;
  try { body = await response.json(); } catch {
    throw new ApiRequestError('INVALID_RESPONSE', `HTTP ${response.status}: invalid JSON response`);
  }
  if (!response.ok) {
    const error = body?.error;
    throw new ApiRequestError(error?.code || 'UNKNOWN_ERROR', error?.message || `HTTP ${response.status}`, error?.details);
  }
  if (body?.success !== true || !Object.prototype.hasOwnProperty.call(body, 'data')) {
    throw new ApiRequestError('INVALID_RESPONSE', 'Invalid API response envelope');
  }
  return body.data as T;
}

/** The origin-wide lock covers the HTTP call and atomic credential publication.
 * A per-module flight also shares transient failures among local callers. */
function refreshAccessToken(expected: BrowserSession): Promise<string | null> {
  const key = JSON.stringify([expected.id, expected.accessToken, expected.refreshToken]);
  const pending = refreshes.get(key);
  if (pending) return pending;
  const flight = withSessionLock(async () => {
    const current = assertSession(expected.id);
    if (current.accessToken && (current.accessToken !== expected.accessToken || current.refreshToken !== expected.refreshToken)) {
      return current.accessToken;
    }
    if (!current.refreshToken) {
      writeSessionLocked(null);
      return null;
    }
    const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
    assertSession(expected.id);
    if (response.status === 401 || response.status === 403) {
      writeSessionLocked(null);
      return null;
    }
    const data = await decode<RefreshTokenResponse>(response);
    assertSession(expected.id);
    if (typeof data.access_token !== 'string' || !data.access_token ||
        typeof data.refresh_token !== 'string' || !data.refresh_token) {
      throw new ApiRequestError('INVALID_RESPONSE', 'Missing refreshed credentials');
    }
    writeSessionLocked({ ...current, accessToken: data.access_token, refreshToken: data.refresh_token });
    return data.access_token;
  }).finally(() => { refreshes.delete(key); });
  refreshes.set(key, flight);
  return flight;
}

function send(endpoint: string, options: RequestInit, token?: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_BASE}${endpoint}`, { ...options, headers });
}

type AuthenticatedOptions = RequestInit | ((session: BrowserSession) => RequestInit);

async function freshCredentialsRejected(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json();
    return body?.success === false && body?.error?.code === 'INVALID_CREDENTIALS';
  } catch { return false; }
}

async function authenticatedResponse(endpoint: string, options: AuthenticatedOptions): Promise<{ response: Response; sessionId: string }> {
  const session = getSession();
  if (!session) throw new AuthError('Session expired');
  const currentOptions = () => {
    const current = assertSession(session.id);
    return typeof options === 'function' ? options(current) : options;
  };
  try {
    const initialToken = session.accessToken || await refreshAccessToken(session);
    assertSession(session.id);
    if (!initialToken) throw new AuthError('Session expired');
    let response = await send(endpoint, currentOptions(), initialToken);
    assertSession(session.id);
    if (response.status === 401 && !(await freshCredentialsRejected(response))) {
      const current = assertSession(session.id);
      const retryToken = current.accessToken && current.accessToken !== initialToken
        ? current.accessToken : await refreshAccessToken(current);
      assertSession(session.id);
      if (!retryToken) throw new AuthError('Session expired');
      response = await send(endpoint, currentOptions(), retryToken);
      assertSession(session.id);
      if (response.status === 401 && !(await freshCredentialsRejected(response))) {
        await withSessionLock(() => {
          const latest = getSession();
          if (latest?.id === session.id && latest.accessToken === retryToken) writeSessionLocked(null);
        });
        throw new AuthError('Session expired');
      }
    }
    return { response, sessionId: session.id };
  } catch (error) {
    assertSession(session.id);
    throw error;
  }
}

export async function apiClient<T>(endpoint: string, options: AuthenticatedOptions = {}): Promise<T> {
  const { response, sessionId } = await authenticatedResponse(endpoint, options);
  try { return await decode<T>(response); }
  finally { assertSession(sessionId); }
}

/** Retained binary downloads share the same bounded authentication/refresh path. */
export async function apiFile(endpoint: string, expected: { filename: string; media_type: string; size_bytes: string; sha256: string }, signal?: AbortSignal, invalidFile = { code: 'INVALID_REPORT', message: '보고서 파일의 내용이나 검증 정보가 일치하지 않습니다. 다시 내려받아 주세요.' }): Promise<Blob> {
  const { response, sessionId } = await authenticatedResponse(endpoint, { signal });
  if (!response.ok) {
    try { return await decode<never>(response); }
    finally { assertSession(sessionId); }
  }
  const invalid = () => new ApiRequestError(invalidFile.code, invalidFile.message);
  if (response.status !== 200 || !/^[1-9][0-9]*$/.test(expected.size_bytes) || !/^[a-f0-9]{64}$/.test(expected.sha256) ||
      response.headers.get('Content-Length') !== expected.size_bytes || response.headers.get('X-Content-SHA256') !== expected.sha256 ||
      response.headers.get('Content-Type') !== expected.media_type || response.headers.get('Content-Disposition') !== `attachment; filename="${expected.filename}"`) throw invalid();
  const bytes = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
  if (BigInt(bytes.byteLength) !== BigInt(expected.size_bytes)) throw invalid();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  if (Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') !== expected.sha256) throw invalid();
  if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
  assertSession(sessionId);
  return new Blob([bytes], { type: expected.media_type });
}

export async function apiClientNoAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return decode<T>(await send(endpoint, options));
}

/** Logout revokes the latest refresh credential under the rotation lock. The
 * public logout endpoint does not require refreshing an expired access token. */
export async function logoutSession(): Promise<void> {
  const expected = getSession();
  if (!expected) return;
  await withSessionLock(async () => {
    const session = getSession();
    if (session?.id !== expected.id) return;
    try {
      await decode(await send('/api/v1/auth/logout', {
        method: 'POST', body: JSON.stringify({ refresh_token: session.refreshToken }),
        signal: AbortSignal.timeout(10_000),
      }, session.accessToken));
    } finally {
      if (getSession()?.id === expected.id) writeSessionLocked(null);
    }
  });
}
