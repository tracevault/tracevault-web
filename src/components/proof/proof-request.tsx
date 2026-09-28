'use client';
import { proofErrorText } from '@/components/proof/messages';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { requestProof } from '@/lib/api/proof';
import type { ProofJob, ProofProviders, ProofSourceKind } from '@/types/proof';

export const proofStates = { QUEUED: '대기 중', RUNNING: '증명 생성 중', COMPLETED: '완료', FAILED: '실패', CANCELLED: '취소됨' };
export function ProofRequest(props: { kind: ProofSourceKind; reference: string; expectedDigest?: string }) {
  const owner = useAuthStore(s => s.user?.id);
  return owner ? <OwnedProofRequest key={`${owner}:${props.kind}:${props.reference}`} {...props} owner={owner} /> : null;
}
function OwnedProofRequest({ owner, kind, reference, expectedDigest }: { owner: string; kind: ProofSourceKind; reference: string; expectedDigest?: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [job, setJob] = useState<ProofJob>();
  const active = useRef<AbortController | null>(null);
  const providers = useQuery({ queryKey: ['proof-providers', owner], queryFn: ({ signal }) => apiClient<ProofProviders>('/api/v1/proofs/providers', { signal }), retry: false });
  const eligible = providers.data?.providers.filter(p => p.capabilities.proof_assurance === 'cryptographic' && p.capabilities.frozen_input_versions?.split(',').includes('proof-input-v1') && p.capabilities.durable_frozen_jobs === 'true' && p.supported_types.includes(kind === 'LEDGER_RECORD' ? 'LEDGER_EVENT' : 'ACCOUNTING_RUN'));
  const provider = eligible?.find(p => p.name === providers.data?.default_provider) ?? eligible?.[0];
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(s => { if (s.user?.id !== owner) active.current?.abort(); });
    return () => { unsubscribe(); active.current?.abort(); };
  }, [owner]);
  async function submit(fresh = false) {
    if (!provider || active.current && !active.current.signal.aborted || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError('');
    try {
      const result = await requestProof(owner, kind, reference, provider.name, controller.signal, localStorage, fresh, expectedDigest);
      if (!controller.signal.aborted && useAuthStore.getState().user?.id === owner) setJob(result);
    } catch (e) { if (!controller.signal.aborted) setError(proofErrorText(e)); }
    finally { if (!controller.signal.aborted) setBusy(false); if (active.current === controller) active.current = null; }
  }
  return <section className="space-y-3 rounded-lg border p-4" aria-label="증명 요청">
    <h3 className="font-semibold">{kind === 'LEDGER_RECORD' ? '원본 거래 증명' : '계산 기록 증명'}</h3>
    <p className="text-sm text-muted-foreground">{kind === 'LEDGER_RECORD' ? '보존한 원본 거래와 증명의 연결을 확인합니다. 이후의 정정 내용은 포함하지 않습니다.' : '보존한 계산 기록과 증명의 연결, 처분 금액의 산식과 합계를 확인합니다.'} 최신 상태, 거래 출처의 진위 또는 세법 적합성을 인증하지 않습니다.</p>
    {providers.isLoading && <p role="status">증명 서비스 확인 중…</p>}
    {providers.error && <p role="alert">증명 서비스에 연결하지 못했습니다. <button className="underline" onClick={() => providers.refetch()}>다시 확인</button></p>}
    {providers.data && !provider && <p role="status">이 입력을 처리할 수 있는 실제 증명 실행기가 현재 제공되지 않습니다.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={!provider || busy} onClick={() => submit()}>{busy ? '입력 보존·접수 확인 중…' : '증명 요청 · 기존 접수 확인'}</Button>{job && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.state) && <Button variant="outline" disabled={busy} onClick={() => submit(true)}>별도 증명 새로 요청</Button>}</div>
    {busy && <p role="status" className="text-sm">입력을 보존하는 데 시간이 걸릴 수 있습니다. 접수된 작업은 화면을 닫아도 계속 실행됩니다.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error} 다시 누르면 같은 요청 번호로 접수 여부를 확인합니다.</p>}
    {job && <p role="status" className="text-sm">{proofStates[job.state]} · <Link className="underline" href={`/proofs?job=${encodeURIComponent(job.id)}`}>증명 작업 보기</Link></p>}
  </section>;
}
