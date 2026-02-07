'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { mockConnections } from '@/lib/mockData';
import type {
  Connection,
  ConnectionListResponse,
  CreateConnectionRequest,
  CreateConnectionResponse,
  StartSyncRequest,
  StartSyncResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  ServerPublicKeyResponse,
} from '@/types';

// TEMPORARY: Enable mock data for UI testing without backend
const USE_MOCK_DATA = true;

const CONNECTIONS_KEY = ['connections'] as const;
const PUBLIC_KEY_KEY = ['server-public-key'] as const;

/**
 * Fetch server's public key for API key encryption
 */
export function useServerPublicKey() {
  return useQuery({
    queryKey: PUBLIC_KEY_KEY,
    queryFn: () =>
      apiClient<ServerPublicKeyResponse>('/api/v1/connections/public-key'),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Fetch all connections for the current user
 */
export function useConnections() {
  return useQuery({
    queryKey: CONNECTIONS_KEY,
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return mockConnections;
      }
      const response = await apiClient<ConnectionListResponse>(
        '/api/v1/connections'
      );
      return response.connections;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Get a single connection by ID
 */
export function useConnection(connectionId: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, connectionId],
    queryFn: () =>
      apiClient<Connection>(`/api/v1/connections/${connectionId}`),
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
