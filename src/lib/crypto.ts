/**
 * Web Crypto API utilities for client-side API key encryption
 * Uses AES-GCM for symmetric encryption with ECDH key exchange
 */

// Generate a random IV for AES-GCM (96 bits = 12 bytes recommended)
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Import server's public key for ECDH key exchange
async function importServerPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);

  return crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );
}

// Generate ephemeral ECDH key pair for key exchange
async function generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey']
  );
}

// Derive AES-GCM key from ECDH shared secret
async function deriveAESKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Export public key to base64
async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  return arrayBufferToBase64(exported);
}

export interface EncryptedApiKey {
  // Base64 encoded encrypted data
  encryptedData: string;
  // Base64 encoded IV used for encryption
  iv: string;
  // Base64 encoded ephemeral public key for key exchange
  ephemeralPublicKey: string;
}

export interface EncryptionResult {
  encryptedApiKey: string;
  encryptedSecretKey: string;
  iv: string;
  ephemeralPublicKey: string;
}

/**
 * Encrypt API key using Web Crypto API
 *
 * 1. Generate ephemeral ECDH key pair
 * 2. Derive shared secret using server's public key
 * 3. Derive AES-256-GCM key from shared secret
 * 4. Encrypt API key with AES-GCM
 *
 * @param apiKey - Plain text API key to encrypt
 * @param secretKey - Plain text secret key to encrypt
 * @param serverPublicKeyBase64 - Server's ECDH public key in base64
 * @returns Encrypted data with IV and ephemeral public key
 */
export async function encryptApiKeys(
  apiKey: string,
  secretKey: string,
  serverPublicKeyBase64: string
): Promise<EncryptionResult> {
  // Import server's public key
  const serverPublicKey = await importServerPublicKey(serverPublicKeyBase64);

  // Generate ephemeral key pair
  const ephemeralKeyPair = await generateEphemeralKeyPair();

  // Derive AES key from ECDH shared secret
  const aesKey = await deriveAESKey(ephemeralKeyPair.privateKey, serverPublicKey);

  // Generate IV
  const iv = generateIV();

  // Encode API key and secret key to UTF-8
  const encoder = new TextEncoder();
  const apiKeyData = encoder.encode(apiKey);
  const secretKeyData = encoder.encode(secretKey);

  // Encrypt both keys with the same key but different IVs
  const apiKeyIv = generateIV();
  const secretKeyIv = generateIV();

  const encryptedApiKey = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: apiKeyIv,
    },
    aesKey,
    apiKeyData
  );

  const encryptedSecretKey = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: secretKeyIv,
    },
    aesKey,
    secretKeyData
  );

  // Export ephemeral public key
  const ephemeralPublicKeyBase64 = await exportPublicKey(ephemeralKeyPair.publicKey);

  // Combine IVs for transmission
  const combinedIv = new Uint8Array(iv.length + apiKeyIv.length + secretKeyIv.length);
  combinedIv.set(iv, 0);
  combinedIv.set(apiKeyIv, iv.length);
  combinedIv.set(secretKeyIv, iv.length + apiKeyIv.length);

  return {
    encryptedApiKey: arrayBufferToBase64(encryptedApiKey),
    encryptedSecretKey: arrayBufferToBase64(encryptedSecretKey),
    iv: arrayBufferToBase64(combinedIv.buffer),
    ephemeralPublicKey: ephemeralPublicKeyBase64,
  };
}

/**
 * Simple AES-GCM encryption without key exchange
 * For cases where server provides a symmetric key directly
 */
export async function encryptWithSymmetricKey(
  plaintext: string,
  keyBase64: string
): Promise<EncryptedApiKey> {
  const keyData = base64ToArrayBuffer(keyBase64);

  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = generateIV();
  const encoder = new TextEncoder();
  const plaintextData = encoder.encode(plaintext);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    plaintextData
  );

  return {
    encryptedData: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv.buffer),
    ephemeralPublicKey: '', // Not used for symmetric encryption
  };
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
}
