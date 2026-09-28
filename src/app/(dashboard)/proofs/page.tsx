'use client';
import { proofErrorText } from '@/components/proof/messages';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { downloadProof, proofArtifact, requestProofBatch } from '@/lib/api/proof';
import { proofStates } from '@/components/proof/proof-request';
import type { FrozenProof, FrozenProofBatchJob, FrozenProofBatchJobList, ProofBatch, ProofBatchList, ProofJob, ProofJobList, ProofVerification } from '@/types/proof';

export default function ProofsPage() { return <Suspense fallback={<p role="status">증명 작업을 불러오는 중…</p>}><OwnedPage /></Suspense>; }
function OwnedPage() {
  const owner = useAuthStore(s => s.user?.id); const search = useSearchParams();
  return owner ? <Proofs key={owner} owner={owner} initialJob={search.get('job') ?? ''} /> : null;
}
function Proofs({ owner, initialJob }: { owner: string; initialJob: string }) {
  const [offsets, setOffsets] = useState<string[]>(['0']); const [selected, setSelected] = useState(initialJob);
  const [batchInputs, setBatchInputs] = useState<string[]>([]);
  const offset = offsets.at(-1)!;
  const jobs = useQuery({ queryKey: ['proof-jobs', owner, offset], queryFn: ({ signal }) => apiClient<ProofJobList>(`/api/v1/proofs/jobs?limit=20&offset=${offset}`, { signal }), retry: false, refetchInterval: 5000 });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">증명 작업</h1><p className="mt-2 text-sm text-muted-foreground">접수된 작업은 화면을 닫아도 계속됩니다. 보존된 원본 거래 또는 계산 기록의 증명을 생성하고 검증합니다.</p></div>
    <p className="text-sm">새 증명은 <Link className="underline" href="/ledger">원장 거래</Link> 또는 <Link className="underline" href="/tax">보존한 계산 결과</Link>에서 요청하세요.</p>
    <Button variant="outline" disabled={jobs.isFetching} onClick={() => jobs.refetch()}>작업 목록 새로고침</Button>
    {jobs.isLoading && <p role="status">작업 목록을 불러오는 중…</p>}{jobs.error && <p role="alert" className="text-red-600">{proofErrorText(jobs.error)}</p>}
    {jobs.data && <><p className="text-sm">전체 {jobs.data.total_count}개 · 배치 입력 {batchInputs.length}/8개 선택</p>{jobs.data.jobs.length === 0 ? <p>접수된 증명 작업이 없습니다.</p> : <ul className="space-y-2">{jobs.data.jobs.map(job => { const checked = batchInputs.includes(job.id); const selectedJobs = jobs.data.jobs.filter(candidate => batchInputs.includes(candidate.id)); const incompatible = !checked && (batchInputs.length >= 8 || selectedJobs.some(candidate => candidate.provider !== job.provider) || selectedJobs.some(candidate => candidate.input_id === job.input_id)); return <li key={job.id} className="rounded-lg border p-4 flex gap-3"><input type="checkbox" className="mt-1" aria-label={`배치 입력 선택 ${job.id}`} checked={checked} disabled={incompatible} onChange={() => setBatchInputs(value => checked ? value.filter(id => id !== job.id) : [...value, job.id])} /><button className="w-full text-left space-y-1" aria-pressed={selected === job.id} onClick={() => setSelected(job.id)}><span className="block font-medium">{proofStates[job.state]} · {new Date(job.created_at).toLocaleString('ko-KR')}</span><span className="block text-xs text-muted-foreground break-all">{job.id} · {job.provider} · 시도 {job.attempts}/{job.max_attempts}</span></button></li>; })}</ul>}<div className="flex gap-2"><Button variant="outline" disabled={offsets.length === 1 || jobs.isFetching} onClick={() => { setBatchInputs([]); setOffsets(v => v.slice(0, -1)); }}>더 최근 작업</Button><Button variant="outline" disabled={!jobs.data.has_more || jobs.isFetching} onClick={() => { if (jobs.data?.has_more) { setBatchInputs([]); setOffsets(v => [...v, jobs.data.next_offset]); } }}>더 오래된 작업</Button>{batchInputs.length > 0 && <Button variant="outline" onClick={() => setBatchInputs([])}>선택 해제</Button>}</div></>}
    {selected && <JobDetail key={`${owner}:${selected}`} owner={owner} id={selected} onChanged={() => jobs.refetch()} />}
    <BatchJobs owner={owner} candidates={jobs.data?.jobs ?? []} selectedIds={batchInputs} onChanged={() => jobs.refetch()} />
    <BatchHistory owner={owner} />
  </div>;
}

