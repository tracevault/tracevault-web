import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../../tracevault-contracts/http/openapi.json';
import ownership from '../../../tracevault-contracts/collector/wallet-ownership-v1.json';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const schema = (name: string) => ajv.compile({ components: spec.components, $ref: `#/components/schemas/${name}` });

describe('canonical wallet ownership contract', () => {
  it('pins seven Phase 1 chains and their signing families', () => {
    expect(ownership.supported_chains.map(item => item.chain_id)).toEqual(['ethereum', 'bsc', 'polygon', 'solana', 'arbitrum', 'optimism', 'base']);
    expect(ownership.challenge).toMatchObject({ ttl_seconds: 300, nonce_entropy_bytes: 32 });
    expect(ownership.challenge.bindings).toEqual(['authenticated_user', 'normalized_address', 'chain_id', 'audience', 'signature_scheme', 'issued_at', 'expires_at']);
  });

  it('distinguishes signed and watch-only persisted wallets', () => {
    const validate = schema('Wallet');
    const common = { id: '0123456789abcdef01234567', address: '0x1111111111111111111111111111111111111111', chain_id: 'ethereum', label: '', status: 'idle', created_at: '2026-09-21T00:00:00Z' };
    expect(validate({ ...common, ownership_mode: 'signed', signature_scheme: 'eip191_personal_sign' })).toBe(true);
    expect(validate({ ...common, ownership_mode: 'signed' })).toBe(false);
    expect(validate({ ...common, ownership_mode: 'watch_only' })).toBe(true);
    expect(validate({ ...common, ownership_mode: 'watch_only', signature_scheme: 'eip191_personal_sign' })).toBe(false);
  });

  it('accepts only bounded ownership inputs and 64/65-byte base64 signatures', () => {
    const begin = schema('BeginWalletOwnershipRequest');
    expect(begin({ address: '0x1111111111111111111111111111111111111111', chain_id: 'base' })).toBe(true);
    expect(begin({ address: '0x1111111111111111111111111111111111111111', chain_id: 'avalanche' })).toBe(false);
    const complete = schema('CompleteWalletOwnershipRequest');
    expect(complete({ challenge_id: '11111111-1111-4111-8111-111111111111', signature: Buffer.alloc(65).toString('base64') })).toBe(true);
    expect(complete({ challenge_id: '11111111-1111-4111-8111-111111111111', signature: Buffer.alloc(63).toString('base64') })).toBe(false);
  });
});
