import { expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../../tracevault-contracts/http/openapi.json';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const schema = (name: string) => ajv.compile({ components: spec.components, $ref: `#/components/schemas/${name}` });

it('requires exactly one strict factor proof for management and at most one for login', () => {
  for (const name of ['LoginRequest', 'ChangeTwoFactor']) {
    const validate = schema(name);
    const base = name === 'LoginRequest' ? { email: 'a@example.test', password: 'Password123!' } : { current_password: 'Password123!' };
    expect(validate(base)).toBe(name === 'LoginRequest');
    expect(validate({ ...base, totp_code: '012345' })).toBe(true);
    expect(validate({ ...base, recovery_code: 'a'.repeat(32) })).toBe(true);
    for (const bad of [{ totp_code: '12345' }, { totp_code: 123456 }, { totp_code: '１２３４５６' }, { recovery_code: 'A'.repeat(32) }, { totp_code: '012345', recovery_code: 'a'.repeat(32) }, { user_id: 'other' }]) expect(validate({ ...base, ...bad })).toBe(false);
  }
});

it('forbids credential leakage in status and requires ten unique recovery codes with revocation', () => {
  const status = schema('TwoFactorStatus');
  const value = { enabled: true, setup_pending: false, setup_available: true, recovery_codes_remaining: 9 };
  expect(status(value)).toBe(true);
  expect(status({ ...value, secret: 'unexpected' })).toBe(false);
  expect(status({ ...value, recovery_codes_remaining: 11 })).toBe(false);
  const validate = schema('TwoFactorRecoveryCodes');
  const codes = Array.from({ length: 10 }, (_, i) => i.toString(16).padStart(32, '0'));
  expect(validate({ recovery_codes: codes, sessions_revoked: true })).toBe(true);
  for (const changed of [{ recovery_codes: codes.slice(1) }, { recovery_codes: Array(10).fill(codes[0]) }, { sessions_revoked: false }, { secret: 'unexpected' }]) expect(validate({ recovery_codes: codes, sessions_revoked: true, ...changed })).toBe(false);
});
