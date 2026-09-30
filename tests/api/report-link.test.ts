import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reportPath, reportReturnPath } from '../../src/lib/report-link';
import { findRetainedReport } from '../../src/lib/api/retained-report';
import { apiClient } from '../../src/lib/api/client';
vi.mock('../../src/lib/api/client', () => ({ apiClient: vi.fn() }));
const report='11111111-1111-4111-8111-111111111111',run='22222222-2222-4222-8222-222222222222';
beforeEach(()=>vi.mocked(apiClient).mockReset());
describe('owned report navigation',()=>{
 it('restores only a validated internal report route',()=>{
  const path=reportPath(report,run)!;expect(reportReturnPath(path)).toBe(path);
  for(const x of ['https://evil.test'+path,'//evil.test'+path,path+'&run_id='+run,path+'&next=https://evil.test',path+'#x','/tax/reports/not-a-uuid?run_id='+run])expect(reportReturnPath(x)).toBeNull();
 });
 it('finds an old report beyond the first page without recalculation',async()=>{
  vi.mocked(apiClient).mockResolvedValueOnce({run:{id:run}}).mockResolvedValueOnce({reports:[],has_more:true,next_before_report_id:'33333333-3333-4333-8333-333333333333'}).mockResolvedValueOnce({reports:[{id:report,run_id:run,purpose:'ACCOUNTING_ONLY'}],has_more:false});
  expect((await findRetainedReport(report,run,new AbortController().signal)).report.id).toBe(report);
  expect(vi.mocked(apiClient).mock.calls[0][0]).toContain('check_current=false');
  expect(vi.mocked(apiClient).mock.calls[2][0]).toContain('before_report_id=');
  expect(vi.mocked(apiClient).mock.calls.every(([,options])=>typeof options !== 'function' && !options?.method)).toBe(true);
 });
 it('does not hide a foreign-owner lookup failure or regenerate',async()=>{
  const error=new Error('owned run not found');vi.mocked(apiClient).mockRejectedValueOnce(error);
  await expect(findRetainedReport(report,run,new AbortController().signal)).rejects.toBe(error);expect(apiClient).toHaveBeenCalledTimes(1);
 });
 it('rejects a mismatched artifact and a repeating cursor',async()=>{
  vi.mocked(apiClient).mockResolvedValueOnce({run:{id:run}}).mockResolvedValueOnce({reports:[{id:report,run_id:report,purpose:'ACCOUNTING_ONLY'}]});
  await expect(findRetainedReport(report,run,new AbortController().signal)).rejects.toThrow('일치');
  vi.mocked(apiClient).mockReset();vi.mocked(apiClient).mockResolvedValueOnce({run:{id:run}}).mockResolvedValue({reports:[],has_more:true,next_before_report_id:report});
  await expect(findRetainedReport(report,run,new AbortController().signal)).rejects.toThrow('계속');expect(apiClient).toHaveBeenCalledTimes(3);
 });
});
