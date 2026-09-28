// Tax Types - Calculations and Reporting

import type { Amount, AssetId } from './ledger';
import type { components } from './generated/http';

export type Jurisdiction = components['schemas']['TaxJurisdiction'];
export type CostBasisMethod = components['schemas']['TaxCostBasisMethod'];
export type ReportFormat = 'PDF' | 'CSV' | 'JSON';

export type TaxProfile = components['schemas']['TaxProfile'];
export type AccountingPolicy = components['schemas']['AccountingPolicy'];
export type LegalTaxPolicy = components['schemas']['LegalTaxPolicy'];
export type LegalTaxPolicyCatalog = components['schemas']['LegalTaxPolicyCatalog'];
export type TaxpayerInputPayload = components['schemas']['TaxpayerInputPayload'];
export type TaxpayerInputSnapshot = components['schemas']['TaxpayerInputSnapshot'];
export type CreateTaxpayerInputSnapshotRequest = components['schemas']['CreateTaxpayerInputSnapshotRequest'];
export type PreviewLegalTaxRequest = components['schemas']['PreviewLegalTaxRequest'];
export type LegalTaxCalculation = components['schemas']['LegalTaxCalculation'];
export type CreateLegalTaxRunRequest = components['schemas']['CreateLegalTaxRunRequest'];
export type LegalTaxRun = components['schemas']['LegalTaxRun'];
export type LegalTaxRunList = components['schemas']['LegalTaxRunList'];
export type LegalTaxReport = components['schemas']['LegalTaxReport'];
export type LegalTaxReportList = components['schemas']['LegalTaxReportList'];
export type CreateLegalTaxReportRequest = components['schemas']['CreateLegalTaxReportRequest'];
export const ACCOUNTING_POLICY_V2: components['schemas']['AccountingPolicySelection'] = {
  version: 2,
  reward_treatment: 'FAIR_VALUE_BASIS_AND_INCOME',
  airdrop_treatment: 'FAIR_VALUE_BASIS_AND_INCOME',
  transfer_fee_treatment: 'FAIR_VALUE_DISPOSAL_AND_FIAT_EXPENSE',
};

export type TaxSummary = components['schemas']['TaxSummary'];

export type TaxEvent = components['schemas']['TaxEvent'];

export type TaxCalculationResponse = components['schemas']['TaxCalculationResponse'];

export interface TaxLot {
  id: string;
  user_id: string;
  asset_id: AssetId;
  quantity: Amount;
  remaining_quantity: Amount;
  cost_basis_per_unit: Amount;
  cost_basis: Amount;
  acquired_at: string;
  acquisition_event_id: string;
  is_consumed: boolean;
  consumed_at?: string | null;
}

export interface TaxLotListResponse {
  lots: TaxLot[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export type ReportType = 'SUMMARY' | 'TRANSACTIONS' | 'TAX_LOTS';

export interface TaxReport {
  id: string;
  user_id: string;
  jurisdiction: Jurisdiction;
  tax_year: number;
  report_type: ReportType;
  format: ReportFormat;
  file_size?: number;
  download_url: string;
  generated_at: string;
  expires_at: string;
}

export interface TaxReportListResponse {
  reports: TaxReport[];
}

// Request types
export type CreateTaxProfileRequest = components['schemas']['CreateTaxProfileRequest'];

export type UpdateTaxProfileRequest = components['schemas']['UpdateTaxProfileRequest'];

export type TaxCalculateRequest = components['schemas']['CalculateTaxRequest'];

export interface GenerateTaxReportRequest {
  tax_year: number;
  jurisdiction: Jurisdiction;
  report_type: ReportType;
  format: ReportFormat;
}

// Query params
export interface TaxLotsQueryParams {
  asset_symbol?: string;
  include_consumed?: boolean;
  limit?: number;
  offset?: number;
}

export type AccountingRun = components['schemas']['AccountingRun'];
export type AccountingRunResult = components['schemas']['AccountingRunResult'];
export type AccountingRunList = components['schemas']['AccountingRunList'];
export type AccountingRunEntries = components['schemas']['AccountingRunEntries'];
export type AccountingRunEntryKind = components['schemas']['AccountingRunEntryKind'];
export type CreateAccountingRunRequest = components['schemas']['CreateAccountingRunRequest'];

export type AccountingReport = components['schemas']['AccountingReport'];
export type AccountingReportList = components['schemas']['AccountingReportList'];
export type AccountingReportFormat = components['schemas']['AccountingReportFormat'];
export type CreateAccountingReportRequest = components['schemas']['CreateAccountingReportRequest'];