function BatchJobs({ owner, candidates, selectedIds, onChanged }: { owner: string; candidates: ProofJob[]; selectedIds: string[]; onChanged: () => void }) {
  const [selected, setSelected] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const chosen = candidates.filter(job => selectedIds.includes(job.id));
  const jobs = useQuery({ queryKey: ['proof-batch-jobs', owner], queryFn: ({ signal }) => apiClient<FrozenProofBatchJobList>('/api/v1/proofs/batch-jobs?limit=20&offset=0', { signal }), retry: false, refetchInterval: 5000 });
  const detail = useQuery({ queryKey: ['proof-batch-job', owner, selected], queryFn: ({ signal }) => apiClient<FrozenProofBatchJob>(`/api/v1/proofs/batch-jobs/${encodeURIComponent(selected)}`, { signal }), enabled: !!selected, retry: false, refetchInterval: query => ['QUEUED', 'RUNNING'].includes(query.state.data?.state ?? '') ? 3000 : false });
  useEffect(() => { const unsubscribe = useAuthStore.subscribe(state => { if (state.user?.id !== owner) active.current?.abort(); }); return () => { unsubscribe(); active.current?.abort(); }; }, [owner]);
  async function submit(fresh = false) {
    if (chosen.length < 1 || active.current || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current = controller; setBusy('submit'); setError('');
    try {
      const result = await requestProofBatch(owner, chosen.map(job => ({ input_id: job.input_id, expected_sha256: job.expected_sha256 })), chosen[0].provider, controller.signal, localStorage, fresh);
      if (!controller.signal.aborted && useAuthStore.getState().user?.id === owner) { setSelected(result.id); await jobs.refetch(); onChanged(); }
    } catch (cause) { if (!controller.signal.aborted) setError(proofErrorText(cause)); }
    finally { if (!controller.signal.aborted) setBusy(''); if (active.current === controller) active.current = null; }
  }
  async function cancel() {
    if (!selected || active.current || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current = controller; setBusy('cancel'); setError('');
    try {
      await apiClient<FrozenProofBatchJob>(`/api/v1/proofs/batch-jobs/${encodeURIComponent(selected)}/cancel`, { method: 'POST', signal: controller.signal });
      if (!controller.signal.aborted && useAuthStore.getState().user?.id === owner) { await Promise.all([detail.refetch(), jobs.refetch()]); }
    } catch (cause) { if (!controller.signal.aborted) setError(proofErrorText(cause)); }
    finally { if (!controller.signal.aborted) setBusy(''); if (active.current === controller) active.current = null; }
  }
  return <section className="space-y-4 border-t pt-6" aria-label="암호학적 배치 증명 작업">
    <div><h2 className="text-xl font-semibold">암호학적 배치 작업</h2><p className="mt-1 text-sm text-muted-foreground">위 작업에서 같은 실행기의 서로 다른 입력 1~8개를 선택하세요. 각 입력을 따로 암호학적으로 증명한 뒤 모두 성공한 경우에만 한 배치로 보존합니다. Merkle 루트는 포함 관계를 나타내며 재귀형 통합 증명은 아닙니다.</p></div>
    <div className="flex flex-wrap gap-2"><Button disabled={chosen.length < 1 || !!busy} onClick={() => submit()}>{busy === 'submit' ? '배치 접수 확인 중…' : `선택한 ${chosen.length}개 배치 증명 요청`}</Button><Button variant="outline" disabled={jobs.isFetching} onClick={() => jobs.refetch()}>배치 작업 새로고침</Button></div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {jobs.isLoading && <p role="status">배치 작업을 불러오는 중…</p>}{jobs.error && <p role="alert" className="text-red-600">{proofErrorText(jobs.error)}</p>}
    {jobs.data && (jobs.data.jobs.length === 0 ? <p>접수된 암호학적 배치 작업이 없습니다.</p> : <ul className="space-y-2">{jobs.data.jobs.map(job => <li key={job.id} className="rounded-lg border p-4"><button className="w-full text-left space-y-1" aria-pressed={selected === job.id} onClick={() => setSelected(job.id)}><span className="block font-medium">{proofStates[job.state]} · 입력 {job.items.length}개</span><span className="block text-xs text-muted-foreground break-all">{new Date(job.created_at).toLocaleString('ko-KR')} · {job.provider} · {job.id}</span></button></li>)}</ul>)}
    {selected && <div className="rounded-xl border p-5 space-y-3" aria-label="선택한 암호학적 배치 작업">{detail.isLoading && <p role="status">배치 작업 상태 확인 중…</p>}{detail.error && <div><p role="alert" className="text-red-600">{proofErrorText(detail.error)}</p><Button variant="outline" onClick={() => detail.refetch()}>배치 작업 다시 확인</Button></div>}{detail.data && <><h3 className="font-semibold">{proofStates[detail.data.state]} · 시도 {detail.data.attempts}/{detail.data.max_attempts}</h3><p className="text-xs break-all text-muted-foreground">작업 번호 {detail.data.id}</p>{['QUEUED', 'RUNNING'].includes(detail.data.state) && <Button variant="outline" disabled={!!busy} onClick={cancel}>{busy === 'cancel' ? '취소 확인 중…' : '배치 작업 취소'}</Button>}{detail.data.state === 'FAILED' && <p role="alert">항목 하나 이상을 증명하지 못해 어떤 결과도 공개하지 않았습니다.</p>}{detail.data.state === 'CANCELLED' && <p>취소된 작업에서는 증명과 배치가 공개되지 않습니다.</p>}{detail.data.state === 'COMPLETED' && <><p>모든 항목의 개별 증명과 배치 포함 관계를 원자적으로 보존했습니다.</p><p className="text-xs break-all text-muted-foreground">배치 번호 {detail.data.batch_id}</p></>}<ol className="space-y-1 text-xs text-muted-foreground">{detail.data.items.map(item => <li key={item.input_id} className="break-all">입력 {item.input_index} · {item.input_id}{item.proof_id ? ` · 증명 ${item.proof_id}` : ''}</li>)}</ol>{['COMPLETED', 'FAILED', 'CANCELLED'].includes(detail.data.state) && chosen.length > 0 && <Button variant="outline" disabled={!!busy} onClick={() => submit(true)}>별도 배치 새로 요청</Button>}</>}</div>}
  </section>;
}

const batchStates: Record<ProofBatch['status'], string> = {
  PENDING: '대기', PROCESSING: '처리 중', COMPLETED: '완료', PARTIAL_FAILURE: '일부 실패', FAILED: '실패',
};

function BatchHistory({ owner }: { owner: string }) {
  const [offsets, setOffsets] = useState<string[]>(['0']);
  const [selected, setSelected] = useState('');
  const offset = offsets.at(-1)!;
  const batches = useQuery({ queryKey: ['proof-batches', owner, offset], queryFn: ({ signal }) => apiClient<ProofBatchList>(`/api/v1/proofs/batches?limit=20&offset=${offset}`, { signal }), retry: false });
  const detail = useQuery({ queryKey: ['proof-batch', owner, selected], queryFn: ({ signal }) => apiClient<ProofBatch>(`/api/v1/proofs/batches/${encodeURIComponent(selected)}`, { signal }), enabled: !!selected, retry: false });
  return <section className="space-y-4 border-t pt-6" aria-label="증명 배치 기록">
    <div><h2 className="text-xl font-semibold">배치 기록</h2><p className="mt-1 text-sm text-muted-foreground">배치 루트는 보존된 증명들의 순서와 포함 관계를 확인합니다. 배치 자체가 원본의 진위나 계산의 정확성을 암호학적으로 증명하지는 않습니다.</p></div>
    <Button variant="outline" disabled={batches.isFetching} onClick={() => batches.refetch()}>배치 목록 새로고침</Button>
    {batches.isLoading && <p role="status">배치 목록을 불러오는 중…</p>}
    {batches.error && <p role="alert" className="text-red-600">{proofErrorText(batches.error)}</p>}
    {batches.data && <><p className="text-sm">전체 {batches.data.total_count}개</p>{batches.data.batches.length === 0 ? <p>보존된 배치가 없습니다.</p> : <ul className="space-y-2">{batches.data.batches.map(batch => <li key={batch.id} className="rounded-lg border p-4"><button className="w-full text-left space-y-1" aria-pressed={selected === batch.id} onClick={() => setSelected(batch.id)}><span className="block font-medium">{batchStates[batch.status]} · 성공 {batch.successful_count}/{batch.batch_size}</span><span className="block text-xs text-muted-foreground break-all">{new Date(batch.created_at).toLocaleString('ko-KR')} · {batch.provider} · {batch.id}</span></button></li>)}</ul>}<div className="flex gap-2"><Button variant="outline" disabled={offsets.length === 1 || batches.isFetching} onClick={() => setOffsets(v => v.slice(0, -1))}>더 최근 배치</Button><Button variant="outline" disabled={!batches.data.has_more || batches.isFetching} onClick={() => { if (batches.data?.has_more) setOffsets(v => [...v, batches.data.next_offset]); }}>더 오래된 배치</Button></div></>}
    {selected && <div className="rounded-xl border p-5 space-y-3" aria-label="선택한 증명 배치"><h3 className="font-semibold">선택한 배치</h3>{detail.isLoading && <p role="status">배치 내용을 확인하는 중…</p>}{detail.error && <div><p role="alert" className="text-red-600">{proofErrorText(detail.error)}</p><Button variant="outline" onClick={() => detail.refetch()}>배치 다시 확인</Button></div>}{detail.data && <><p>{batchStates[detail.data.status]} · 성공 {detail.data.successful_count}건 · 실패 {detail.data.failed_count}건</p><p className="text-xs break-all text-muted-foreground">Merkle 루트 {detail.data.batch_merkle_root}</p>{Object.keys(detail.data.errors).length > 0 && <ul className="text-sm text-red-600">{Object.entries(detail.data.errors).map(([index, message]) => <li key={index}>입력 {index}: {message}</li>)}</ul>}<ol className="space-y-1 text-xs text-muted-foreground">{detail.data.items.map(item => <li key={item.proof_id} className="break-all">잎 {item.leaf_index} · 입력 {item.input_index} · 증명 {item.proof_id}</li>)}</ol></>}</div>}
  </section>;
}
function JobDetail({ owner, id, onChanged }: { owner: string; id: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const active = useRef<AbortController | null>(null);
  const job = useQuery({ queryKey: ['proof-job', owner, id], queryFn: ({ signal }) => apiClient<ProofJob>(`/api/v1/proofs/jobs/${encodeURIComponent(id)}`, { signal }), retry: false, refetchInterval: q => ['QUEUED', 'RUNNING'].includes(q.state.data?.state ?? '') ? 3000 : false });
  const proofId = job.data?.proof_id;
  const proof = useQuery({ queryKey: ['frozen-proof', owner, proofId], queryFn: ({ signal }) => apiClient<FrozenProof>(`/api/v1/proofs/${encodeURIComponent(proofId!)}`, { signal }), enabled: !!proofId, retry: false });
  useEffect(() => { const unsubscribe = useAuthStore.subscribe(s => { if (s.user?.id !== owner) active.current?.abort(); }); return () => { unsubscribe(); active.current?.abort(); }; }, [owner]);
  async function action(kind: 'cancel' | 'verify' | 'receipt' | 'statement' | 'manifest') {
    if (active.current || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current = controller; setBusy(kind); setError(''); setNotice('');
    try {
      if (kind === 'cancel') { await apiClient<ProofJob>(`/api/v1/proofs/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', signal: controller.signal }); }
      else if (kind === 'verify') {
        const result = await apiClient<ProofVerification>(`/api/v1/proofs/${encodeURIComponent(proofId!)}/verify`, { method: 'POST', signal: controller.signal });
        if (!controller.signal.aborted && useAuthStore.getState().user?.id === owner) setNotice(result.valid ? '보존한 입력에 대한 증명 검증이 통과했습니다. 최신성·출처 진위·세법 적합성은 검증 범위에 포함되지 않습니다.' : '증명 검증에 실패했습니다. 유효한 증명으로 사용할 수 없습니다.');
      } else if (proof.data) {
        const blob = await downloadProof(proof.data, kind, controller.signal); controller.signal.throwIfAborted();
        if (useAuthStore.getState().user?.id !== owner) return;
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = proofArtifact(proof.data, kind).filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('파일의 길이와 체크섬을 확인하여 브라우저에 전달했습니다.');
      }
      if (!controller.signal.aborted && useAuthStore.getState().user?.id === owner) { await job.refetch(); onChanged(); }
    } catch (e) { if (!controller.signal.aborted) setError(proofErrorText(e)); }
    finally { if (!controller.signal.aborted) setBusy(''); if (active.current === controller) active.current = null; }
  }
  return <section className="space-y-4 rounded-xl border p-5" aria-label="선택한 증명 작업"><h2 className="font-semibold">선택한 증명 작업</h2>
    {job.isLoading && <p role="status">작업 상태 확인 중…</p>}{job.error && <div><p role="alert">{proofErrorText(job.error)}</p><Button variant="outline" onClick={() => job.refetch()}>작업 상태 다시 확인</Button></div>}
    {job.data && <><p role="status">{proofStates[job.data.state]} · 시도 {job.data.attempts}/{job.data.max_attempts}</p><p className="text-xs break-all text-muted-foreground">작업 번호 {job.data.id}</p>{['QUEUED', 'RUNNING'].includes(job.data.state) && <Button variant="outline" disabled={!!busy} onClick={() => action('cancel')}>{busy === 'cancel' ? '취소 확인 중…' : '작업 취소'}</Button>}{job.data.state === 'FAILED' && <p role="alert">증명을 생성하지 못했습니다. 입력과 서비스 상태를 확인한 뒤 원본 거래 또는 계산 결과에서 새로 요청해 주세요.</p>}{job.data.state === 'CANCELLED' && <p>이 요청은 취소되었습니다. 새 요청은 원본 거래 또는 계산 결과에서 시작할 수 있습니다.</p>}</>}
    {proof.isLoading && <p role="status">증명 결과 확인 중…</p>}{proof.error && <div><p role="alert">{proofErrorText(proof.error)}</p><Button variant="outline" onClick={() => proof.refetch()}>증명 결과 다시 확인</Button></div>}
    {proof.data && <><h3 className="font-medium">보존된 증명</h3><p className="text-sm">{proof.data.input_binding.source_kind === 'ACCOUNTING_RUN' ? '계산 기록 · 입력 연결 및 처분 산식·합계' : '원본 거래 · 입력 연결'}에 대한 증명입니다. 최신 상태·출처 진위·세법 적합성을 인증하지 않습니다.</p><div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => action('verify')}>{busy === 'verify' ? '실제 증명 검증 중…' : '증명 검증'}</Button><Button variant="outline" disabled={!!busy} onClick={() => action('receipt')}>증명 파일 다운로드</Button><Button variant="outline" disabled={!!busy} onClick={() => action('statement')}>공개 검증 정보 다운로드</Button><Button variant="outline" disabled={!!busy} onClick={() => action('manifest')}>검증 설정 다운로드</Button></div><details className="text-xs text-muted-foreground"><summary>검증 정보</summary><p className="break-all mt-2">입력: {proof.data.input_binding.sha256}</p><p className="break-all">증명: {proof.data.proof_hash}</p><p>실행기: {proof.data.provider}</p>{proof.data.verification_context ? <><p className="break-all">프로그램: {proof.data.verification_context.program_image_id}</p><p>검증 형식: {proof.data.verification_context.receipt_encoding} · SDK {proof.data.verification_context.sdk_version}</p></> : <p>이전 기록에는 프로그램 식별 정보가 없습니다. 별도로 지정한 이전 검증기가 필요합니다.</p>}<p>확인 범위: {proof.data.statement?.assertions.join(', ') ?? '실행기 공개 검증 정보 참조'}</p></details></>}
    {error && <p role="alert" className="text-red-600">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
