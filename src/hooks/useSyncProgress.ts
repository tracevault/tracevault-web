'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken } from '@/lib/auth';
import type { SyncProgress, SyncEventType } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface UseSyncProgressOptions {
  onCompleted?: (progress: SyncProgress) => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface UseSyncProgressResult {
  progress: SyncProgress | null;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for subscribing to sync progress updates via SSE (Server-Sent Events)
 */
export function useSyncProgress(
  connectionId: string | null,
  options: UseSyncProgressOptions = {}
): UseSyncProgressResult {
  const {
    onCompleted,
    onError,
    autoReconnect = true,
    maxReconnectAttempts = 3,
  } = options;

  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!connectionId) return;

    cleanup();
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError('Authentication required');
      return;
    }

    // SSE doesn't support custom headers, so we pass token as query param
    const url = `${API_BASE}/api/v1/connections/${connectionId}/sync/status?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: SyncEventType;
          data: SyncProgress;
        };

        switch (data.type) {
          case 'progress':
            setProgress(data.data);
            break;

          case 'completed':
            setProgress(data.data);
            onCompleted?.(data.data);
            // Close connection after completion
            cleanup();
            setIsConnected(false);
            break;

          case 'error':
            setProgress(data.data);
            setError(data.data.error || 'Sync failed');
            onError?.(data.data.error || 'Sync failed');
            cleanup();
            setIsConnected(false);
            break;

          case 'heartbeat':
            // Keep-alive, no action needed
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);

      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setError('Connection failed');
        cleanup();
      }
    };
  }, [connectionId, cleanup, onCompleted, onError, autoReconnect, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
    setProgress(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    progress,
    isConnected,
    error,
    connect,
    disconnect,
  };
}

/**
 * Hook for managing multiple sync progress streams
 */
export function useMultipleSyncProgress(
  connectionIds: string[],
  options: UseSyncProgressOptions = {}
) {
  const [progressMap, setProgressMap] = useState<Map<string, SyncProgress>>(
    new Map()
  );
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  const cleanup = useCallback(() => {
    eventSourcesRef.current.forEach((source) => source.close());
    eventSourcesRef.current.clear();
    setConnectedIds(new Set());
  }, []);

  const connectAll = useCallback(() => {
    cleanup();

    const token = getAccessToken();
    if (!token) {
      connectionIds.forEach((id) => {
        setErrors((prev) => new Map(prev).set(id, 'Authentication required'));
      });
      return;
    }

    connectionIds.forEach((connectionId) => {
      const url = `${API_BASE}/api/v1/connections/${connectionId}/sync/status?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setConnectedIds((prev) => new Set(prev).add(connectionId));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type: SyncEventType;
            data: SyncProgress;
          };

          if (data.type === 'progress' || data.type === 'completed') {
            setProgressMap((prev) =>
              new Map(prev).set(connectionId, data.data)
            );
          }

          if (data.type === 'completed' || data.type === 'error') {
            eventSource.close();
            eventSourcesRef.current.delete(connectionId);
            setConnectedIds((prev) => {
              const next = new Set(prev);
              next.delete(connectionId);
              return next;
            });

            if (data.type === 'error') {
              setErrors((prev) =>
                new Map(prev).set(connectionId, data.data.error || 'Sync failed')
              );
            }
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setConnectedIds((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
        setErrors((prev) =>
          new Map(prev).set(connectionId, 'Connection failed')
        );
      };

      eventSourcesRef.current.set(connectionId, eventSource);
    });
  }, [connectionIds, cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    progressMap,
    connectedIds,
    errors,
    connectAll,
    disconnectAll: cleanup,
    getProgress: (id: string) => progressMap.get(id),
    isConnected: (id: string) => connectedIds.has(id),
    getError: (id: string) => errors.get(id),
  };
}
