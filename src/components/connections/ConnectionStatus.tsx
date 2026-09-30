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
  disconnected: { label: '연결 해제됨', variant: 'secondary' },
  idle: { label: '연결됨', variant: 'secondary' },
  syncing: { label: '동기화 중', variant: 'warning' },
  completed: { label: '동기화 완료', variant: 'success' },
  failed: { label: '동기화 실패', variant: 'destructive' },
};

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
