import type { components } from './generated/http';

export type ExchangeCapability = components['schemas']['ExchangeCapability'];
export type ExchangeCapabilitiesResponse = components['schemas']['ExchangeCapabilitiesResponse'];

export type ExchangeType = components['schemas']['ExchangeType'];
export type ConnectionStatus = components['schemas']['ConnectionStatus'];
export type Connection = components['schemas']['Connection'];
export type CreateConnectionRequest = components['schemas']['CreateConnectionRequest'];
export type CreateConnectionResponse = components['schemas']['CreateConnectionResponse'];
export type ConnectionListResponse = components['schemas']['ConnectionListResponse'];
export type StartSyncRequest = components['schemas']['StartSyncRequest'];
export type StartSyncResponse = components['schemas']['StartSyncResponse'];
export type ServerPublicKeyResponse = components['schemas']['ServerPublicKeyResponse'];
export type TestConnectionRequest = components['schemas']['TestConnectionRequest'];
export type TestConnectionResponse = components['schemas']['TestConnectionResponse'];
export type SyncStatusResponse = components['schemas']['SyncStatusResponse'];
export type SyncStatus = ConnectionStatus;
export type Wallet = components['schemas']['Wallet'];
export type WalletCapability = components['schemas']['WalletCapability'];
export type WalletCapabilitiesResponse = components['schemas']['WalletCapabilitiesResponse'];
export type BeginWalletOwnershipRequest = components['schemas']['BeginWalletOwnershipRequest'];
export type WalletOwnershipChallenge = components['schemas']['WalletOwnershipChallenge'];
export type CompleteWalletOwnershipRequest = components['schemas']['CompleteWalletOwnershipRequest'];
export type AddWatchOnlyWalletRequest = components['schemas']['AddWatchOnlyWalletRequest'];
export type WalletResponse = components['schemas']['WalletResponse'];
export type WalletChain = components['schemas']['WalletChain'];
export type WalletSignatureScheme = components['schemas']['WalletSignatureScheme'];

// Exchange metadata for display
export interface ExchangeInfo {
  id: ExchangeType;
  name: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  apiDocsUrl: string;
  requiredFields: {
    apiKey: boolean;
    secretKey: boolean;
    passphrase?: boolean;
  };
  credentialFields?: {
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    apiKeyDescription: string;
    secretKeyLabel: string;
    secretKeyPlaceholder: string;
    secretKeyDescription: string;
    secretMultiline?: boolean;
  };
}

export type SyncProgress = SyncStatusResponse & { connection_id: string };
