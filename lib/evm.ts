/**
 * Ethereum address handling, dependency-free and synchronous like `lib/tron.ts`,
 * so the intake form can check an address as the officer types.
 *
 * An Ethereum address is the last 20 bytes of a Keccak-256 hash, written as 40
 * hex characters. EIP-55 folds a checksum into the letter case: each letter is
 * upper-case where the matching nibble of keccak256(lower-case address) is 8 or
 * more. A mixed-case address that does not match is a typo, caught here before a
 * chain read is spent on it. An all-lower or all-upper address carries no
 * checksum at all, which is stated rather than treated as verified.
 *
 * Keccak-256 is the original Keccak padding (0x01), not NIST SHA3-256 (0x06);
 * the permutation is shared, so SHA3 is exposed for the test that checks this
 * implementation against Node's own `sha3-256`.
 */

/* ----------------------------------------------------------- keccak-f[1600] */

// 64-bit round constants, split into [low, high] 32-bit halves.
const RC: ReadonlyArray<readonly [number, number]> = [
  [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000],
  [0x80008000, 0x80000000], [0x0000808b, 0x00000000], [0x80000001, 0x00000000],
  [0x80008081, 0x80000000], [0x00008009, 0x80000000], [0x0000008a, 0x00000000],
  [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
  [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000],
  [0x00008003, 0x80000000], [0x00008002, 0x80000000], [0x00000080, 0x80000000],
  [0x0000800a, 0x00000000], [0x8000000a, 0x80000000], [0x80008081, 0x80000000],
  [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000],
];

// Rotation offsets, indexed by lane x + 5y.
const ROT = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

function permute(lo: Uint32Array, hi: Uint32Array): void {
  const cLo = new Uint32Array(5);
  const cHi = new Uint32Array(5);
  const bLo = new Uint32Array(25);
  const bHi = new Uint32Array(25);

  for (let round = 0; round < 24; round++) {
    // θ
    for (let x = 0; x < 5; x++) {
      cLo[x] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20];
      cHi[x] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const nLo = cLo[(x + 1) % 5];
      const nHi = cHi[(x + 1) % 5];
      // rotate the next column's parity left by one
      const dLo = cLo[(x + 4) % 5] ^ ((nLo << 1) | (nHi >>> 31));
      const dHi = cHi[(x + 4) % 5] ^ ((nHi << 1) | (nLo >>> 31));
      for (let y = 0; y < 25; y += 5) {
        lo[y + x] ^= dLo;
        hi[y + x] ^= dHi;
      }
    }
    // ρ and π: lane (x, y) moves to (y, 2x + 3y) rotated by its offset.
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const i = x + 5 * y;
        const j = y + 5 * ((2 * x + 3 * y) % 5);
        const n = ROT[i];
        const l = lo[i];
        const h = hi[i];
        if (n === 0) {
          bLo[j] = l;
          bHi[j] = h;
        } else if (n < 32) {
          bLo[j] = (l << n) | (h >>> (32 - n));
          bHi[j] = (h << n) | (l >>> (32 - n));
        } else if (n === 32) {
          bLo[j] = h;
          bHi[j] = l;
        } else {
          const m = n - 32;
          bLo[j] = (h << m) | (l >>> (32 - m));
          bHi[j] = (l << m) | (h >>> (32 - m));
        }
      }
    }
    // χ
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        const a = y + x;
        const b = y + ((x + 1) % 5);
        const c = y + ((x + 2) % 5);
        lo[a] = bLo[a] ^ (~bLo[b] & bLo[c]);
        hi[a] = bHi[a] ^ (~bHi[b] & bHi[c]);
      }
    }
    // ι
    lo[0] ^= RC[round][0];
    hi[0] ^= RC[round][1];
  }
}

