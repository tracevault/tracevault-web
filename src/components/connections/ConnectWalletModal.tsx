'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAddWatchOnlyWallet, useBeginWalletOwnership, useCompleteWalletOwnership, useWalletCapabilities } from '@/hooks';
import { connectInjectedWallet, connectWalletConnect, isWalletConnectConfigured, type ConnectedWallet } from '@/lib/wallet';
import type { WalletChain } from '@/types';

export function ConnectWalletModal({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange(value: boolean): void; onSuccess(): void }) {
  const capabilities = useWalletCapabilities();
  const begin = useBeginWalletOwnership();
  const complete = useCompleteWalletOwnership();
  const watch = useAddWatchOnlyWallet();
  const [mode, setMode] = useState<'signed' | 'watch_only'>('signed');
  const [connector, setConnector] = useState<'injected' | 'walletconnect'>('injected');
  const [chain, setChain] = useState<WalletChain>('ethereum');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const pending = begin.isPending || complete.isPending || watch.isPending;
  const selected = capabilities.data?.chains.find(item => item.chain_id === chain);

  useEffect(() => {
    if (!open) {
      setMode('signed'); setConnector('injected'); setChain('ethereum'); setAddress(''); setLabel(''); setError('');
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    let connected: ConnectedWallet | undefined;
    try {
      if (mode === 'watch_only') {
        await watch.mutateAsync({ address, chain_id: chain, label });
        toast.success('읽기 전용 지갑이 추가되었습니다.');
      } else {
        connected = connector === 'walletconnect'
          ? await connectWalletConnect(chain, selected?.caip2_network ?? '')
          : await connectInjectedWallet(chain);
        if (selected && connected.scheme !== selected.signature_scheme) throw new Error('선택한 체인과 지갑 서명 방식이 일치하지 않습니다.');
        const challenge = await begin.mutateAsync({ address: connected.address, chain_id: chain });
        const issuedAt = Date.parse(challenge.issued_at);
        const expiresAt = Date.parse(challenge.expires_at);
        const sameAddress = chain === 'solana' ? challenge.address === connected.address : challenge.address.toLowerCase() === connected.address.toLowerCase();
        if (challenge.chain_id !== chain || challenge.signature_scheme !== connected.scheme || !sameAddress ||
            !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt - issuedAt !== 300_000) {
          throw new Error('서명 요청이 선택한 지갑 정보와 일치하지 않습니다.');
        }
        const signature = await connected.sign(challenge.message);
        await complete.mutateAsync({ challenge_id: challenge.challenge_id, signature, label });
        toast.success('지갑 소유권이 확인되었습니다.');
      }
      onSuccess();
      onOpenChange(false);
    } catch (value) {
      const message = value instanceof Error ? value.message : '지갑을 연결하지 못했습니다.';
      setError(message);
      toast.error('지갑 연결 실패', { description: message });
    } finally {
      if (connected?.disconnect) await connected.disconnect().catch(() => undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>지갑 연결</DialogTitle><DialogDescription>서명으로 소유권을 확인하거나 공개 주소를 읽기 전용으로 추가합니다.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === 'signed' ? 'default' : 'outline'} onClick={() => setMode('signed')}>서명 연결</Button>
            <Button type="button" variant={mode === 'watch_only' ? 'default' : 'outline'} onClick={() => setMode('watch_only')}>주소만 추가</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-chain">체인</Label>
            <select id="wallet-chain" className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={chain} onChange={event => setChain(event.target.value as WalletChain)} disabled={pending || capabilities.isPending}>
              {(capabilities.data?.chains ?? []).map(item => <option key={item.chain_id} value={item.chain_id}>{item.chain_id} · {item.caip2_network}</option>)}
            </select>
          </div>
          {mode === 'signed' && <div className="space-y-2">
            <Label>지갑 열기 방식</Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="지갑 열기 방식">
              <Button type="button" variant={connector === 'injected' ? 'default' : 'outline'} onClick={() => setConnector('injected')} disabled={pending}>브라우저 지갑</Button>
              <Button type="button" variant={connector === 'walletconnect' ? 'default' : 'outline'} onClick={() => setConnector('walletconnect')} disabled={pending || !isWalletConnectConfigured()}>WalletConnect QR</Button>
            </div>
            {!isWalletConnectConfigured() && <p className="text-xs text-muted-foreground">이 배포에는 WalletConnect QR이 구성되지 않았습니다. 브라우저 지갑 또는 읽기 전용 주소를 사용해 주세요.</p>}
          </div>}
          {mode === 'watch_only' && <div className="space-y-2"><Label htmlFor="wallet-address">공개 주소</Label><Input id="wallet-address" value={address} onChange={event => setAddress(event.target.value)} required maxLength={128} autoComplete="off" /></div>}
          <div className="space-y-2"><Label htmlFor="wallet-label">별명</Label><Input id="wallet-label" value={label} onChange={event => setLabel(event.target.value)} maxLength={80} placeholder="예: 장기 보관 지갑" /></div>
          {selected && !selected.indexing_available && <Alert><AlertTitle>연결과 수집은 별도 단계입니다</AlertTitle><AlertDescription>현재 {selected.chain_id} 주소의 소유권 또는 공개 주소만 저장됩니다. 체인 인덱서가 제공되기 전에는 거래 내역이 동기화되지 않습니다.</AlertDescription></Alert>}
          {capabilities.isError && <Alert variant="destructive"><AlertTitle>지원 정보를 불러올 수 없습니다</AlertTitle><AlertDescription>잠시 후 다시 시도해 주세요.</AlertDescription></Alert>}
          {error && <Alert variant="destructive"><AlertTitle>연결 실패</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>취소</Button><Button type="submit" disabled={pending || !selected || (mode === 'watch_only' && !address)}>{pending && <Loader2 className="animate-spin" />}{mode === 'signed' ? (connector === 'walletconnect' ? 'QR 지갑으로 서명' : '브라우저 지갑에서 서명') : '읽기 전용 추가'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
