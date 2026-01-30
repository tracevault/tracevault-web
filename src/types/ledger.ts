// Ledger Types - Entry Accounts and Events

export type EventType =
  | 'TRANSFER'
  | 'SWAP'
  | 'BUY'
  | 'SELL'
  | 'REWARD'
  | 'AIRDROP'
  | 'CORRECTION';

export type EntryAccountType =
  | 'ONCHAIN_ADDRESS'
  | 'CEX_ACCOUNT'
  | 'BANK_ACCOUNT'
  | 'ONRAMP_ACCOUNT';

export interface Amount {
  value: string;
  scale: number;
}

export interface AssetId {
  symbol: string;
  chain_id?: string;
  contract?: string;
}

export interface ValueSnapshot {
  price_usd: Amount;
  price_local: Amount;
  local_currency: string;
  exchange_rate: Amount;
  price_source: string;
  price_timestamp: string;
}

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

export interface LedgerEvent {
  id: string;
  user_id: string;
  event_type: EventType;
  asset_id: AssetId;
  amount: Amount;
  from_account_id?: string;
  to_account_id?: string;
  counter_asset_id?: AssetId;
  counter_amount?: Amount;
  value_snapshot: ValueSnapshot;
  event_time: string;
  source: string;
  source_tx_id?: string;
  correction_of?: string;
  created_at: string;
  created_by: string;
}

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

export interface CreateLedgerEventRequest {
  event_type: EventType;
  asset_id: AssetId;
  amount: Amount;
  from_account_id?: string;
  to_account_id?: string;
  counter_asset_id?: AssetId;
  counter_amount?: Amount;
  value_snapshot: ValueSnapshot;
  event_time: string;
  source: string;
  source_tx_id?: string;
  correction_of?: string;
}

export interface ReclassifyEventRequest {
  new_event_type: EventType;
  reason?: string;
}

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
  asset_symbol?: string;
  event_type?: EventType;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface AssetFlowNode {
  id: string;
  event_id: string;
  asset_id: AssetId;
  amount: Amount;
  event_type: EventType;
  event_time: string;
}

export interface AssetFlowEdge {
  from: string;
  to: string;
  amount: Amount;
}

export interface AssetFlowResponse {
  nodes: AssetFlowNode[];
  edges: AssetFlowEdge[];
}

export interface EventTraceResponse {
  path: LedgerEvent[];
  edges: AssetFlowEdge[];
  origin_event_id: string;
}
