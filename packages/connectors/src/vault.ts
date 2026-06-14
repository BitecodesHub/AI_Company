/**
 * Secret vault helpers — seal/open connector credentials using libsodium.
 * (ARCHITECTURE.md §10, P4-04)
 *
 * Secrets are sealed with libsodium crypto_secretbox using ENCRYPTION_KEY.
 * They are NEVER logged, NEVER returned to the client, NEVER stored in plaintext.
 * The sealed ciphertext is stored as base64 in connector_credentials.encrypted_secret.
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
    throw new Error(
      `ENCRYPTION_KEY must be ${sodium.crypto_secretbox_KEYBYTES} bytes (base64-encoded)`,
    );
  }
  return key;
}

/**
 * Seal a plaintext secret into a base64-encoded ciphertext.
 * A fresh random nonce is prepended to the ciphertext so each seal produces
 * a different result even for the same input.
 */
export async function sealSecret(plaintext: string): Promise<string> {
  await ensureInit();
  const key = getKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    key,
  );
  // Prepend nonce to ciphertext, then base64-encode
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
}

/**
 * Open a sealed secret back to its plaintext.
 * Throws on tampered or malformed ciphertext.
 */
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
