// Tax Types - Calculations and Reporting

import type { Amount, AssetId } from './ledger';

export type Jurisdiction = 'KOREA' | 'JAPAN';
export type CostBasisMethod = 'FIFO' | 'LIFO' | 'MOVING_AVERAGE';
export type ReportFormat = 'PDF' | 'CSV' | 'JSON';

export interface TaxProfile {
  id: string;
  user_id: string;
  jurisdiction: Jurisdiction;
  tax_year: number;
  cost_basis_method: CostBasisMethod;
  local_currency: string;
}

export interface TaxSummary {
  total_proceeds: Amount;
  total_cost_basis: Amount;
  realized_gain: Amount;
  realized_loss: Amount;
  net_gain: Amount;
  taxable_income: Amount;
  deduction: Amount;
  tax_amount: Amount;
  tax_rate: number;
  currency: string;
}

export interface TaxEvent {
  event_id: string;
  event_type: string;
  asset_id: AssetId;
  quantity: Amount;
  proceeds: Amount;
  cost_basis: Amount;
  gain_loss: Amount;
  is_gain: boolean;
  event_time: string;
}

export interface TaxCalculationResponse {
  summary: TaxSummary;
  events: TaxEvent[];
}

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
export interface CreateTaxProfileRequest {
  jurisdiction: Jurisdiction;
  tax_year: number;
  cost_basis_method: CostBasisMethod;
}

export interface UpdateTaxProfileRequest {
  cost_basis_method: CostBasisMethod;
}

export interface TaxCalculateRequest {
  jurisdiction: Jurisdiction;
  tax_year: number;
  cost_basis_method: CostBasisMethod;
}

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
