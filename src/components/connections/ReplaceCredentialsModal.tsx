'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ApiKeyForm } from './ApiKeyForm';
import { useCrypto } from '@/hooks';
import { apiClient } from '@/lib/api';
import { getExchangeInfo } from '@/lib/exchanges';
import type { Connection, CreateConnectionResponse } from '@/types';
import type { components } from '@/types/generated/http';

export function ReplaceCredentialsModal({ connection, onClose }: { connection: Connection; onClose: () => void }) {
  const crypto = useCrypto();
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const submit = async ({ apiKey, secretKey }: { apiKey: string; secretKey: string }) => {
    if (!connection.credential_revision || pending) return;
    setPending(true); setError(null);
    try {
      const encrypted = await crypto.encrypt(apiKey, secretKey);
      const body: components['schemas']['ReplaceCredentialsRequest'] = {
        expected_revision: connection.credential_revision,
        api_key_encrypted: encrypted.encryptedApiKey,
        api_secret_encrypted: encrypted.encryptedSecretKey,
        ephemeral_public_key: encrypted.ephemeralPublicKey,
        key_id: encrypted.keyId,
      };
      const result = await apiClient<CreateConnectionResponse>(`/api/v1/connections/${encodeURIComponent(connection.id)}/credentials`, { method: 'PUT', body: JSON.stringify(body) });
      if (result.connection.id !== connection.id || !result.connection.credential_revision || BigInt(result.connection.credential_revision) !== BigInt(connection.credential_revision) + BigInt(1)) throw new Error('교체 결과를 확인할 수 없습니다. 연결 정보를 새로고침해 주세요.');
      toast.success('API 키 교체 완료', { description: '기존 계정과 거래 내역이 유지됩니다.' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API 키를 교체하지 못했습니다. 연결 정보를 새로고침해 주세요.');
      setAttempt(value => value + 1); // Erase submitted credentials on every result.
    } finally {
      setPending(false);
      await cache.invalidateQueries({ queryKey: ['connections'] });
    }
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{getExchangeInfo(connection.exchange).name} API 키 교체</DialogTitle>
        <DialogDescription>{connection.label || connection.id} 계정의 새 읽기 전용 키를 입력하세요. 동일한 거래소 계정인지 확인한 후 교체하며, 기존 거래 내역은 유지됩니다. 동기화는 별도로 시작해 주세요.</DialogDescription>
      </DialogHeader>
      <ApiKeyForm key={attempt} exchange={connection.exchange} replacing onSubmit={submit} isSubmitting={pending} isCryptoReady={crypto.isReady} error={error || crypto.error} />
    </DialogContent>
  </Dialog>;
}
