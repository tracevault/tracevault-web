'use client';

import { Eye, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Wallet } from '@/types';

export function WalletCard({ wallet, onRemove, removing }: { wallet: Wallet; onRemove(): void; removing: boolean }) {
  const signed = wallet.ownership_mode === 'signed';
  return (
    <Card className="gap-4">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            {signed ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <Eye className="h-4 w-4 text-amber-600" />}
            {wallet.label || wallet.chain_id}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{wallet.chain_id}</Badge>
            <Badge variant={signed ? 'success' : 'warning'}>{signed ? '소유권 확인됨' : '읽기 전용'}</Badge>
          </div>
        </div>
        <Button aria-label="지갑 연결 삭제" variant="ghost" size="icon-sm" disabled={removing} onClick={onRemove}><Trash2 /></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="break-all font-mono text-xs text-muted-foreground">{wallet.address}</p>
        <p className="text-xs text-muted-foreground">체인 데이터 수집은 인덱서 준비 후 시작됩니다.</p>
      </CardContent>
    </Card>
  );
}
