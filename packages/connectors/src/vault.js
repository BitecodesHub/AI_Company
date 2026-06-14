"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sealSecret = sealSecret;
exports.openSecret = openSecret;
/**
 * Secret vault helpers — seal/open connector credentials using libsodium.
 * (ARCHITECTURE.md §10, P4-04)
 *
 * Secrets are sealed with libsodium crypto_secretbox using ENCRYPTION_KEY.
 * They are NEVER logged, NEVER returned to the client, NEVER stored in plaintext.
 * The sealed ciphertext is stored as base64 in connector_credentials.encrypted_secret.
 */
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
let initialized = false;
async function ensureInit() {
    if (!initialized) {
        await libsodium_wrappers_1.default.ready;
        initialized = true;
    }
}
function getKey() {
    const keyB64 = process.env['ENCRYPTION_KEY'];
    if (!keyB64)
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    const key = libsodium_wrappers_1.default.from_base64(keyB64, libsodium_wrappers_1.default.base64_variants.ORIGINAL);
    if (key.length !== libsodium_wrappers_1.default.crypto_secretbox_KEYBYTES) {
        throw new Error(`ENCRYPTION_KEY must be ${libsodium_wrappers_1.default.crypto_secretbox_KEYBYTES} bytes (base64-encoded)`);
    }
    return key;
}
/**
 * Seal a plaintext secret into a base64-encoded ciphertext.
 * A fresh random nonce is prepended to the ciphertext so each seal produces
 * a different result even for the same input.
 */
async function sealSecret(plaintext) {
    await ensureInit();
    const key = getKey();
    const nonce = libsodium_wrappers_1.default.randombytes_buf(libsodium_wrappers_1.default.crypto_secretbox_NONCEBYTES);
    const ciphertext = libsodium_wrappers_1.default.crypto_secretbox_easy(libsodium_wrappers_1.default.from_string(plaintext), nonce, key);
    // Prepend nonce to ciphertext, then base64-encode
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce, 0);
    combined.set(ciphertext, nonce.length);
    return libsodium_wrappers_1.default.to_base64(combined, libsodium_wrappers_1.default.base64_variants.ORIGINAL);
}
/**
 * Open a sealed secret back to its plaintext.
 * Throws on tampered or malformed ciphertext.
 */
async function openSecret(sealed) {
    await ensureInit();
    const key = getKey();
    const combined = libsodium_wrappers_1.default.from_base64(sealed, libsodium_wrappers_1.default.base64_variants.ORIGINAL);
    const nonceLen = libsodium_wrappers_1.default.crypto_secretbox_NONCEBYTES;
    const nonce = combined.slice(0, nonceLen);
    const ciphertext = combined.slice(nonceLen);
    const plaintext = libsodium_wrappers_1.default.crypto_secretbox_open_easy(ciphertext, nonce, key);
    if (!plaintext)
        throw new Error('Failed to decrypt secret: tampered or wrong key');
    return libsodium_wrappers_1.default.to_string(plaintext);
}
//# sourceMappingURL=vault.js.map