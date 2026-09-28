import type { components } from './generated/http';

// Ledger Types - Entry Accounts and Events

export type EventType = components['schemas']['LedgerEventType'];

export type EntryAccountType =
  | 'ONCHAIN_ADDRESS'
  | 'CEX_ACCOUNT'
  | 'BANK_ACCOUNT'
  | 'ONRAMP_ACCOUNT';

export type Amount = components['schemas']['LedgerAmount'];

export type AssetId = components['schemas']['LedgerAssetId'];

export type ValueSnapshot = components['schemas']['LedgerValueSnapshot'];

export interface EntryAccount {
  id: string;
  user_id: string;
  type: EntryAccountType;
  identifier: string;
  label: string;
  chain_id?: string;
  exchange_id?: string;
  created_at: string;
  updated_at: string;
}

export type LedgerEvent = components['schemas']['LedgerEvent'];

export interface Balance {
  asset_id: AssetId;
  balance: Amount;
  current_value?: Amount;
}

// Request/Response types
export interface CreateEntryAccountRequest {
  type: EntryAccountType;
  identifier: string;
  label: string;
  chain_id?: string;
  exchange_id?: string;
}

export type CreateLedgerEventRequest = components['schemas']['CreateLedgerEventRequest'];

export type ReclassifyEventRequest = components['schemas']['ReclassifyEventRequest'];

export interface EntryAccountListResponse {
  accounts: EntryAccount[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface LedgerEventListResponse {
  events: LedgerEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface BalanceListResponse {
  balances: Balance[];
}

export interface EventsQueryParams {
  effective_classification?: boolean;
  asset_symbol?: string;
  event_type?: EventType;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export type AssetFlowNode = components['schemas']['AssetFlowNode'];
export type AssetFlowEdge = components['schemas']['AssetFlowEdge'];
export type AssetFlowResponse = components['schemas']['AssetFlowResponse'];
export type EventTraceResponse = components['schemas']['EventTraceResponse'];
