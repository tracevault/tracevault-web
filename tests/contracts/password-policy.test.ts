import { describe, expect, it } from 'vitest';
import cases from '../../../tracevault-contracts/http/fixtures/password-policy-v1.json';
import { newPasswordSchema, registerSchema, changePasswordSchema, loginSchema } from '../../src/lib/validations/auth';

describe('canonical password creation policy', () => {
  for (const fixture of cases) it(fixture.name, () => {
    expect(newPasswordSchema.safeParse(fixture.password).success).toBe(fixture.valid);
    expect(registerSchema.safeParse({email:'owner@example.test',name:'Owner',password:fixture.password,confirmPassword:fixture.password}).success).toBe(fixture.valid);
    expect(changePasswordSchema.safeParse({currentPassword:'existing',newPassword:fixture.password,confirmPassword:fixture.password}).success).toBe(fixture.valid);
  });
  it('preserves secrets verbatim and rejects lone surrogates', () => {
    expect(newPasswordSchema.parse(' Aa1!ab ')).toBe(' Aa1!ab ');
    expect(newPasswordSchema.safeParse('Aa1!abcd\ud800').success).toBe(false);
  });
  it('does not retroactively apply creation complexity or scalar length to existing login', () => {
    expect(loginSchema.safeParse({email:'owner@example.test',password:'Aa1!한글'}).success).toBe(true);
  });
});
