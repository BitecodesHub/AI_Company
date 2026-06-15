/**
 * Secret vault — seal/open connector OAuth tokens with libsodium.
 * (ARCHITECTURE.md §3 — libsodium-wrappers is the API's secret-sealing primitive.)
 *
 * Mirrors `@bitecodes/connectors`' vault but lives in the API so the OAuth
 * controller has no cross-package runtime dependency. Secrets are sealed with
 * crypto_secretbox using ENCRYPTION_KEY (base64, 32 bytes), stored as base64 in
 * connector_credentials.encrypted_secret, and NEVER logged or returned to a client.
 */
import sodium from 'libsodium-wrappers';

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

function getKey(): Uint8Array {
  const keyB64 = process.env['ENCRYPTION_KEY'];
  if (!keyB64) throw new Error('ENCRYPTION_KEY environment variable is not set');
  const key = sodium.from_base64(keyB64, sodium.base64_variants.ORIGINAL);
  if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error(`ENCRYPTION_KEY must be ${sodium.crypto_secretbox_KEYBYTES} bytes (base64-encoded)`);
  }
  return key;
}

/** Seal a plaintext secret into base64 ciphertext (fresh nonce prepended). */
export async function sealSecret(plaintext: string): Promise<string> {
  await ensureInit();
  const key = getKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, key);
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
}

/** Open a sealed secret back to plaintext. Throws on tamper/wrong key. */
export async function openSecret(sealed: string): Promise<string> {
  await ensureInit();
  const key = getKey();
  const combined = sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL);
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = combined.slice(0, nonceLen);
  const ciphertext = combined.slice(nonceLen);
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!plaintext) throw new Error('Failed to decrypt secret: tampered or wrong key');
  return sodium.to_string(plaintext);
}