/** Keccak sponge with a 1088-bit rate and a 256-bit output. */
function sponge256(input: Uint8Array, domain: number): Uint8Array {
  const RATE = 136;
  const lo = new Uint32Array(25);
  const hi = new Uint32Array(25);

  const blocks = Math.floor(input.length / RATE) + 1;
  const padded = new Uint8Array(blocks * RATE);
  padded.set(input);
  padded[input.length] ^= domain;
  padded[padded.length - 1] ^= 0x80;

  for (let offset = 0; offset < padded.length; offset += RATE) {
    for (let lane = 0; lane < RATE / 8; lane++) {
      const p = offset + lane * 8;
      lo[lane] ^=
        padded[p] | (padded[p + 1] << 8) | (padded[p + 2] << 16) | (padded[p + 3] << 24);
      hi[lane] ^=
        padded[p + 4] | (padded[p + 5] << 8) | (padded[p + 6] << 16) | (padded[p + 7] << 24);
    }
    permute(lo, hi);
  }

  const out = new Uint8Array(32);
  for (let lane = 0; lane < 4; lane++) {
    for (let b = 0; b < 4; b++) {
      out[lane * 8 + b] = (lo[lane] >>> (8 * b)) & 0xff;
      out[lane * 8 + 4 + b] = (hi[lane] >>> (8 * b)) & 0xff;
    }
  }
  return out;
}

/** Keccak-256 as Ethereum uses it. */
export function keccak256(input: Uint8Array): Uint8Array {
  return sponge256(input, 0x01);
}

/** NIST SHA3-256 on the same permutation — exported for the self-test only. */
export function sha3_256(input: Uint8Array): Uint8Array {
  return sponge256(input, 0x06);
}

export function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/* ---------------------------------------------------------------- address */

const HEX40 = /^0x[0-9a-fA-F]{40}$/;

/**
 * The EIP-55 form of an address: the case every explorer prints. Throws on a
 * string that is not 40 hex characters after `0x`; callers check first.
 */
export function toChecksumAddress(address: string): string {
  if (!HEX40.test(address)) throw new Error(`Not an Ethereum address: ${address}`);
  const lower = address.slice(2).toLowerCase();
  const hash = toHex(keccak256(new TextEncoder().encode(lower)));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    const c = lower[i];
    out += parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c;
  }
  return out;
}

export type EvmAddressCheck =
  | {
      valid: true;
      /** The EIP-55 form — the one form this app stores and compares. */
      address: string;
      /** Whether the input carried a checksum that was verified. */
      checksummed: boolean;
    }
  | { valid: false; reason: string };

/** Format and, where the input carries one, EIP-55 checksum. */
export function checkEvmAddress(raw: string): EvmAddressCheck {
  const address = raw.trim();
  if (!address) return { valid: false, reason: "Enter an Ethereum address." };
  if (!/^0x/i.test(address)) {
    return { valid: false, reason: "An Ethereum address starts with '0x'." };
  }
  if (address.length !== 42) {
    return {
      valid: false,
      reason: `An Ethereum address is 42 characters — this one is ${address.length}.`,
    };
  }
  if (!HEX40.test(address)) {
    return { valid: false, reason: "An Ethereum address is 40 hexadecimal characters after '0x'." };
  }
  const body = address.slice(2);
  const canonical = toChecksumAddress(address);
  const uniform = body === body.toLowerCase() || body === body.toUpperCase();
  if (uniform) return { valid: true, address: canonical, checksummed: false };
  if (canonical !== address) {
    return {
      valid: false,
      reason: "Checksum does not match — the address is likely mistyped.",
    };
  }
  return { valid: true, address: canonical, checksummed: true };
}

export function isEvmAddress(raw: string): boolean {
  return checkEvmAddress(raw).valid;
}

/** An Ethereum transaction hash: `0x` and 64 hex characters. */
export function isEvmTxHash(raw: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(raw.trim());
}

/**
 * A 32-byte log topic or word holding an address, as the last 20 bytes, in
 * EIP-55 form. Returns null rather than guessing.
 */
export function wordToAddress(word: string): string | null {
  const clean = word.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) return null;
  return toChecksumAddress(`0x${clean.slice(24)}`);
}
