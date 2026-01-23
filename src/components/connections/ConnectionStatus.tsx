'use client';

import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus as ConnectionStatusType } from '@/types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
}

const statusConfig: Record<
  ConnectionStatusType,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  pending: {
    label: '대기 중',
    variant: 'secondary',
  },
  connected: {
    label: '연결됨',
    variant: 'success',
  },
  syncing: {
    label: '동기화 중',
    variant: 'warning',
  },
  error: {
    label: '오류',
    variant: 'destructive',
  },
  disconnected: {
    label: '연결 해제됨',
    variant: 'secondary',
  },
};

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
