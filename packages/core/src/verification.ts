import { base64UrlToUint8Array, uint8ArrayToBase64Url } from './index.js';
import { decodeCbor } from './cbor.js';
import { sha256, importCoseKey, verifySignature } from './crypto.js';
import { AUTHENTICATOR_FLAGS } from './constants.js';
import { COSEAlgorithm } from './types.js';

export interface ParsedClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

export interface ParsedAuthData {
  rpIdHash: Uint8Array;
  flags: {
    UP: boolean;
    UV: boolean;
    BE: boolean;
    BS: boolean;
    AT: boolean;
    ED: boolean;
  };
  signCount: number;
  aaguid?: Uint8Array;
  credentialId?: Uint8Array;
  credentialIdBase64Url?: string;
  coseKeyMap?: Map<number, any>;
  rawAuthData: Uint8Array;
}

/**
 * Decodes and parses clientDataJSON
 */
export function parseClientData(clientDataJSON: string | Uint8Array): {
  clientData: ParsedClientData;
  clientDataBytes: Uint8Array;
} {
  const bytes = typeof clientDataJSON === 'string'
    ? base64UrlToUint8Array(clientDataJSON)
    : clientDataJSON;

  const jsonText = new TextDecoder('utf-8').decode(bytes);
  const clientData = JSON.parse(jsonText) as ParsedClientData;

  return { clientData, clientDataBytes: bytes };
}

/**
 * Parses binary authData buffer according to W3C WebAuthn Level 3 specifications
 */
export function parseAuthData(authData: Uint8Array): ParsedAuthData {
  if (authData.byteLength < 37) {
    throw new Error('Invalid authData: buffer too short (< 37 bytes)');
  }

  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);

  const rpIdHash = authData.subarray(0, 32);
  const flagsByte = view.getUint8(32);
  const signCount = view.getUint32(33, false); // big-endian

  const flags = {
    UP: Boolean(flagsByte & AUTHENTICATOR_FLAGS.UP),
    UV: Boolean(flagsByte & AUTHENTICATOR_FLAGS.UV),
    BE: Boolean(flagsByte & AUTHENTICATOR_FLAGS.BE),
    BS: Boolean(flagsByte & AUTHENTICATOR_FLAGS.BS),
    AT: Boolean(flagsByte & AUTHENTICATOR_FLAGS.AT),
    ED: Boolean(flagsByte & AUTHENTICATOR_FLAGS.ED),
  };

  let offset = 37;
  let aaguid: Uint8Array | undefined;
  let credentialId: Uint8Array | undefined;
  let credentialIdBase64Url: string | undefined;
  let coseKeyMap: Map<number, any> | undefined;

  // If Attested Credential Data flag is set (Registration)
  if (flags.AT) {
    if (authData.byteLength < offset + 18) {
      throw new Error('Invalid authData: missing attested credential header');
    }

    aaguid = authData.subarray(offset, offset + 16);
    offset += 16;

    const credIdLen = view.getUint16(offset, false);
    offset += 2;

    if (authData.byteLength < offset + credIdLen) {
      throw new Error('Invalid authData: truncated credentialId');
    }

    credentialId = authData.subarray(offset, offset + credIdLen);
    credentialIdBase64Url = uint8ArrayToBase64Url(credentialId);
    offset += credIdLen;

    const remainingBytes = authData.subarray(offset);
    coseKeyMap = decodeCbor<Map<number, any>>(remainingBytes);
  }

  return {
    rpIdHash,
    flags,
    signCount,
    aaguid,
    credentialId,
    credentialIdBase64Url,
    coseKeyMap,
    rawAuthData: authData,
  };
}

/**
 * Verify Registration (Attestation) Response
 */
