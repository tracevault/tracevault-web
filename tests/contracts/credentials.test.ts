import { describe, it, expect } from 'vitest';
import { createPrivateKey, createPublicKey, diffieHellman, hkdfSync, createDecipheriv } from 'node:crypto';
import fixture from '../../../tracevault-contracts/http/fixtures/credential-v1.json';
import { encryptApiKeys, CREDENTIAL_ALGORITHM } from '@/lib/crypto';

function decrypt(ephemeral: string, packed: string, field: string) {
  const shared = diffieHellman({ privateKey: createPrivateKey(fixture.server_private_key_pem), publicKey:
    createPublicKey({ key: Buffer.from(ephemeral, 'base64'), type: 'spki', format: 'der' }) });
  const key = hkdfSync('sha256', shared, Buffer.alloc(0), 'tracevault/credentials/v1', 32);
  const bytes = Buffer.from(packed, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(`tracevault/credentials/v1:${field}`));
  cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8');
}

describe('browser credential transport interoperates with independent server implementation', () => {
  it('encrypts UTF-8 credentials using canonical algorithm and packed nonces', async () => {
    expect(CREDENTIAL_ALGORITHM).toBe(fixture.algorithm);
    const value = await encryptApiKeys('api-테스트', 'secret-🔐', fixture.public_key, fixture.key_id);
    expect(decrypt(value.ephemeralPublicKey, value.encryptedApiKey, 'api_key')).toBe('api-테스트');
    expect(decrypt(value.ephemeralPublicKey, value.encryptedSecretKey, 'api_secret')).toBe('secret-🔐');
    expect(() => decrypt(value.ephemeralPublicKey, value.encryptedApiKey, 'api_secret')).toThrow();
  });
  it('uses independent random nonces and ephemeral keys', async () => {
    const a = await encryptApiKeys('same', 'same', fixture.public_key, fixture.key_id);
    const b = await encryptApiKeys('same', 'same', fixture.public_key, fixture.key_id);
    expect(a.ephemeralPublicKey).not.toBe(b.ephemeralPublicKey);
    expect(a.encryptedApiKey.slice(0, 16)).not.toBe(a.encryptedSecretKey.slice(0, 16));
  });
  it('rejects empty credentials and mismatched advertised fingerprint', async () => {
    await expect(encryptApiKeys('', 'secret', fixture.public_key, fixture.key_id)).rejects.toThrow();
    await expect(encryptApiKeys('key', 'secret', fixture.public_key, '0'.repeat(64))).rejects.toThrow('fingerprint');
  });
});
