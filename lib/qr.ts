/**
 * QR code encoder: byte mode, versions 1 to 15, any error-correction level.
 *
 * It exists for one job: the check link on a printed evidence packet has to be
 * openable from paper, and a 250-character link cannot be typed. AGENTS.md §3
 * allows no new dependency, and the standard (ISO/IEC 18004) is small enough
 * to carry: Reed–Solomon over GF(256), a fixed placement, eight masks. The
 * packet uses level M, which recovers about 15% of a damaged or badly printed
 * code; the other levels are here so the encoder can be checked against codes
 * made elsewhere (tests/qr.test.mjs).
 *
 * Checked against an independent decoder (jsQR 1.4.0): every version, level
 * and mask decodes to the text that went in — see
 * docs/features/07-tamper-evident-packet.md.
 */

export type EcLevel = "L" | "M" | "Q" | "H";

type Blocks = readonly [number, ReadonlyArray<readonly [number, number]>];

/** Per level and version: EC codewords per block, then [block count, data codewords per block]. */
const BLOCKS: Record<EcLevel, ReadonlyArray<Blocks>> = {
  L: [
    [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]],
    [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]],
    [20, [[4, 81]]], [24, [[2, 92], [2, 93]]], [26, [[4, 107]]], [30, [[3, 115], [1, 116]]],
    [22, [[5, 87], [1, 88]]],
  ],
  M: [
    [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
    [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]],
    [26, [[4, 43], [1, 44]]], [30, [[1, 50], [4, 51]]], [22, [[6, 36], [2, 37]]],
    [22, [[8, 37], [1, 38]]], [24, [[4, 40], [5, 41]]], [24, [[5, 41], [5, 42]]],
  ],
  Q: [
    [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]],
    [24, [[4, 19]]], [18, [[2, 14], [4, 15]]], [22, [[4, 18], [2, 19]]], [20, [[4, 16], [4, 17]]],
    [24, [[6, 19], [2, 20]]], [28, [[4, 22], [4, 23]]], [26, [[4, 20], [6, 21]]],
    [24, [[8, 20], [4, 21]]], [20, [[11, 16], [5, 17]]], [30, [[5, 24], [7, 25]]],
  ],
  H: [
    [17, [[1, 9]]], [28, [[1, 16]]], [22, [[2, 13]]], [16, [[4, 9]]], [22, [[2, 11], [2, 12]]],
    [28, [[4, 15]]], [26, [[4, 13], [1, 14]]], [26, [[4, 14], [2, 15]]], [24, [[4, 12], [4, 13]]],
    [28, [[6, 15], [2, 16]]], [24, [[3, 12], [8, 13]]], [28, [[7, 14], [4, 15]]],
    [22, [[12, 11], [4, 12]]], [24, [[11, 12], [5, 13]]], [24, [[11, 12], [7, 13]]],
  ],
};

/** The two format bits that name each level. */
const LEVEL_BITS: Record<EcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

export const QR_MAX_VERSION = 15;

/** Data codewords a version holds at a level. */
export function dataCodewords(version: number, level: EcLevel = "M"): number {
  return BLOCKS[level][version - 1][1].reduce((sum, [count, data]) => sum + count * data, 0);
}

/** Modules left for data and EC once the function patterns are placed. */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Total codewords (data + EC) the table assigns a version; must equal rawDataModules / 8. */
export function tableCodewords(version: number, level: EcLevel): number {
  const [ec, groups] = BLOCKS[level][version - 1];
  return groups.reduce((sum, [count, data]) => sum + count * (data + ec), 0);
}

// --------------------------------------------------------------- GF(256)

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

// --------------------------------------------------------------- matrix

