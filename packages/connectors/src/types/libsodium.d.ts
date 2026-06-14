// Type stub for libsodium-wrappers
// Full typings are provided by @types/libsodium-wrappers once installed.
declare module 'libsodium-wrappers' {
  interface Libsodium {
    ready: Promise<void>;
    randombytes_buf(length: number): Uint8Array;
    from_string(str: string): Uint8Array;
    to_string(bytes: Uint8Array): string;
    from_base64(str: string, variant?: number): Uint8Array;
    to_base64(bytes: Uint8Array, variant?: number): string;
    crypto_secretbox_easy(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    readonly crypto_secretbox_KEYBYTES: number;
    readonly crypto_secretbox_NONCEBYTES: number;
    readonly base64_variants: { ORIGINAL: number; URLSAFE: number; ORIGINAL_NO_PADDING: number; URLSAFE_NO_PADDING: number };
  }
  const sodium: Libsodium;
  export = sodium;
}