export async function verifyRegistrationResponse(params: {
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  requireUserVerification?: boolean;
}) {
  const { response, expectedChallenge, expectedOrigin, expectedRpId } = params;

  // 1. Verify clientDataJSON
  const { clientData } = parseClientData(response.clientDataJSON);

  if (clientData.type !== 'webauthn.create') {
    throw new Error(`Unexpected clientData type: ${clientData.type}, expected webauthn.create`);
  }

  if (clientData.challenge !== expectedChallenge) {
    throw new Error('Registration challenge mismatch');
  }

  if (clientData.origin !== expectedOrigin) {
    throw new Error(`Origin mismatch: expected "${expectedOrigin}", got "${clientData.origin}"`);
  }

  // 2. Decode attestationObject CBOR
  const attestationBytes = base64UrlToUint8Array(response.attestationObject);
  const attestationMap = decodeCbor<Map<string, any>>(attestationBytes);

  const authDataRaw = attestationMap.get('authData') as Uint8Array;
  if (!authDataRaw) {
    throw new Error('Invalid attestationObject: missing authData');
  }

  // 3. Parse authData
  const authData = parseAuthData(authDataRaw);

  // 4. Verify RP ID hash
  const expectedRpIdHash = await sha256(expectedRpId);
  if (!buffersEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new Error('RP ID hash mismatch');
  }

  // 5. Verify User Present
  if (!authData.flags.UP) {
    throw new Error('User Present (UP) flag was not set during registration');
  }

  // 6. User Verification check if required
  if (params.requireUserVerification && !authData.flags.UV) {
    throw new Error('User Verification (UV) required but not performed by authenticator');
  }

  if (!authData.credentialId || !authData.credentialIdBase64Url || !authData.coseKeyMap) {
    throw new Error('Attested credential data or public key is missing');
  }

  // 7. Parse and import public key
  const { rawPublicKey, algorithm } = await importCoseKey(authData.coseKeyMap);

  return {
    verified: true,
    credential: {
      id: authData.credentialIdBase64Url,
      rawId: authData.credentialId,
      publicKey: rawPublicKey,
      counter: authData.signCount,
      algorithm,
      backedUp: authData.flags.BS,
      deviceType: authData.flags.BE ? ('multiDevice' as const) : ('singleDevice' as const),
    },
  };
}

/**
 * Verify Authentication (Assertion) Response
 */
export async function verifyAuthenticationResponse(params: {
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  credentialPublicKey: Uint8Array;
  previousCounter?: number;
  algorithm?: COSEAlgorithm;
  requireUserVerification?: boolean;
}) {
  const { response, expectedChallenge, expectedOrigin, expectedRpId, credentialPublicKey } = params;

  // 1. Verify clientDataJSON
  const { clientData, clientDataBytes } = parseClientData(response.clientDataJSON);

  if (clientData.type !== 'webauthn.get') {
    throw new Error(`Unexpected clientData type: ${clientData.type}, expected webauthn.get`);
  }

  if (clientData.challenge !== expectedChallenge) {
    throw new Error('Authentication challenge mismatch');
  }

  if (clientData.origin !== expectedOrigin) {
    throw new Error(`Origin mismatch: expected "${expectedOrigin}", got "${clientData.origin}"`);
  }

  // 2. Parse authenticatorData
  const authDataBytes = base64UrlToUint8Array(response.authenticatorData);
  const authData = parseAuthData(authDataBytes);

  // 3. Verify RP ID hash
  const expectedRpIdHash = await sha256(expectedRpId);
  if (!buffersEqual(authData.rpIdHash, expectedRpIdHash)) {
    throw new Error('RP ID hash mismatch');
  }

  // 4. Verify User Present
  if (!authData.flags.UP) {
    throw new Error('User Present (UP) flag was not set during authentication');
  }

  if (params.requireUserVerification && !authData.flags.UV) {
    throw new Error('User Verification (UV) was required but not performed');
  }

  // 5. Clone detection via counter check
  if (params.previousCounter !== undefined && params.previousCounter > 0) {
    if (authData.signCount <= params.previousCounter && authData.signCount !== 0) {
      throw new Error(
        `Potential authenticator cloning detected: received signCount (${authData.signCount}) <= previousCounter (${params.previousCounter})`
      );
    }
  }

  // 6. Verify signature over (authenticatorData || sha256(clientDataJSON))
  const clientDataHash = await sha256(clientDataBytes);
  const signedData = new Uint8Array(authDataBytes.length + clientDataHash.length);
  signedData.set(authDataBytes, 0);
  signedData.set(clientDataHash, authDataBytes.length);

  const signatureBytes = base64UrlToUint8Array(response.signature);

  // Re-import public key
  let cryptoKey: CryptoKey;
  const algorithm = params.algorithm ?? COSEAlgorithm.ES256;

  if (algorithm === COSEAlgorithm.ES256) {
    const keyBuffer = credentialPublicKey.buffer.slice(
      credentialPublicKey.byteOffset,
      credentialPublicKey.byteOffset + credentialPublicKey.byteLength
    ) as ArrayBuffer;

    cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );
  } else if (algorithm === COSEAlgorithm.EdDSA) {
    const keyBuffer = credentialPublicKey.buffer.slice(
      credentialPublicKey.byteOffset,
      credentialPublicKey.byteOffset + credentialPublicKey.byteLength
    ) as ArrayBuffer;

    cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );
  } else {
    throw new Error(`Unsupported signature verification algorithm: ${algorithm}`);
  }

  const isValid = await verifySignature({
    cryptoKey,
    algorithm,
    signature: signatureBytes,
    data: signedData,
  });

  if (!isValid) {
    throw new Error('WebAuthn cryptographic signature verification failed');
  }

  return {
    verified: true,
    newCounter: authData.signCount,
  };
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
