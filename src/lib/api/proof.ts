import { apiClient, apiFile } from './client';
import type { FrozenProof, FrozenProofBatchItemRequest, FrozenProofBatchJob, ProofInputSnapshot, ProofJob, ProofSourceKind, SubmitFrozenProofBatchJobRequest, SubmitProofJobRequest } from '@/types/proof';

const base = '/api/v1/proofs';
export function proofArtifact(proof: FrozenProof, part: 'receipt' | 'statement' | 'manifest') {
  if (part === 'manifest') return proof.verification_manifest;
  return { filename: `proof-${proof.id}.${part === 'receipt' ? 'receipt.bin' : 'statement.pb'}`, media_type: 'application/octet-stream', size_bytes: part === 'receipt' ? proof.size_bytes : proof.public_inputs_size_bytes, sha256: part === 'receipt' ? proof.proof_hash : proof.public_inputs_sha256 };
}
export function downloadProof(proof: FrozenProof, part: 'receipt' | 'statement' | 'manifest', signal: AbortSignal) {
  return apiFile(`${base}/${encodeURIComponent(proof.id)}/${part}`, proofArtifact(proof, part), signal, { code: 'INVALID_PROOF_FILE', message: '증명 파일의 내용이나 검증 정보가 일치하지 않습니다. 다시 내려받아 주세요.' });
}
interface Intent { request_id: string; provider: string; input?: ProofInputSnapshot; job_id?: string }
export function proofIntentKey(owner: string, kind: ProofSourceKind, reference: string) { return `tracevault-proof-request:${owner}:${kind}:${reference}`; }

/** Save the idempotency key before any network mutation. A lost submit response is
 * retried with the same retained input and key, including after page refresh. */
export async function requestProof(owner: string, kind: ProofSourceKind, reference: string, provider: string, signal: AbortSignal, storage: Storage, fresh = false, expectedSourceDigest?: string): Promise<ProofJob> {
  const key = proofIntentKey(owner, kind, reference);
  const raw = fresh ? null : storage.getItem(key);
  let intent: Intent;
  if (raw) {
    intent = JSON.parse(raw) as Intent;
    if (!intent.request_id || !intent.provider) throw new Error('저장된 증명 요청 정보를 읽을 수 없습니다.');
  } else {
    intent = { request_id: crypto.randomUUID(), provider };
    storage.setItem(key, JSON.stringify(intent));
  }
  signal.throwIfAborted();
  if (intent.job_id) {
    const job = await apiClient<ProofJob>(`${base}/jobs/${encodeURIComponent(intent.job_id)}`, { signal });
    signal.throwIfAborted();
    if (job.user_id !== owner || job.request_id !== intent.request_id) throw new Error('증명 요청의 계정을 확인할 수 없습니다.');
    return job;
  }
  if (!intent.input) {
    const input = await apiClient<ProofInputSnapshot>(`${base}/inputs`, { method: 'POST', signal, body: JSON.stringify({ source_kind: kind, reference_id: reference, ...(expectedSourceDigest ? { expected_source_digest: expectedSourceDigest } : {}) }) });
    signal.throwIfAborted();
    if (input.user_id !== owner || input.reference_id !== reference || input.source_kind !== kind) throw new Error('증명 입력의 계정을 확인할 수 없습니다.');
    intent = { ...intent, input };
    storage.setItem(key, JSON.stringify(intent));
  }
  const retained = intent.input;
  if (!retained) throw new Error('보존한 입력을 확인할 수 없습니다.');
  const body: SubmitProofJobRequest = { request_id: intent.request_id, input_id: retained.id, expected_sha256: retained.sha256, provider: intent.provider };
  signal.throwIfAborted();
  const job = await apiClient<ProofJob>(`${base}/jobs`, { method: 'POST', signal, body: JSON.stringify(body) });
  signal.throwIfAborted();
  if (job.user_id !== owner || job.request_id !== intent.request_id || job.input_id !== retained.id || job.expected_sha256 !== retained.sha256) throw new Error('증명 작업의 입력을 확인할 수 없습니다.');
  storage.setItem(key, JSON.stringify({ ...intent, job_id: job.id }));
  return job;
}

interface BatchIntent { request_id: string; provider: string; items: FrozenProofBatchItemRequest[]; job_id?: string }
export function proofBatchIntentKey(owner: string, provider: string, items: FrozenProofBatchItemRequest[]) {
  return `tracevault-proof-batch:${owner}:${encodeURIComponent(provider)}:${items.map(item => `${item.input_id}:${item.expected_sha256}`).join(',')}`;
}

/** Preserve the ordered item set and idempotency key before submitting. A
 * refresh or lost response therefore resumes the same durable batch job. */
export async function requestProofBatch(owner: string, items: FrozenProofBatchItemRequest[], provider: string, signal: AbortSignal, storage: Storage, fresh = false): Promise<FrozenProofBatchJob> {
  if (items.length < 1 || items.length > 8 || new Set(items.map(item => item.input_id)).size !== items.length) throw new Error('배치 입력은 서로 다른 1~8개여야 합니다.');
  const key = proofBatchIntentKey(owner, provider, items);
  const raw = fresh ? null : storage.getItem(key);
  let intent: BatchIntent;
  if (raw) {
    intent = JSON.parse(raw) as BatchIntent;
    if (!intent.request_id || intent.provider !== provider || JSON.stringify(intent.items) !== JSON.stringify(items)) throw new Error('저장된 배치 증명 요청 정보를 읽을 수 없습니다.');
  } else {
    intent = { request_id: crypto.randomUUID(), provider, items };
    storage.setItem(key, JSON.stringify(intent));
  }
  signal.throwIfAborted();
  if (intent.job_id) {
    const job = await apiClient<FrozenProofBatchJob>(`${base}/batch-jobs/${encodeURIComponent(intent.job_id)}`, { signal });
    signal.throwIfAborted();
    if (job.user_id !== owner || job.request_id !== intent.request_id || JSON.stringify(job.items.map(item => ({ input_id: item.input_id, expected_sha256: item.expected_sha256 }))) !== JSON.stringify(items)) throw new Error('배치 증명 작업의 계정과 입력을 확인할 수 없습니다.');
    return job;
  }
  const body: SubmitFrozenProofBatchJobRequest = { request_id: intent.request_id, items: intent.items, provider: intent.provider };
  const job = await apiClient<FrozenProofBatchJob>(`${base}/batch-jobs`, { method: 'POST', signal, body: JSON.stringify(body) });
  signal.throwIfAborted();
  if (job.user_id !== owner || job.request_id !== intent.request_id || job.provider !== provider || JSON.stringify(job.items.map(item => ({ input_id: item.input_id, expected_sha256: item.expected_sha256 }))) !== JSON.stringify(items)) throw new Error('배치 증명 작업의 입력을 확인할 수 없습니다.');
  storage.setItem(key, JSON.stringify({ ...intent, job_id: job.id }));
  return job;
}
