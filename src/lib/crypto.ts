/** Credential transport v1. The matching wire specification lives in contracts. */
export const CREDENTIAL_ALGORITHM = 'ECDH-P256-HKDF-SHA256+A256GCM-v1';
const context = 'tracevault/credentials/v1';
const encoder = new TextEncoder();

function encode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

export interface EncryptionResult {
  encryptedApiKey: string;
  encryptedSecretKey: string;
  ephemeralPublicKey: string;
  keyId: string;
}

export async function encryptApiKeys(
  apiKey: string,
  secretKey: string,
  serverPublicKeyBase64: string,
  keyId: string,
): Promise<EncryptionResult> {
  if (!apiKey || !secretKey || encoder.encode(apiKey).length > 2048 || encoder.encode(secretKey).length > 2048) {
    throw new Error('API credentials must contain 1–2048 bytes');
  }
  const spki = decode(serverPublicKeyBase64);
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', spki)),
    b => b.toString(16).padStart(2, '0')).join('');
  if (fingerprint !== keyId) throw new Error('Server encryption key fingerprint mismatch');
  const serverKey = await crypto.subtle.importKey('spki', spki, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, ephemeral.privateKey, 256);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(context) },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const encrypt = async (plaintext: string, field: string) => {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce,
      additionalData: encoder.encode(`${context}:${field}`), tagLength: 128 }, aes, encoder.encode(plaintext)));
    const packed = new Uint8Array(nonce.length + ciphertext.length);
    packed.set(nonce); packed.set(ciphertext, nonce.length);
    return encode(packed);
  };
  return {
    encryptedApiKey: await encrypt(apiKey, 'api_key'),
    encryptedSecretKey: await encrypt(secretKey, 'api_secret'),
    ephemeralPublicKey: encode(new Uint8Array(await crypto.subtle.exportKey('spki', ephemeral.publicKey))),
    keyId,
  };
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof crypto.getRandomValues === 'function';
}
