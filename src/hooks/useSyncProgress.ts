'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { watchSync } from '@/lib/api/sync';
import type { SyncProgress } from '@/types';

interface UseSyncProgressOptions {
  onCompleted?: (progress: SyncProgress) => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export function useSyncProgress(connectionId: string | null, options: UseSyncProgressOptions = {}) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbacks = useRef(options);
  useEffect(() => { callbacks.current = options; }, [options]);
  const stop = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();
  const disconnect = useCallback(() => { stop.current?.(); stop.current = null; setIsConnected(false); }, []);
  const connect = useCallback(() => {
    disconnect();
    if (!connectionId) return;
    setError(null); setProgress(null); setIsConnected(true);
    stop.current = watchSync(connectionId, {
      maxFailures: callbacks.current.autoReconnect === false ? 1 : (callbacks.current.maxReconnectAttempts ?? 3),
      onProgress: setProgress,
      onCompleted: value => {
        setIsConnected(false);
        void queryClient.invalidateQueries({ queryKey: ['connections'] });
        callbacks.current.onCompleted?.(value);
      },
      onError: message => {
        setError(message); setIsConnected(false);
        void queryClient.invalidateQueries({ queryKey: ['connections'] });
        callbacks.current.onError?.(message);
      },
    });
  }, [connectionId, disconnect, queryClient]);
  useEffect(() => () => { stop.current?.(); }, []);
  return { progress, isConnected, error, connect, disconnect };
}
