/**
 * TRON address handling, dependency-free and synchronous so the investigate
 * form can validate as the officer types.
 *
 * A TRON base58 address is base58check over 21 bytes: a 0x41 prefix followed by
 * the 20-byte account hash, with a 4-byte double-SHA256 checksum appended. That
 * makes a full checksum check possible in the browser — a typo'd address is
 * caught before we spend an API call on it.
 */

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP: Record<string, number> = {};
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP[B58_ALPHABET[i]] = i;

/* ------------------------------------------------------------------ sha256 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** Minimal synchronous SHA-256 over bytes. */
export function sha256(input: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = input.length * 8;
  const padded = new Uint8Array((((input.length + 8) >> 6) + 1) * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  // Length is a 64-bit big-endian bit count; addresses are far below 2^32 bits,
  // so the high word is always zero here.
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

/* ------------------------------------------------------------------ base58 */

function base58Decode(input: string): Uint8Array | null {
  const bytes: number[] = [0];
  for (const ch of input) {
    const value = B58_MAP[ch];
    if (value === undefined) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1' characters are leading zero bytes.
  for (let i = 0; i < input.length && input[i] === "1"; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/* ---------------------------------------------------------------- address */

export type AddressCheck =
  | { valid: true }
  | { valid: false; reason: string };

/** Full base58check validation of a TRON mainnet address. */
export function checkTronAddress(raw: string): AddressCheck {
  const address = raw.trim();
  if (!address) return { valid: false, reason: "Enter a TRON wallet address." };
  if (!address.startsWith("T")) {
    return { valid: false, reason: "A TRON address starts with 'T'." };
  }
  if (address.length !== 34) {
    return {
      valid: false,
      reason: `A TRON address is 34 characters — this one is ${address.length}.`,
    };
  }
  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) {
    return { valid: false, reason: "Not a valid base58 address." };
  }
  if (decoded[0] !== 0x41) {
    return { valid: false, reason: "Not a TRON mainnet address." };
  }
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expected[i]) {
      return {
        valid: false,
        reason: "Checksum does not match — the address is likely mistyped.",
      };
    }
  }
  return { valid: true };
}

export function isValidTronAddress(address: string): boolean {
  return checkTronAddress(address).valid;
}
