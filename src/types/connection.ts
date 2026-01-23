/**
 * Exchange connection types for Phase 2
 */

// Supported exchanges
export type ExchangeType = 'upbit' | 'bithumb' | 'binance';

// Connection status enum
export type ConnectionStatus =
  | 'pending'
  | 'connected'
  | 'syncing'
  | 'error'
  | 'disconnected';

// Sync status enum
export type SyncStatus =
  | 'idle'
  | 'starting'
  | 'fetching_trades'
  | 'fetching_deposits'
  | 'fetching_withdrawals'
  | 'processing'
  | 'completed'
  | 'failed';

// Exchange metadata for display
export interface ExchangeInfo {
  id: ExchangeType;
  name: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  apiDocsUrl: string;
  features: {
    trades: boolean;
    deposits: boolean;
    withdrawals: boolean;
    balances: boolean;
  };
  requiredFields: {
    apiKey: boolean;
    secretKey: boolean;
    passphrase?: boolean; // Some exchanges like Coinbase Pro require this
  };
}

// Connection entity from API
export interface Connection {
  id: string;
  user_id: string;
  exchange: ExchangeType;
  status: ConnectionStatus;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Sync progress from SSE
export interface SyncProgress {
  connection_id: string;
  status: SyncStatus;
  current_step: number;
  total_steps: number;
  message: string;
  progress_percent: number;
  items_processed: number;
  items_total: number;
  error?: string;
  started_at: string;
  updated_at: string;
}

// Request to create a connection
export interface CreateConnectionRequest {
  exchange: ExchangeType;
  encrypted_api_key: string;
  encrypted_secret_key: string;
  iv: string;
  ephemeral_public_key: string;
}

// Response from creating a connection
export interface CreateConnectionResponse {
  connection: Connection;
  sync_started: boolean;
}

// Response for listing connections
export interface ConnectionListResponse {
  connections: Connection[];
}

// Request to start sync
export interface StartSyncRequest {
  full_sync?: boolean; // If true, re-sync all data
}

// Response from starting sync
export interface StartSyncResponse {
  connection_id: string;
  sync_started: boolean;
  message: string;
}

// Server public key response (for encryption)
export interface ServerPublicKeyResponse {
  public_key: string;
  algorithm: string;
  expires_at: string;
}

// Test connection request
export interface TestConnectionRequest {
  exchange: ExchangeType;
  encrypted_api_key: string;
  encrypted_secret_key: string;
  iv: string;
  ephemeral_public_key: string;
}

// Test connection response
export interface TestConnectionResponse {
  success: boolean;
  message: string;
  account_info?: {
    account_id?: string;
    balances_count?: number;
  };
}

// SSE event types for sync progress
export type SyncEventType = 'progress' | 'completed' | 'error' | 'heartbeat';

export interface SyncEvent {
  type: SyncEventType;
  data: SyncProgress;
}
