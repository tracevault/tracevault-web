import { apiClient, apiClientNoAuth } from './client';
import type { AuthActionLink } from '@/lib/auth/action-link';
import type { components } from '@/types/generated/http';

type Accepted = components['schemas']['AuthActionAccepted'];
type Completed = components['schemas']['SuccessResult'];
export const authActionsAPI = {
  requestVerification: (signal?: AbortSignal) => apiClient<Accepted>('/api/v1/users/me/email-verification', { method: 'POST', body: '{}', signal }),
  requestReset: (email: string, signal?: AbortSignal) => apiClientNoAuth<Accepted>('/api/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }), signal }),
  verify: (link: AuthActionLink, signal?: AbortSignal) => apiClientNoAuth<Completed>('/api/v1/auth/email-verification/complete', { method: 'POST', body: JSON.stringify(link), signal }),
  reset: (link: AuthActionLink, new_password: string, signal?: AbortSignal) => apiClientNoAuth<Completed>('/api/v1/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ ...link, new_password }), signal }),
};
