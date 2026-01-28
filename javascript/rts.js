// rts_parser.js

const SUPPORTED_VERSION = 1;
const EPOCH_2026_MS = 1767225600000n;
const VARINT_SCALE = 100.0;
const INTENSITY_OFFSET = 3.0;

class RTSParser {
  /**
   * @param {ArrayBuffer|Uint8Array} buffer
   */
  constructor(buffer) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof ArrayBuffer) {
      this.view = new DataView(buffer);
    } else {
      throw new TypeError("Input must be ArrayBuffer or Uint8Array");
    }
    this.offset = 0;
  }

  _checkBounds(size) {
    if (this.offset + size > this.view.byteLength) {
      throw new Error(`Unexpected EOF: expected ${size} bytes`);
    }
  }

  _readU8() {
    this._checkBounds(1);
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  _readU16() {
    this._checkBounds(2);
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  _readU32() {
    this._checkBounds(4);
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  _readTime40() {
    this._checkBounds(5);
    const lo = BigInt(this.view.getUint32(this.offset, true)); // low 32 bits
    const hi = BigInt(this.view.getUint8(this.offset + 4)); // high 8 bits
    this.offset += 5;

    let rawOffset = (hi << 32n) | lo;

    // Sign Extension: check 39th bit == 1
    if (rawOffset & (1n << 39n)) {
      // If negative, subtract 2^40 to get the correct signed value (two's complement)
      rawOffset -= 1n << 40n;
    }

    // return as Number (safe because max value fits in JS number)
    return Number(EPOCH_2026_MS + rawOffset);
  }

  _readVarInt() {
    const marker = this._readU8();
    let rawVal = 0;

    if (marker <= 0xfc) {
      rawVal = marker;
    } else if (marker === 0xfd) {
      rawVal = this._readU16();
    } else if (marker === 0xfe) {
      // Read 3 bytes (u24)
      this._checkBounds(3);
      const b0 = this.view.getUint8(this.offset);
      const b1 = this.view.getUint8(this.offset + 1);
      const b2 = this.view.getUint8(this.offset + 2);
      this.offset += 3;
      rawVal = b0 | (b1 << 8) | (b2 << 16);
    }
    // 0xFF undefined

    return rawVal / VARINT_SCALE;
  }

  _readIntensityAlert() {
    const raw = this._readU8();

    let intensity = (raw & 0x7f) / 10.0 - INTENSITY_OFFSET;
    intensity = Math.round(intensity * 10) / 10;

    const isAlert = (raw & 0x80) !== 0;
    return { intensity, isAlert };
  }

  parse() {
    const version = this._readU8();
    if (version !== SUPPORTED_VERSION) {
      throw new Error(`Unsupported RTS version: ${version}`);
    }

    const header = {
      version,
      timestampMs: this._readTime40(),
      stationCount: this._readU16(),
      intCount: this._readU16(),
      reserved: this._readU16(),
    };

    const stations = [];
    for (let i = 0; i < header.stationCount; i++) {
      const id = this._readU32();
      const pga = this._readVarInt();
      const pgv = this._readVarInt();
      const { intensity, isAlert } = this._readIntensityAlert();

      stations.push({ id, pga, pgv, intensity, isAlert });
    }

    const areaIntensities = [];
    for (let i = 0; i < header.intCount; i++) {
      const code = this._readU16();
      const rawI = this._readU8();

      let intensity = rawI / 10.0 - INTENSITY_OFFSET;
      intensity = Math.round(intensity * 10) / 10;

      areaIntensities.push({ code, intensity });
    }

    return { header, stations, areaIntensities };
  }
}

module.exports = { RTSParser };
