/**
 * Ultra-lightweight Canonical CBOR (RFC 8949) Decoder for ZeroAuth
 *
 * Implements standard CBOR decoding for WebAuthn attestation objects & COSE public keys.
 * Zero external dependencies (< 150 LOC) to preserve the "Core < 1,500 LOC" philosophy.
 */

export class CborDecoder {
  private view: DataView;
  private offset = 0;

  constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  get remaining(): number {
    return this.buffer.byteLength - this.offset;
  }

  get currentOffset(): number {
    return this.offset;
  }

  decode(): any {
    if (this.offset >= this.buffer.byteLength) {
      throw new Error('CBOR: Unexpected end of buffer');
    }

    const initialByte = this.view.getUint8(this.offset++);
    const majorType = initialByte >> 5;
    const additionalInfo = initialByte & 0x1f;

    const length = this.parseLength(additionalInfo);

    switch (majorType) {
      case 0: // Unsigned integer
        return length;

      case 1: // Negative integer (-1 - n)
        return typeof length === 'bigint' ? -1n - length : -1 - length;

      case 2: { // Byte string
        const byteLen = Number(length);
        const bytes = this.buffer.subarray(this.offset, this.offset + byteLen);
        this.offset += byteLen;
        return bytes;
      }

      case 3: { // Text string
        const strLen = Number(length);
        const strBytes = this.buffer.subarray(this.offset, this.offset + strLen);
        this.offset += strLen;
        return new TextDecoder('utf-8').decode(strBytes);
      }

      case 4: { // Array
        const count = Number(length);
        const arr = new Array(count);
        for (let i = 0; i < count; i++) {
          arr[i] = this.decode();
        }
        return arr;
      }

      case 5: { // Map
        const count = Number(length);
        const map = new Map<any, any>();
        for (let i = 0; i < count; i++) {
          const key = this.decode();
          const val = this.decode();
          map.set(key, val);
        }
        return map;
      }

      case 6: // Tagged item
        // Skip tag and decode content
        return this.decode();

      case 7: // Simple / Float
        switch (additionalInfo) {
          case 20: return false;
          case 21: return true;
          case 22: return null;
          case 23: return undefined;
          case 24: {
            const simpleVal = this.view.getUint8(this.offset++);
            if (simpleVal === 20) return false;
            if (simpleVal === 21) return true;
            if (simpleVal === 22) return null;
            return undefined;
          }
          default:
            return undefined;
        }

      default:
        throw new Error(`CBOR: Unsupported major type ${majorType}`);
    }
  }

  private parseLength(info: number): number | bigint {
    if (info < 24) {
      return info;
    }
    switch (info) {
      case 24: {
        const val = this.view.getUint8(this.offset);
        this.offset += 1;
        return val;
      }
      case 25: {
        const val = this.view.getUint16(this.offset, false);
        this.offset += 2;
        return val;
      }
      case 26: {
        const val = this.view.getUint32(this.offset, false);
        this.offset += 4;
        return val;
      }
      case 27: {
        const val = this.view.getBigUint64(this.offset, false);
        this.offset += 8;
        return val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(val) : val;
      }
      default:
        throw new Error(`CBOR: Unsupported additional info ${info}`);
    }
  }
}

/**
 * Convenience helper to decode a CBOR buffer into JavaScript objects/Maps
 */
export function decodeCbor<T = any>(buffer: Uint8Array): T {
  const decoder = new CborDecoder(buffer);
  return decoder.decode();
}

/**
 * Converts a Map (resulting from CBOR decode) into a plain object when keys are strings
 */
export function cborMapToObject(map: Map<any, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [key, value] of map.entries()) {
    const stringKey = typeof key === 'string' ? key : String(key);
    if (value instanceof Map) {
      obj[stringKey] = cborMapToObject(value);
    } else {
      obj[stringKey] = value;
    }
  }
  return obj;
}
