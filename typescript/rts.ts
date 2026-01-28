// rts_parser.ts
// RTS Binary Parser in TypeScript

const SUPPORTED_VERSION = 1;
const EPOCH = 1767225600000n; // BigInt for timestamp math
const VARINT_SCALE = 100.0;
const INTENSITY_OFFSET = 3.0;

export interface RTSHeader {
  version: number;
  timestampMs: number;
  stationCount: number;
  intCount: number;
  reserved: number;
}

export interface Station {
  id: number;
  pga: number;
  pgv: number;
  intensity: number;
  isAlert: boolean;
}

export interface AreaIntensity {
  code: number;
  intensity: number;
}

export interface RTSData {
  header: RTSHeader;
  stations: Station[];
  areaIntensities: AreaIntensity[];
}

export class RTSParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof ArrayBuffer) {
      this.view = new DataView(buffer);
    } else {
      throw new TypeError("Input must be ArrayBuffer or Uint8Array");
    }
  }

  private checkBounds(size: number): void {
    if (this.offset + size > this.view.byteLength) {
      throw new Error(`Unexpected EOF: expected ${size} bytes, but only ${this.view.byteLength - this.offset} left.`);
    }
  }

  private readU8(): number {
    this.checkBounds(1);
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  private readU16(): number {
    this.checkBounds(2);
    const val = this.view.getUint16(this.offset, true); // Little-endian
    this.offset += 2;
    return val;
  }

  private readU32(): number {
    this.checkBounds(4);
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  /**
   * Time40 (5 bytes, signed int40)
   * Relative to Epoch 2026-01-01
   */
  private readTime40(): number {
    this.checkBounds(5);

    const lo = BigInt(this.view.getUint32(this.offset, true)); // low 32 bits
    const hi = BigInt(this.view.getUint8(this.offset + 4)); // high 8 bits

    this.offset += 5;

    // because JavaScript's bit operations are limited to 32 bits, we use BigInt
    let rawOffset = (hi << 32n) | lo;

    // Sign Extension: check 39th bit == 1
    if (rawOffset & (1n << 39n)) {
      // If negative, subtract 2^40 to get the correct signed value (two's complement)
      rawOffset -= 1n << 40n;
    }

    // return as Number (safe because max value fits in JS number)
    return Number(EPOCH + rawOffset);
  }

  private readVarInt(): number {
    const marker = this.readU8();
    let rawVal = 0;

    if (marker <= 0xfc) {
      rawVal = marker;
    } else if (marker === 0xfd) {
      rawVal = this.readU16();
    } else if (marker === 0xfe) {
      // read 3 bytes (u24)
      this.checkBounds(3);
      const b0 = this.view.getUint8(this.offset);
      const b1 = this.view.getUint8(this.offset + 1);
      const b2 = this.view.getUint8(this.offset + 2);
      this.offset += 3;

      // Little-endian
      rawVal = b0 | (b1 << 8) | (b2 << 16);
    } else {
      // 0xFF undefined
      rawVal = 0;
    }

    return rawVal / VARINT_SCALE;
  }

  private readIntensityAlert(): { intensity: number; isAlert: boolean } {
    const raw = this.readU8();

    let intensity = (raw & 0x7f) / 10.0 - INTENSITY_OFFSET;
    // round to 1 decimal place to prevent floating point precision issues
    intensity = Math.round(intensity * 10) / 10;

    const isAlert = (raw & 0x80) !== 0;

    return { intensity, isAlert };
  }

  public parse(): RTSData {
    const version = this.readU8();
    if (version !== SUPPORTED_VERSION) {
      throw new Error(`Unsupported RTS version: ${version}`);
    }

    const header: RTSHeader = {
      version,
      timestampMs: this.readTime40(),
      stationCount: this.readU16(),
      intCount: this.readU16(),
      reserved: this.readU16(),
    };

    const stations: Station[] = [];
    for (let i = 0; i < header.stationCount; i++) {
      const id = this.readU32();
      const pga = this.readVarInt();
      const pgv = this.readVarInt();
      const { intensity, isAlert } = this.readIntensityAlert();

      stations.push({ id, pga, pgv, intensity, isAlert });
    }

    const areaIntensities: AreaIntensity[] = [];
    for (let i = 0; i < header.intCount; i++) {
      const code = this.readU16();
      const rawI = this.readU8();

      // round to 1 decimal place to prevent floating point precision issues
      let intensity = rawI / 10.0 - INTENSITY_OFFSET;
      intensity = Math.round(intensity * 10) / 10;

      areaIntensities.push({ code, intensity });
    }

    return { header, stations, areaIntensities };
  }
}
