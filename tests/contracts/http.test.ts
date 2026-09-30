import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../../tracevault-contracts/http/openapi.json';
import notification from '../../../tracevault-contracts/http/fixtures/notifications.json';
import proofContext from '../../../tracevault-contracts/http/fixtures/proof-verification-context.json';
import proofJobs from '../../../tracevault-contracts/http/fixtures/proof-jobs.json';
import proofBatchJobs from '../../../tracevault-contracts/http/fixtures/proof-batch-jobs.json';
import proofBatches from '../../../tracevault-contracts/http/fixtures/proof-batches.json';
import auth from '../../../tracevault-contracts/http/fixtures/auth-success.json';
import portfolio from '../../../tracevault-contracts/http/fixtures/portfolio-success.json';
import token from '../../../tracevault-contracts/http/fixtures/token-success.json';
import classification from '../../../tracevault-contracts/http/fixtures/ledger-classification-request.json';
import ledgerFee from '../../../tracevault-contracts/http/fixtures/ledger-fee-request.json';
import trace from '../../../tracevault-contracts/http/fixtures/ledger-trace-success.json';
import reports from '../../../tracevault-contracts/http/fixtures/accounting-reports.json';
import accounting from '../../../tracevault-contracts/http/fixtures/accounting-runs.json';
import taxpayerInput from '../../../tracevault-contracts/http/fixtures/taxpayer-input-snapshot.json';
import taxProfile from '../../../tracevault-contracts/http/fixtures/tax-profile-success.json';
import taxCalculation from '../../../tracevault-contracts/http/fixtures/tax-calculation-success.json';
import legalPolicyCatalog from '../../../tracevault-contracts/http/fixtures/legal-tax-policy-catalog-empty.json';
import legalTaxCalculation from '../../../tracevault-contracts/http/fixtures/legal-tax-calculation.json';
import legalTaxRun from '../../../tracevault-contracts/http/fixtures/legal-tax-run.json';
import legalTaxReports from '../../../tracevault-contracts/http/fixtures/legal-tax-reports.json';
import error from '../../../tracevault-contracts/http/fixtures/validation-error.json';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
describe('canonical HTTP wire fixtures', () => {
  it.each<[string, unknown]>([
    ['NotificationList', notification.list], ['NotificationDevices', notification.devices], ['SetNotificationPreferences', notification.update], ['ProofVerificationContext', proofContext], ['ProofInputSnapshotEnvelope', proofJobs.prepare], ['ProofJobEnvelope', proofJobs.queued], ['ProofJobEnvelope', proofJobs.completed], ['ProofJobListEnvelope', proofJobs.list], ['FrozenProofBatchJobEnvelope', proofBatchJobs.queued], ['FrozenProofBatchJobEnvelope', proofBatchJobs.completed], ['FrozenProofBatchJobListEnvelope', proofBatchJobs.list], ['ProofBatchEnvelope', proofBatches.detail], ['ProofBatchListEnvelope', proofBatches.list],
    ['AccountingReportEnvelope', reports.create], ['AccountingReportListEnvelope', reports.list], ['AccountingRunEnvelope', accounting.create], ['AccountingRunResultEnvelope', accounting.get], ['AccountingRunListEnvelope', accounting.list], ...['LOT','DISPOSITION','CONSUMPTION','ANNUAL_POOL','FX','SOURCE_EVENT','BARE_LOT','BARE_DISPOSITION','BARE_ANNUAL_POOL','BARE_SOURCE_EVENT','FEE_DISPOSITION','FEE_CONSUMPTION','FEE_FX'].map((kind): [string, unknown] => ['AccountingRunEntriesEnvelope', accounting[kind as keyof typeof accounting]]),
    ['TaxProfileEnvelope', taxProfile], ['TaxCalculationResponseEnvelope', taxCalculation], ['LegalTaxPolicyCatalogEnvelope', legalPolicyCatalog], ['LegalTaxCalculationEnvelope', legalTaxCalculation], ['LegalTaxRunEnvelope', legalTaxRun], ['LegalTaxReportEnvelope', legalTaxReports.create], ['LegalTaxReportListEnvelope', legalTaxReports.list], ['TaxpayerInputSnapshotEnvelope', taxpayerInput], ['EventTraceResponseEnvelope', trace], ['PortfolioResponseEnvelope', portfolio], ['AuthResponseEnvelope', auth], ['TokenResponseEnvelope', token], ['ErrorResponse', error], ['CreateLedgerEventRequest', ledgerFee], ['ReclassifyEventRequest', classification],
  ])('validates %s against the shared schema', (name, fixture) => {
    const validate = ajv.compile({ components: spec.components, $ref: `#/components/schemas/${name}` });
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
  });
  it('rejects caller paths and unknown program/receipt encodings in verifier context', () => {
    const validate = ajv.compile({ components: spec.components, $ref: '#/components/schemas/ProofVerificationContext' });
    for (const changed of [{ ...proofContext, program_image_id: '/tmp/worker' }, { ...proofContext, worker_path: '/tmp/worker' }, { ...proofContext, receipt_encoding: 'unknown' }]) expect(validate(changed)).toBe(false);
  });
  it('separates batch summaries from ordered detail membership', () => {
    const detail = ajv.compile({ components: spec.components, $ref: '#/components/schemas/ProofBatchEnvelope' });
    const list = ajv.compile({ components: spec.components, $ref: '#/components/schemas/ProofBatchListEnvelope' });
    expect(detail(proofBatches.detail)).toBe(true);
    expect(list(proofBatches.list)).toBe(true);
    expect(detail({ ...proofBatches.detail, data: { ...proofBatches.detail.data, items: undefined } })).toBe(false);
    expect(list({ ...proofBatches.list, data: { ...proofBatches.list.data, batches: [{ ...proofBatches.list.data.batches[0], items: proofBatches.detail.data.items }] } })).toBe(false);
    expect(detail({ ...proofBatches.detail, data: { ...proofBatches.detail.data, batch_merkle_root: 'not-a-digest' } })).toBe(false);
  });
  it('rejects partial durable batch job results and duplicate request items', () => {
    const job = ajv.compile({ components: spec.components, $ref: '#/components/schemas/FrozenProofBatchJobEnvelope' });
    const request = ajv.compile({ components: spec.components, $ref: '#/components/schemas/SubmitFrozenProofBatchJobRequest' });
    expect(job(proofBatchJobs.queued)).toBe(true);
    expect(job(proofBatchJobs.completed)).toBe(true);
    expect(job({ ...proofBatchJobs.queued, data: { ...proofBatchJobs.queued.data, batch_id: proofBatchJobs.queued.data.id } })).toBe(false);
    expect(request({ request_id: proofBatchJobs.queued.data.request_id, items: [proofBatchJobs.queued.data.items[0], proofBatchJobs.queued.data.items[0]].map(item => ({ input_id: item.input_id, expected_sha256: item.expected_sha256 })) })).toBe(false);
  });
  it('preserves signed losses and requires string run cursors/counts and consistent freshness', () => {
    const result = ajv.compile({ components: spec.components, $ref: '#/components/schemas/AccountingRunResultEnvelope' });
    expect(result(accounting.get)).toBe(true);
    expect(result({ ...accounting.get, data: { ...accounting.get.data, freshness: 'NOT_CHECKED' } })).toBe(false);
    const page = ajv.compile({ components: spec.components, $ref: '#/components/schemas/AccountingRunEntriesEnvelope' });
    expect(page({ ...accounting.LOT, data: { ...accounting.LOT.data, next_after_index: 9007199254740993 } })).toBe(false);
    expect(page({ ...accounting.LOT, data: { ...accounting.LOT.data, entries: [{ ...accounting.LOT.data.entries[0], fx: accounting.FX.data.entries[0].fx }] } })).toBe(false);
  });
  it('rejects prefixed Tax enums, numeric tax rates and silent method defaults', () => {
    const profile = ajv.compile({ components: spec.components, $ref: '#/components/schemas/TaxProfileEnvelope' });
    expect(profile({ ...taxProfile, data: { ...taxProfile.data, cost_basis_method: 'COST_BASIS_METHOD_TOTAL_AVERAGE' } })).toBe(false);
    const calculation = ajv.compile({ components: spec.components, $ref: '#/components/schemas/TaxCalculationResponseEnvelope' });
    expect(calculation({ ...taxCalculation, data: { ...taxCalculation.data, summary: { ...taxCalculation.data.summary, tax_rate: 0.20315 } } })).toBe(false);
    const request = ajv.compile({ components: spec.components, $ref: '#/components/schemas/CalculateTaxRequest' });
    for (const cost_basis_method of ['UNKNOWN', '', undefined]) expect(request({ jurisdiction: 'JAPAN', tax_year: 2024, cost_basis_method })).toBe(false);
  });
  it('rejects old graph names, missing allocation units and numeric flow quantities', () => {
    const validate = ajv.compile({ components: spec.components, $ref: '#/components/schemas/EventTraceResponseEnvelope' });
    const edge = trace.data.edges[0];
    for (const changed of [
      { ...edge, from: edge.from_event_id, from_event_id: undefined },
      { ...edge, asset_id: undefined },
      { ...edge, amount: { value: 1e-18, scale: 18 } },
    ]) expect(validate({ ...trace, data: { ...trace.data, edges: [changed] } })).toBe(false);
  });
  it('rejects binary-float fees and mismatched fee fields', () => {
    const validate = ajv.compile({ components: spec.components, $ref: '#/components/schemas/CreateLedgerEventRequest' });
    expect(validate({ ...ledgerFee, fee_amount: { value: 0.000000000000000001, scale: 18 } })).toBe(false);
    const missingAmount = { ...ledgerFee, fee_amount: undefined };
    expect(validate(missingAmount)).toBe(false);
  });
  it('rejects the old unwrapped auth response and invented token fields', () => {
    const validate = ajv.compile({ components: spec.components, $ref: '#/components/schemas/AuthResponseEnvelope' });
    expect(validate(auth.data)).toBe(false);
    expect(validate({ ...auth, data: { ...auth.data, token_type: 'Bearer' } })).toBe(false);
  });
});
