/**
 * Supported COSE algorithms for ZeroAuth WebAuthn
 */
export enum COSEAlgorithm {
  ES256 = -7,
  EdDSA = -8,
  RS256 = -257,
}

export type AuthenticatorTransportFuture =
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'internal'
  | 'hybrid';

export interface ZeroAuthUser {
  id: string;
  username: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZeroAuthCredential {
  id: string; // Base64URL
  userId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  deviceType?: 'singleDevice' | 'multiDevice';
  backedUp?: boolean;
  name?: string;
  aaguid?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ZeroAuthChallenge {
  challenge: string;
  userId?: string;
  type: 'registration' | 'authentication';
  expiresAt: Date;
}

export interface RelyingPartyConfig {
  name: string;
  id: string;
  origin: string;
}

export interface RegistrationOptions {
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  challenge: string;
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'discouraged' | 'preferred' | 'required';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransportFuture[];
  }>;
}

export interface AuthenticationOptions {
  challenge: string;
  timeout?: number;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransportFuture[];
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}
