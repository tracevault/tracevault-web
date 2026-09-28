import { apiClient } from './client';
import type { components } from '@/types/generated/http';

type Schema = components['schemas'];
export type FactorStatus = Schema['TwoFactorStatus'];
export type FactorSetup = Schema['TwoFactorSetup'];
const root = '/api/v1/users/me/two-factor';
const post = <T>(path: string, body: unknown, signal?: AbortSignal) => apiClient<T>(`${root}/${path}`, { method: 'POST', body: JSON.stringify(body), signal, cache: 'no-store' });

export const twoFactorAPI = {
  status: (signal?: AbortSignal) => apiClient<FactorStatus>(root, { signal, cache: 'no-store' }),
  begin: (input: Schema['BeginTwoFactorSetup'], signal?: AbortSignal) => post<FactorSetup>('setup', input, signal),
  enable: (input: Schema['EnableTwoFactor'], signal?: AbortSignal) => post<Schema['TwoFactorRecoveryCodes']>('enable', input, signal),
  regenerate: (input: Schema['ChangeTwoFactor'], signal?: AbortSignal) => post<Schema['TwoFactorRecoveryCodes']>('recovery-codes', input, signal),
  disable: (input: Schema['ChangeTwoFactor'], signal?: AbortSignal) => post<Schema['TwoFactorChanged']>('disable', input, signal),
};
