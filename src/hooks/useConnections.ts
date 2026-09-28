'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiClientNoAuth } from '@/lib/api';
import { parseExchangeCapabilities } from '@/lib/exchangeCapabilities';
import type {
  ConnectionListResponse,
  CreateConnectionRequest,
  CreateConnectionResponse,
  StartSyncRequest,
  StartSyncResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  ServerPublicKeyResponse,
} from '@/types';


const CONNECTIONS_KEY = ['connections'] as const;
const PUBLIC_KEY_KEY = ['server-public-key'] as const;

/**
 * Fetch server's public key for API key encryption
 */
export function useServerPublicKey() {
  return useQuery({
    queryKey: PUBLIC_KEY_KEY,
    queryFn: () =>
      apiClientNoAuth<ServerPublicKeyResponse>('/api/v1/connections/public-key'),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Fetch all connections for the current user
 */
function connectionListOptions(includeDisconnected: boolean) {
  return {
    queryKey: includeDisconnected ? [...CONNECTIONS_KEY, 'retained'] : CONNECTIONS_KEY,
    queryFn: () => apiClient<ConnectionListResponse>(includeDisconnected ? '/api/v1/connections?include_disconnected=true' : '/api/v1/connections'),
    staleTime: 60_000,
  };
}

export function useConnectionList(includeDisconnected = false) {
  return useQuery(connectionListOptions(includeDisconnected));
}

export function useConnections(includeDisconnected = false) {
  return useQuery({ ...connectionListOptions(includeDisconnected), select: response => response.connections });
}

/**
 * Get a single connection by ID
 */
export function useConnection(connectionId: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, connectionId],
    queryFn: async () => {
      const result = await apiClient<ConnectionListResponse>('/api/v1/connections');
      const connection = result.connections.find(item => item.id === connectionId);
      if (!connection) throw new Error('연결 정보를 찾을 수 없습니다');
      return connection;
    },
    enabled: !!connectionId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Create a new exchange connection
 */
export function useCreateConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConnectionRequest) =>
      apiClient<CreateConnectionResponse>('/api/v1/connections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/**
 * Test exchange connection before saving
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: (data: TestConnectionRequest) =>
      apiClient<TestConnectionResponse>('/api/v1/connections/test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

/**
 * Start synchronization for a connection
 */
export function useStartSync(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: StartSyncRequest) =>
      apiClient<StartSyncResponse>(
        `/api/v1/connections/${connectionId}/sync`,
        {
          method: 'POST',
          body: JSON.stringify(data || {}),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...CONNECTIONS_KEY, connectionId],
      });
    },
  });
}

/**
 * Delete a connection
 */
export function useDeleteConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiClient(`/api/v1/connections/${connectionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/**
 * Refresh connection list
 */
export function useRefreshConnections() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
  };
}

/** Configured server support is independent from an owner's retained history. */
export function useExchangeCapabilities() {
  return useQuery({
    queryKey: ['exchange-capabilities'],
    queryFn: async () => parseExchangeCapabilities(await apiClient<unknown>('/api/v1/connections/capabilities')),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
