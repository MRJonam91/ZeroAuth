export * from './types.js';
export * from './constants.js';

/**
 * Generate a cryptographically secure random challenge (Base64URL encoded)
 * uses globalThis.crypto (WebCrypto standard in Node 20+, browsers, Deno, Bun)
 */
export function generateChallenge(byteLength = 32): string {
  const randomBytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(randomBytes);
  return uint8ArrayToBase64Url(randomBytes);
}

/**
 * Convert Uint8Array to URL-safe Base64 string without padding
 */
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert Base64URL string to Uint8Array
 */
export function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
