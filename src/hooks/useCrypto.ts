'use client';

import { useState, useCallback } from 'react';
import { encryptApiKeys, isCryptoAvailable } from '@/lib/crypto';
import { useServerPublicKey } from './useConnections';

interface UseCryptoResult {
  encrypt: (
    apiKey: string,
    secretKey: string
  ) => Promise<{
    encryptedApiKey: string;
    encryptedSecretKey: string;
    iv: string;
    ephemeralPublicKey: string;
  }>;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  isCryptoSupported: boolean;
}

/**
 * Hook for encrypting API keys using Web Crypto API
 * Fetches server's public key and handles encryption
 */
export function useCrypto(): UseCryptoResult {
  const [error, setError] = useState<string | null>(null);
  const { data: publicKeyData, isLoading, error: publicKeyError } = useServerPublicKey();

  const isCryptoSupported = isCryptoAvailable();

  const encrypt = useCallback(
    async (apiKey: string, secretKey: string) => {
      setError(null);

      if (!isCryptoSupported) {
        throw new Error('Web Crypto API is not available in this browser');
      }

      if (!publicKeyData?.public_key) {
        throw new Error('Server public key not available');
      }

      try {
        const result = await encryptApiKeys(
          apiKey,
          secretKey,
          publicKeyData.public_key
        );
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Encryption failed';
        setError(errorMessage);
        throw err;
      }
    },
    [publicKeyData?.public_key, isCryptoSupported]
  );

  return {
    encrypt,
    isReady: !isLoading && !!publicKeyData?.public_key && isCryptoSupported,
    isLoading,
    error: error || (publicKeyError ? 'Failed to fetch encryption key' : null),
    isCryptoSupported,
  };
}
