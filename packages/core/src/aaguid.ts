/**
 * AAGUID (Authenticator Attestation Globally Unique Identifier) Registry
 * Allows identifying the hardware authenticator vendor and model for Passkeys.
 */

export interface AuthenticatorMetadata {
  name: string;
  vendor: string;
  type: 'platform' | 'cross-platform' | 'software';
}

const KNOWN_AAGUIDS: Record<string, AuthenticatorMetadata> = {
  // Apple Ecosystem
  'dd48324f-6371-4f9a-bd29-0e0ecb3c4720': {
    name: 'iCloud Keychain (Passkey)',
    vendor: 'Apple',
    type: 'platform',
  },
  '16467389-7078-43d0-9976-13a893ec19cb': {
    name: 'Touch ID / Face ID',
    vendor: 'Apple',
    type: 'platform',
  },

  // Microsoft Windows Hello
  '08987058-cadc-4b81-b6e1-30de50dcbe96': {
    name: 'Windows Hello',
    vendor: 'Microsoft',
    type: 'platform',
  },

  // Google Ecosystem
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': {
    name: 'Google Password Manager',
    vendor: 'Google',
    type: 'platform',
  },

  // Password Managers
  'b5397666-4885-aa6b-cebf-e52262a439a2': {
    name: '1Password',
    vendor: 'AgileBits',
    type: 'software',
  },
  'b5397666-4885-aa6b-cebf-e52262a439a3': {
    name: 'Bitwarden',
    vendor: 'Bitwarden',
    type: 'software',
  },

  // Hardware Security Keys (Yubico)
  'ee882879-7216-4633-9b2f-ffac658d7080': {
    name: 'YubiKey 5 Series (NFC/USB)',
    vendor: 'Yubico',
    type: 'cross-platform',
  },
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': {
    name: 'YubiKey 5Ci',
    vendor: 'Yubico',
    type: 'cross-platform',
  },

  // Generic / Default
  '00000000-0000-0000-0000-000000000000': {
    name: 'Platform Authenticator',
    vendor: 'Generic',
    type: 'platform',
  },
};

/**
 * Converts a 16-byte AAGUID Uint8Array to formatted UUID string (8-4-4-4-12)
 */
export function aaguidBytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error('AAGUID must be exactly 16 bytes');
  }

  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-').toLowerCase();
}

/**
 * Resolves an AAGUID into human-readable authenticator model and vendor name
 */
export function lookupAAGUID(aaguid: Uint8Array | string): AuthenticatorMetadata {
  const uuid = typeof aaguid === 'string'
    ? aaguid.toLowerCase()
    : aaguidBytesToUuid(aaguid);

  return KNOWN_AAGUIDS[uuid] ?? {
    name: 'Passkey Hardware Device',
    vendor: 'Unknown Authenticator',
    type: 'platform',
  };
}
