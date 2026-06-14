/**
 * Seal a plaintext secret into a base64-encoded ciphertext.
 * A fresh random nonce is prepended to the ciphertext so each seal produces
 * a different result even for the same input.
 */
export declare function sealSecret(plaintext: string): Promise<string>;
/**
 * Open a sealed secret back to its plaintext.
 * Throws on tampered or malformed ciphertext.
 */
export declare function openSecret(sealed: string): Promise<string>;
//# sourceMappingURL=vault.d.ts.map