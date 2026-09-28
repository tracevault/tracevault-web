import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../../tracevault-contracts/http/openapi.json';
import credentials from '../../../tracevault-contracts/http/fixtures/credential-v1.json';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const schema = (name: string) => ajv.compile({ components: spec.components, $ref: `#/components/schemas/${name}` });
const create = {
  exchange: 'binance',
  ...Object.fromEntries(['api_key_encrypted', 'api_secret_encrypted', 'ephemeral_public_key', 'key_id'].map(key => [key, credentials[key as keyof typeof credentials]])),
};

describe('canonical retained account selection', () => {
  it('accepts additive explicit targets and 80 Unicode scalars, rejecting invalid IDs and controls', () => {
    const validate = schema('CreateConnectionRequest');
    expect(validate(create)).toBe(true);
    expect(validate({ ...create, label: '🪙'.repeat(80), reconnect_connection_id: '0123456789abcdef01234567' })).toBe(true);
    for (const label of ['🪙'.repeat(81), 'a\nb', 'a\x00b', 'a\u0085b']) expect(validate({ ...create, label })).toBe(false);
    for (const reconnect_connection_id of ['not-an-id', '0123456789ABCDEF01234567', null]) expect(validate({ ...create, reconnect_connection_id })).toBe(false);
  });
  it('keeps side-effect-free credential testing separate from account selection', () => {
    const validate = schema('TestConnectionRequest');
    expect(validate(create)).toBe(true);
    expect(validate({ ...create, reconnect_connection_id: '0123456789abcdef01234567' })).toBe(false);
  });
  it('retains distinct same-exchange rows with names and disconnected state', () => {
    const validate = schema('ConnectionListResponse');
    expect(validate({ connections: [
      { id: '0123456789abcdef01234567', exchange: 'binance', label: '운영', status: 'idle', created_at: '2026-09-20T00:00:00Z' },
      { id: '1123456789abcdef01234567', exchange: 'binance', label: '보관', status: 'disconnected', created_at: '2026-09-20T00:00:00Z' },
    ], wallets: [] })).toBe(true);
    for (const multiple_accounts_enabled of [true, false]) {
      expect(validate({ connections: [], wallets: [], multiple_accounts_enabled })).toBe(true);
    }
    for (const multiple_accounts_enabled of ['true', 1, null]) {
      expect(validate({ connections: [], wallets: [], multiple_accounts_enabled })).toBe(false);
    }
  });
});
