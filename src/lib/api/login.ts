import { apiClientNoAuth } from './client';
import { getLoginClientID } from '@/lib/auth/client-recognition';
import type { LoginRequest, LoginResponse } from '@/types';

export async function browserLogin(credentials: Pick<LoginRequest, 'email' | 'password' | 'totp_code' | 'recovery_code'>): Promise<LoginResponse> {
  const clientID = await getLoginClientID();
  return apiClientNoAuth<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: credentials.email, password: credentials.password,
      ...(credentials.totp_code !== undefined ? { totp_code: credentials.totp_code } : {}),
      ...(credentials.recovery_code !== undefined ? { recovery_code: credentials.recovery_code } : {}),
      ...(clientID ? { client_id: clientID } : {}) }),
  });
}
