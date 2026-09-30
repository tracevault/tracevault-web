'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { AddWatchOnlyWalletRequest, BeginWalletOwnershipRequest, CompleteWalletOwnershipRequest, WalletCapabilitiesResponse, WalletOwnershipChallenge, WalletResponse } from '@/types';

const CONNECTIONS_KEY = ['connections'] as const;

export function useWalletCapabilities() {
  return useQuery({
    queryKey: ['wallet-capabilities'],
    queryFn: () => apiClient<WalletCapabilitiesResponse>('/api/v1/wallets/capabilities'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useBeginWalletOwnership() {
  return useMutation({
    mutationFn: (data: BeginWalletOwnershipRequest) => apiClient<WalletOwnershipChallenge>('/api/v1/wallets/ownership/challenges', { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useCompleteWalletOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompleteWalletOwnershipRequest) => apiClient<WalletResponse>('/api/v1/wallets/ownership/completions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useAddWatchOnlyWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddWatchOnlyWalletRequest) => apiClient<WalletResponse>('/api/v1/wallets/watch-only', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useRemoveWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/api/v1/wallets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}
