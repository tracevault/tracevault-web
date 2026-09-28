import { afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import fixtures from '../../../tracevault-contracts/http/fixtures/proof-jobs.json';
import batchFixtures from '../../../tracevault-contracts/http/fixtures/proof-batch-jobs.json';
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }), getAccessToken: () => 'owned-access', getRefreshToken: () => null, setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn() }));
import { proofBatchIntentKey, proofIntentKey, requestProof, requestProofBatch } from '@/lib/api/proof';
const owner = fixtures.prepare.data.user_id, reference = fixtures.prepare.data.reference_id;
const reply = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
function storage(): Storage { const map = new Map<string,string>(); return { get length() { return map.size; }, clear: () => map.clear(), getItem: k => map.get(k) ?? null, key: i => [...map.keys()][i] ?? null, removeItem: k => { map.delete(k); }, setItem: (k,v) => { map.set(k,v); } }; }
afterEach(() => vi.unstubAllGlobals());
it('survives a lost submit response and refresh using the same retained input, key and original provider', async () => {
 vi.stubGlobal('crypto', webcrypto); const retained=storage(); const submits: unknown[]=[]; let lost=true;
 const fetcher=vi.fn(async(url: string, init: RequestInit) => {
  if(url.endsWith('/inputs')) return reply(fixtures.prepare.data);
  const body=JSON.parse(init.body as string); submits.push(body);
  if(lost){lost=false;throw new Error('connection lost after accepted submit');}
  return reply({...fixtures.queued.data,request_id:body.request_id,requested_provider:body.provider});
 });vi.stubGlobal('fetch',fetcher);
 await expect(requestProof(owner,'LEDGER_RECORD',reference,'risc0-source-v1',new AbortController().signal,retained)).rejects.toThrow('connection lost');
 const job=await requestProof(owner,'LEDGER_RECORD',reference,'different-default',new AbortController().signal,retained);
 expect(submits).toHaveLength(2);expect(submits[0]).toEqual(submits[1]);expect(fetcher.mock.calls.filter(([u])=>u.endsWith('/inputs'))).toHaveLength(1);
 expect(JSON.parse(retained.getItem(proofIntentKey(owner,'LEDGER_RECORD',reference))!).job_id).toBe(job.id);
 fetcher.mockImplementation(async()=>reply(job));
 await requestProof(owner,'LEDGER_RECORD',reference,'different-default',new AbortController().signal,retained);
 expect(fetcher.mock.lastCall![0]).toMatch(new RegExp(`/jobs/${job.id}$`));expect(submits).toHaveLength(2);
});
it('never submits when durable local key storage fails',async()=>{
 vi.stubGlobal('crypto',webcrypto);const retained=storage();retained.setItem=()=>{throw new Error('quota');};const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(requestProof(owner,'LEDGER_RECORD',reference,'risc0-source-v1',new AbortController().signal,retained)).rejects.toThrow('quota');expect(fetcher).not.toHaveBeenCalled();
});
it('aborts an old account before a prepared response can submit a job',async()=>{
 vi.stubGlobal('crypto',webcrypto);const controller=new AbortController();const retained=storage();const fetcher=vi.fn(async()=>{controller.abort();return reply(fixtures.prepare.data);});vi.stubGlobal('fetch',fetcher);
 await expect(requestProof(owner,'LEDGER_RECORD',reference,'risc0-source-v1',controller.signal,retained)).rejects.toMatchObject({name:'AbortError'});expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(retained.getItem(proofIntentKey(owner,'LEDGER_RECORD',reference))!).input).toBeUndefined();
});
it('rejects foreign prepared input and keeps account storage namespaces separate',async()=>{
 vi.stubGlobal('crypto',webcrypto);const retained=storage();const fetcher=vi.fn(async()=>reply({...fixtures.prepare.data,user_id:'other'}));vi.stubGlobal('fetch',fetcher);
 await expect(requestProof(owner,'LEDGER_RECORD',reference,'risc0-source-v1',new AbortController().signal,retained)).rejects.toThrow('계정');expect(fetcher).toHaveBeenCalledTimes(1);expect(proofIntentKey(owner,'LEDGER_RECORD',reference)).not.toBe(proofIntentKey('other','LEDGER_RECORD',reference));
});
it('replays a lost durable batch submit with the exact ordered items and key', async () => {
 vi.stubGlobal('crypto', webcrypto); const retained=storage(); const submits: unknown[]=[]; let lost=true;
 const items=batchFixtures.queued.data.items.map(({input_id,expected_sha256})=>({input_id,expected_sha256}));
 const fetcher=vi.fn(async(url: string, init: RequestInit) => {
  if(url.includes('/batch-jobs/') && init.method !== 'POST') return reply({...batchFixtures.queued.data,request_id:(submits[0] as {request_id:string}).request_id});
  const body=JSON.parse(init.body as string);submits.push(body);if(lost){lost=false;throw new Error('connection lost after accepted batch');}
  return reply({...batchFixtures.queued.data,request_id:body.request_id,requested_provider:body.provider});
 });vi.stubGlobal('fetch',fetcher);
 await expect(requestProofBatch(owner,items,'risc0-source-v1',new AbortController().signal,retained)).rejects.toThrow('connection lost');
 const job=await requestProofBatch(owner,items,'risc0-source-v1',new AbortController().signal,retained);
 expect(submits).toHaveLength(2);expect(submits[0]).toEqual(submits[1]);expect(JSON.parse(retained.getItem(proofBatchIntentKey(owner,'risc0-source-v1',items))!).job_id).toBe(job.id);
 await requestProofBatch(owner,items,'risc0-source-v1',new AbortController().signal,retained);
 expect(fetcher.mock.lastCall![0]).toMatch(new RegExp(`/batch-jobs/${job.id}$`));expect(submits).toHaveLength(2);
});
it('rejects duplicate durable batch inputs before storage or network mutation', async () => {
 vi.stubGlobal('crypto', webcrypto);const retained=storage();const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const item={input_id:batchFixtures.queued.data.items[0].input_id,expected_sha256:batchFixtures.queued.data.items[0].expected_sha256};
 await expect(requestProofBatch(owner,[item,item],'risc0-source-v1',new AbortController().signal,retained)).rejects.toThrow('서로 다른');expect(retained.length).toBe(0);expect(fetcher).not.toHaveBeenCalled();
});
