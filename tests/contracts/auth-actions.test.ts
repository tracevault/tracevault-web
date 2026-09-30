import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../../tracevault-contracts/http/openapi.json';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const schema = (name: string) => ajv.compile({ components: spec.components, $ref: `#/components/schemas/${name}` });

describe('auth action HTTP contract', () => {
  it('keeps account existence and challenge secrets out of accepted responses', () => {
    const validate = schema('AuthActionAccepted');
    expect(validate({ accepted: true })).toBe(true);
    for (const value of [{ accepted: false }, { accepted: true, exists: true }, { accepted: true, token: 'secret' }, { accepted: true, action_id: 'secret' }]) {
      expect(validate(value)).toBe(false);
    }
  });
  it('does not permit callers to select the verification owner', () => {
    const validate = schema('RequestEmailVerification');
    expect(validate({})).toBe(true);
    expect(validate({ user_id: '12345678-1234-1234-1234-123456789001' })).toBe(false);
    expect(validate({ email: 'other@example.test' })).toBe(false);
  });
  it('requires explicit challenge completion fields and rejects legacy query-shaped fields', () => {
    const validate = schema('CompletePasswordReset');
    const request = { action_id: '12345678-1234-1234-1234-123456789001', token: 'A'.repeat(43), new_password: 'Replacement123!' };
    expect(validate(request)).toBe(true);
    for (const changed of [{ token: '' }, { token: `${request.token}=` }, { token: null }, { action_id: 'legacy-id' }, { new_password: '' }, { user_id: request.action_id }]) {
      expect(validate({ ...request, ...changed })).toBe(false);
    }
  });
});
