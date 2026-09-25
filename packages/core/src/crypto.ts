import { COSEAlgorithm } from './types.js';

/**
 * Compute SHA-256 digest using standard WebCrypto API
 */
export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  // Ensure ArrayBuffer compatibility with WebCrypto
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
  return new Uint8Array(digest);
}

/**
 * Converts an ASN.1 DER ECDSA signature into IEEE P1363 (r || s, 64 bytes)
 * Required because WebCrypto ECDSA verify expects raw 64-byte IEEE P1363 representation.
 */
export function asn1DerToP1363(derSignature: Uint8Array): Uint8Array {
  // If already 64 bytes (IEEE P1363), return as is
  if (derSignature.length === 64) {
    return derSignature;
  }

  let offset = 0;
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid ASN.1 DER signature: expected sequence header 0x30');
  }

  let seqLen = derSignature[offset++]!;
  if (seqLen & 0x80) {
    const lenBytes = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < lenBytes; i++) {
      seqLen = (seqLen << 8) | derSignature[offset++]!;
    }
  }

  // Parse integer r
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid ASN.1 DER signature: expected integer r tag 0x02');
  }
  const rLen = derSignature[offset++]!;
  let r = derSignature.subarray(offset, offset + rLen);
  offset += rLen;

  // Parse integer s
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid ASN.1 DER signature: expected integer s tag 0x02');
  }
  const sLen = derSignature[offset++]!;
  let s = derSignature.subarray(offset, offset + sLen);

  // Strip leading zero padding if present
  while (r.length > 32 && r[0] === 0x00) {
    r = r.subarray(1);
  }
  while (s.length > 32 && s[0] === 0x00) {
    s = s.subarray(1);
  }

  if (r.length > 32 || s.length > 32) {
    throw new Error('Invalid ASN.1 DER signature: r or s exceeds 32 bytes for P-256');
  }

  const p1363 = new Uint8Array(64);
  // Left-pad r to 32 bytes
  p1363.set(r, 32 - r.length);
  // Left-pad s to 32 bytes
  p1363.set(s, 64 - s.length);

  return p1363;
}

/**
 * Import a COSE Key (CBOR Map) into a native WebCrypto CryptoKey
 */
export async function importCoseKey(coseKeyMap: Map<number, any>): Promise<{
  cryptoKey: CryptoKey;
  algorithm: COSEAlgorithm;
  rawPublicKey: Uint8Array;
}> {
  const kty = coseKeyMap.get(1); // 1 = OKP, 2 = EC2, 3 = RSA
  const alg = coseKeyMap.get(3); // -7 = ES256, -8 = EdDSA, -257 = RS256

  if (kty === 2 && alg === COSEAlgorithm.ES256) {
    // EC2 P-256
    const crv = coseKeyMap.get(-1); // 1 = P-256
    if (crv !== 1) {
      throw new Error(`Invalid EC2 curve: expected 1 (P-256), got ${crv}`);
    }
    const x = coseKeyMap.get(-2) as Uint8Array;
    const y = coseKeyMap.get(-3) as Uint8Array;

    if (!x || !y || x.length !== 32 || y.length !== 32) {
      throw new Error('Invalid EC2 P-256 COSE Key: missing or invalid coordinates');
    }

    // Uncompressed SEC1 point: 0x04 || x || y (65 bytes)
    const rawPublicKey = new Uint8Array(65);
    rawPublicKey[0] = 0x04;
    rawPublicKey.set(x, 1);
    rawPublicKey.set(y, 33);

    const keyBuffer = rawPublicKey.buffer.slice(
      rawPublicKey.byteOffset,
      rawPublicKey.byteOffset + rawPublicKey.byteLength
    ) as ArrayBuffer;

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    return { cryptoKey, algorithm: COSEAlgorithm.ES256, rawPublicKey };
  }

  if (kty === 1 && alg === COSEAlgorithm.EdDSA) {
    // Ed25519
    const x = coseKeyMap.get(-2) as Uint8Array;
    if (!x || x.length !== 32) {
      throw new Error('Invalid Ed25519 COSE Key: missing x coordinate');
    }

    const keyBuffer = x.buffer.slice(
      x.byteOffset,
      x.byteOffset + x.byteLength
    ) as ArrayBuffer;

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );

    return { cryptoKey, algorithm: COSEAlgorithm.EdDSA, rawPublicKey: x };
  }

  throw new Error(`Unsupported COSE Key: kty=${kty}, alg=${alg}`);
}

/**
 * Verify signature over signed data with native WebCrypto
 */
export async function verifySignature(params: {
  cryptoKey: CryptoKey;
  algorithm: COSEAlgorithm;
  signature: Uint8Array;
  data: Uint8Array;
}): Promise<boolean> {
  const { cryptoKey, algorithm, signature, data } = params;

  const dataBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;

  if (algorithm === COSEAlgorithm.ES256) {
    // Convert DER signature to IEEE P1363 for WebCrypto
    const p1363Sig = asn1DerToP1363(signature);
    const sigBuffer = p1363Sig.buffer.slice(
      p1363Sig.byteOffset,
      p1363Sig.byteOffset + p1363Sig.byteLength
    ) as ArrayBuffer;

    return await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      sigBuffer,
      dataBuffer
    );
  }

  if (algorithm === COSEAlgorithm.EdDSA) {
    const sigBuffer = signature.buffer.slice(
      signature.byteOffset,
      signature.byteOffset + signature.byteLength
    ) as ArrayBuffer;

    return await globalThis.crypto.subtle.verify(
      { name: 'Ed25519' },
      cryptoKey,
      sigBuffer,
      dataBuffer
    );
  }

  throw new Error(`Unsupported verification algorithm: ${algorithm}`);
}
