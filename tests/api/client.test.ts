import { beforeEach, describe, expect, it, vi } from 'vitest';
import authSuccess from '../../../tracevault-contracts/http/fixtures/auth-success.json';
import tokenSuccess from '../../../tracevault-contracts/http/fixtures/token-success.json';
import validationError from '../../../tracevault-contracts/http/fixtures/validation-error.json';

import { installBrowserSession, tokens } from '../support/browser-session';
import { apiClient, apiClientNoAuth, apiFile } from '@/lib/api/client';
import { createHash, webcrypto } from 'node:crypto';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => { vi.unstubAllGlobals(); installBrowserSession(); });

describe('Gateway HTTP transport', () => {
  it('builds logout credentials after a missing access token is refreshed', async () => {
    tokens.access = null; tokens.refresh = 'refresh-one';
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(tokenSuccess);
      if (new Headers(init.headers).get('Authorization') !== 'Bearer access-two') return json(validationError, 401);
      expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'refresh-two' });
      return json({ success: true, data: {} });
    });
    vi.stubGlobal('fetch', fetcher);
    await apiClient('/auth/logout', () => ({ method: 'POST', body: JSON.stringify({ refresh_token: tokens.refresh }) }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('preserves credentials after a refresh storage failure and allows a later retry', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    let failing = true;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return failing
        ? json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'internal server error' } }, 500)
        : json(tokenSuccess);
      return new Headers(init.headers).get('Authorization') === 'Bearer access-two' ? json(authSuccess) : json(validationError, 401);
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(apiClient('/users')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(tokens).toEqual({ access: 'expired', refresh: 'refresh-one' });
    failing = false;
    await expect(apiClient('/users')).resolves.toEqual(authSuccess.data);
    expect(tokens.refresh).toBe('refresh-two');
  });

  it.each([401, 403])('clears credentials when refresh is rejected with HTTP %s', async status => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(validationError, url.endsWith('/auth/refresh') ? status : 401)));
    await expect(apiClient('/users')).rejects.toMatchObject({ name: 'AuthError' });
    expect(tokens).toEqual({ access: null, refresh: null });
  });

  it('does not destroy credentials on a network failure during refresh', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return json(validationError, 401);
    }));
    await expect(apiClient('/users')).rejects.toThrow('Network request failed');
    expect(tokens).toEqual({ access: 'expired', refresh: 'refresh-one' });
  });

  it('does not restore credentials when logout wins a pending refresh', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        tokens.access = null; tokens.refresh = null;
        return json(tokenSuccess);
      }
      return json(validationError, 401);
    }));
    await expect(apiClient('/users')).rejects.toMatchObject({ name: 'AuthError' });
    expect(tokens).toEqual({ access: null, refresh: null });
  });

  it('shares a single refresh between JSON requests and authenticated binary downloads', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one'; vi.stubGlobal('crypto', webcrypto);
    const file = new TextEncoder().encode('retained report bytes');
    const expected = { filename: 'accounting-test.pdf', media_type: 'application/pdf', size_bytes: String(file.length), sha256: createHash('sha256').update(file).digest('hex') };
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) { await new Promise(resolve => setTimeout(resolve, 10)); return json(tokenSuccess); }
      if (new Headers(init.headers).get('Authorization') !== 'Bearer access-two') return json(validationError, 401);
      if (url.endsWith('/download')) return new Response(file, { headers: { 'Content-Type': expected.media_type, 'Content-Length': expected.size_bytes, 'Content-Disposition': `attachment; filename="${expected.filename}"`, 'X-Content-SHA256': expected.sha256 } });
      return json(authSuccess);
    });
    vi.stubGlobal('fetch', fetcher);
    const [data, blob] = await Promise.all([apiClient('/users'), apiFile('/download', expected)]);
    expect(data).toEqual(authSuccess.data); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(file);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });
  it('unwraps the provider auth fixture once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(authSuccess)));
    expect(await apiClientNoAuth('/api/v1/auth/login')).toEqual(authSuccess.data);
  });

  it('preserves structured validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(validationError, 400)));
    await expect(apiClientNoAuth('/api/v1/auth/register')).rejects.toMatchObject(validationError.error);
  });

  it('rejects a success response that violates the envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ access_token: 'wrong-shape' })));
    await expect(apiClientNoAuth('/api/v1/auth/login')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('shares refresh across concurrent expired-token requests and unwraps refreshed tokens', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        await new Promise(resolve => setTimeout(resolve, 10));
        return json(tokenSuccess);
      }
      return new Headers(init.headers).get('Authorization') === 'Bearer access-two'
        ? json(authSuccess) : json(validationError, 401);
    });
    vi.stubGlobal('fetch', fetcher);
    const results = await Promise.all([apiClient('/users'), apiClient('/users'), apiClient('/users')]);
    expect(results).toEqual([authSuccess.data, authSuccess.data, authSuccess.data]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(tokens.refresh).toBe('refresh-two');
  });

  it('does not refresh again for a delayed 401 after another request rotated the token', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(tokenSuccess);
      if (new Headers(init.headers).get('Authorization') === 'Bearer access-two') return json(authSuccess);
      if (url.endsWith('/slow')) await new Promise(resolve => setTimeout(resolve, 25));
      return json(validationError, 401);
    });
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([apiClient('/fast'), apiClient('/slow')]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('retries at most once after refresh and clears invalid credentials', async () => {
    tokens.access = 'expired'; tokens.refresh = 'refresh-one';
    const fetcher = vi.fn(async (url: string) => url.endsWith('/auth/refresh')
      ? json(tokenSuccess) : json(validationError, 401));
    vi.stubGlobal('fetch', fetcher);
    await expect(apiClient('/users')).rejects.toMatchObject({ name: 'AuthError' });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(tokens.access).toBeNull(); expect(tokens.refresh).toBeNull();
  });

  it('handles 204 without parsing JSON', async () => {
    tokens.access = 'access';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await apiClient('/delete', { method: 'DELETE' })).toBeUndefined();
  });
});