type Grid = boolean[][];

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const size = version * 4 + 17;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function formatBits(level: EcLevel, mask: number): number {
  const data = (LEVEL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

class Matrix {
  readonly version: number;
  readonly size: number;
  readonly dark: Grid;
  readonly fixed: Grid;

  readonly level: EcLevel;

  constructor(version: number, level: EcLevel) {
    this.version = version;
    this.level = level;
    this.size = version * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  private set(x: number, y: number, dark: boolean) {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }

  drawFunctionPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          this.set(x, y, d !== 2 && d !== 4);
        }
      }
    }
    const align = alignmentPositions(this.version);
    const last = align.length - 1;
    align.forEach((cx, i) =>
      align.forEach((cy, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }),
    );
    this.drawFormat(0); // reserves the format area; redrawn once the mask is chosen
    if (this.version >= 7) {
      const bits = versionBits(this.version);
      for (let i = 0; i < 18; i++) {
        const a = n - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, bit(bits, i));
        this.set(b, a, bit(bits, i));
      }
    }
  }

  drawFormat(mask: number) {
    const n = this.size;
    const bits = formatBits(this.level, mask);
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(bits, i));
    this.set(8, n - 8, true); // the dark module
  }

  drawCodewords(codewords: number[]) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = upward ? n - 1 - vert : vert;
          if (this.fixed[y][x] || i >= codewords.length * 8) continue;
          this.dark[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }

  applyMask(mask: number) {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (this.fixed[y][x]) continue;
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (invert) this.dark[y][x] = !this.dark[y][x];
      }
    }
  }

  /** The standard's four penalty rules; the mask with the lowest score is used. */
  penalty(): number {
    const n = this.size;
    const g = this.dark;
    let score = 0;
    const finderLike = [
      [true, false, true, true, true, false, true, false, false, false, false],
      [false, false, false, false, true, false, true, true, true, false, true],
    ];
    for (let a = 0; a < n; a++) {
      for (const at of [(b: number) => g[a][b], (b: number) => g[b][a]]) {
        let run = 1;
        for (let b = 1; b <= n; b++) {
          if (b < n && at(b) === at(b - 1)) {
            run++;
          } else {
            if (run >= 5) score += 3 + (run - 5);
            run = 1;
          }
        }
        for (let b = 0; b + 11 <= n; b++) {
          for (const pattern of finderLike) {
            if (pattern.every((v, k) => at(b + k) === v)) score += 40;
          }
        }
      }
    }
    for (let y = 0; y + 1 < n; y++) {
      for (let x = 0; x + 1 < n; x++) {
        const c = g[y][x];
        if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) score += 3;
      }
    }
    const dark = g.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const total = n * n;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

export interface QrCode {
  version: number;
  level: EcLevel;
  mask: number;
  /** modules[y][x]; true is dark. No quiet zone — the renderer adds it. */
  modules: boolean[][];
}

/**
 * Encode text as a QR code, or null if it is longer than version 15 holds at
 * the level (412 bytes at M). The level defaults to M. `mask` forces one mask,
 * for testing; normally the standard's penalty score chooses.
 */
export function encodeQr(
  text: string,
  { level = "M", mask }: { level?: EcLevel; mask?: number } = {},
): QrCode | null {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (bytes.length < 2 ** countBits && 4 + countBits + bytes.length * 8 <= dataCodewords(v, level) * 8) {
      version = v;
      break;
    }
  }
  if (!version) return null;

  // Bit stream: byte-mode indicator, character count, the bytes, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  const capacity = dataCodewords(version, level) * 8;
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  }
  for (let pad = 0xec; data.length < dataCodewords(version, level); pad ^= 0xec ^ 0x11) data.push(pad);

  // Split into blocks, add EC to each, interleave.
  const [ecLength, groups] = BLOCKS[level][version - 1];
  const divisor = rsDivisor(ecLength);
  const blocks: Array<{ data: number[]; ec: number[] }> = [];
  let offset = 0;
  for (const [count, length] of groups) {
    for (let k = 0; k < count; k++) {
      const chunk = data.slice(offset, offset + length);
      offset += length;
      blocks.push({ data: chunk, ec: rsRemainder(chunk, divisor) });
    }
  }
  const codewords: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) {
    for (const b of blocks) if (i < b.data.length) codewords.push(b.data[i]);
  }
  for (let i = 0; i < ecLength; i++) for (const b of blocks) codewords.push(b.ec[i]);

  const m = new Matrix(version, level);
  m.drawFunctionPatterns();
  m.drawCodewords(codewords);

  let chosen = mask ?? -1;
  if (chosen < 0) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      m.applyMask(candidate);
      m.drawFormat(candidate);
      const score = m.penalty();
      if (score < best) {
        best = score;
        chosen = candidate;
      }
      m.applyMask(candidate); // XOR again undoes it
    }
  }
  m.applyMask(chosen);
  m.drawFormat(chosen);
  return { version, level, mask: chosen, modules: m.dark };
}
