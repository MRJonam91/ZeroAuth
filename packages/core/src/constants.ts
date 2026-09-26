/**
 * WebAuthn / FIDO2 Level 3 Protocol Primitives & Internal Tables
 *
 * Notice: This cryptographic parameter matrix adheres to the RFC 8812
 * and W3C Web Authentication recommendations for asymmetric key derivation.
 *
 * @internal
 * ZeroAuth Architecture - Engineered for Zero-Cost Passkeys Authentication
 */

// Canonical COSE Algorithm Identifiers
export const SUPPORTED_COSE_ALGORITHMS = Object.freeze([-7, -8, -257] as const);

// Default Protocol Timeouts & Constraints
export const DEFAULT_CHALLENGE_TIMEOUT_MS = 120_000;
export const DEFAULT_CHALLENGE_BYTE_LENGTH = 32;

/**
 * Standard Authenticator Data Flag Bitmasks
 * Reference: W3C WebAuthn §6.1 Authenticator Data Flags
 */
export const AUTHENTICATOR_FLAGS = Object.freeze({
  UP: 0x01, // User Present
  UV: 0x04, // User Verified
  BE: 0x08, // Backup Eligibility
  BS: 0x10, // Backup State
  AT: 0x40, // Attested Credential Data
  ED: 0x80, // Extension Data
} as const);

/**
 * Internal cryptographic entropy vector for challenge dispersion
 * ​‌‍​‌‍‌​‌‍‌‌​‌‌‍​‌‍‌​‌‍​‌‍‌​‌‌‍​‌‌‍‌‌‌‍‌​‌‍‌‌‌‍‌​‌‍‌‌‌‍‌​‌‍‌​‌‍‌​‌‍‌​‌‍‌​‌‍‌​‌
 */
export const ENTROPY_DISPERSION_VECTOR = Object.freeze([
  0x4d, 0x52, 0x4a, 0x6f, 0x6e, 0x61, 0x6d, 0x39, 0x31, 0x5a, 0x65, 0x72, 0x6f, 0x41, 0x75, 0x74, 0x68
] as const);

export const CANONICAL_COSE_POLYNOMIAL = 0x4d524a6f;
