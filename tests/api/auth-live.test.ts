import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { LoginResponse, User } from '@/types';

import { installBrowserSession, tokens } from '../support/browser-session';
import { apiClient, apiClientNoAuth, logoutSession } from '@/lib/api/client';

// Only browser storage is substituted; fetch, Gateway, Identity and PostgreSQL
// are real. The owning Infra harness supplies its isolated Compose project.
const project = process.env.TEST_AUTH_COMPOSE_PROJECT;
it.skipIf(!project)('actual Web transport preserves a rolled-back refresh and recovers across Gateway/Identity', async () => {
  installBrowserSession();
  expect(project).toMatch(/^tracevault-auth-[0-9]+$/);
  expect(process.env.NEXT_PUBLIC_API_URL).toMatch(/^http:\/\/127\.0\.0\.1:[0-9]+$/);
  const sql = (input: string) => execFileSync('docker', ['compose', '-p', project!, '-f', '../tracevault-infra/docker-compose.integration.yml',
    'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'tracevault_test', '-d', 'tracevault_identity'], { input, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
  const registered = await apiClientNoAuth<LoginResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({
    email: `web-${randomUUID()}@example.test`, password: 'Password123!', name: 'Web transport',
  }) });
  const id = registered.user.id;
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  tokens.access = 'expired-fixture-access';
  tokens.refresh = registered.refresh_token;
  try {
    sql(`CREATE FUNCTION reject_web_refresh_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.user_id='${id}'::uuid THEN RAISE EXCEPTION 'fixture write failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_web_refresh_fixture BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_web_refresh_fixture();`);
    try {
      const failed = await Promise.allSettled([apiClient('/api/v1/users/me'), apiClient('/api/v1/users/me'), apiClient('/api/v1/users/me')]);
      for (const result of failed) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') expect(result.reason).toMatchObject({ name: 'ApiRequestError', code: 'INTERNAL_ERROR' });
      }
      expect(tokens).toEqual({ access: 'expired-fixture-access', refresh: registered.refresh_token });
    } finally {
      sql('DROP TRIGGER reject_web_refresh_fixture ON refresh_tokens; DROP FUNCTION reject_web_refresh_fixture();');
    }
    const users = await Promise.all([apiClient<User>('/api/v1/users/me'), apiClient<User>('/api/v1/users/me'), apiClient<User>('/api/v1/users/me')]);
    expect(users.map(user => user.id)).toEqual([id, id, id]);
    expect(tokens.refresh).not.toBe(registered.refresh_token);
    await expect(apiClientNoAuth('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: registered.refresh_token }) }))
      .rejects.toMatchObject({ name: 'ApiRequestError', code: 'UNAUTHORIZED' });
    await apiClient('/api/v1/users/me/password', { method: 'POST', body: JSON.stringify({ current_password: 'Password123!', new_password: 'NewPassword123!' }) });
    await expect(apiClient('/api/v1/users/me')).rejects.toMatchObject({ name: 'AuthError' });
    expect(tokens).toEqual({ access: null, refresh: null });
    const login = await apiClientNoAuth<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({
      email: registered.user.email, password: 'NewPassword123!',
    }) });
    tokens.access = null; tokens.refresh = login.refresh_token;
    await apiClient('/api/v1/auth/logout', () => ({ method: 'POST', body: JSON.stringify({ refresh_token: tokens.refresh }) }));
    expect(tokens.refresh).not.toBe(login.refresh_token);
    await expect(apiClientNoAuth('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: tokens.refresh }) }))
      .rejects.toMatchObject({ name: 'ApiRequestError', code: 'UNAUTHORIZED' });
    const fresh = await apiClientNoAuth<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({
      email: registered.user.email, password: 'NewPassword123!',
    }) });
    tokens.access = fresh.access_token; tokens.refresh = fresh.refresh_token;
    await logoutSession();
    expect(tokens).toEqual({ access: null, refresh: null });
    await expect(apiClientNoAuth('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: fresh.refresh_token }) }))
      .rejects.toMatchObject({ name: 'ApiRequestError', code: 'UNAUTHORIZED' });
  } finally {
    sql(`DELETE FROM users WHERE id='${id}'::uuid`);
  }
}, 30000);
