/**
 * Which chain an address belongs to — recognised, and traced only on TRON and
 * Ethereum.
 *
 * FineX traces USDT on TRON, where Indian fraud money mostly moves (AGENTS.md
 * §2), and on Ethereum mainnet since the grand-finale build. But the problem statement asks the system to
 * "support multiple blockchain ecosystems", and a complaint does not choose its
 * chain: an officer will paste an Ethereum or Bitcoin address sooner or later.
 * The old answer was "not a valid TRON address", which is true and useless. The
 * answer now names the chain and screens the address against the sanctions list
 * for it (`lib/screen.ts`), so the officer leaves with a finding either way.
 *
 * Synchronous and dependency-free, like `lib/tron.ts`, so the intake form can
 * recognise a chain as the officer types. Where a format carries a checksum
 * (base58check, bech32) the checksum is verified and `verified` says so; where
 * it does not, or where verifying it would need a hash this file does not carry
 * (Ethereum's EIP-55 mixed case and Monero's both need Keccak), the match is on
 * format alone and `verified` is false. A recognised format is a statement about
 * the string, not proof that the address has ever been used.
 */

import { base58Decode, checkTronAddress, sha256 } from "./tron";

export type ChainId =
  | "tron"
  | "evm"
  | "bitcoin"
  | "bitcoin-cash"
  | "bitcoin-gold"
  | "litecoin"
  | "dogecoin"
  | "dash"
  | "zcash"
  | "monero"
  | "xrp"
  | "solana"
  | "bnb-beacon";

export interface ChainInfo {
  id: ChainId;
  /** How the chain is named on screen. */
  name: string;
  /** Whether FineX traces this chain today: TRON, and Ethereum mainnet. */
  traceable: boolean;
  /** One line on what the format also covers, where that matters. */
  note?: string;
}

export const CHAINS: Record<ChainId, ChainInfo> = {
  tron: { id: "tron", name: "TRON", traceable: true },
  evm: {
    id: "evm",
    name: "Ethereum / EVM",
    traceable: true,
    note: "Traced on Ethereum mainnet. The same address format is used on BNB Smart Chain, Arbitrum, Polygon and other EVM chains, which are not read.",
  },
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    traceable: false,
    note: "Legacy addresses starting 1 or 3 are shared with Bitcoin Cash and Bitcoin SV, and some Litecoin addresses start 3.",
  },
  "bitcoin-cash": { id: "bitcoin-cash", name: "Bitcoin Cash", traceable: false },
  "bitcoin-gold": { id: "bitcoin-gold", name: "Bitcoin Gold", traceable: false },
  litecoin: { id: "litecoin", name: "Litecoin", traceable: false },
  dogecoin: {
    id: "dogecoin",
    name: "Dogecoin",
    traceable: false,
    note: "Verge uses the same address prefix.",
  },
  dash: { id: "dash", name: "Dash", traceable: false },
  zcash: { id: "zcash", name: "Zcash (transparent)", traceable: false },
  monero: { id: "monero", name: "Monero", traceable: false },
  xrp: { id: "xrp", name: "XRP Ledger", traceable: false },
  solana: { id: "solana", name: "Solana", traceable: false },
  "bnb-beacon": { id: "bnb-beacon", name: "BNB Beacon Chain", traceable: false },
};

export interface ChainGuess {
  chain: ChainInfo;
  /** True only when a checksum embedded in the address was checked and matched. */
  verified: boolean;
}

/* ------------------------------------------------------------ base58check */

/** Version bytes, when the address is base58check and its checksum matches. */
function base58check(raw: string): Uint8Array | null {
  const bytes = base58Decode(raw);
  if (!bytes || bytes.length < 5) return null;
  const payload = bytes.subarray(0, bytes.length - 4);
  const checksum = bytes.subarray(bytes.length - 4);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expected[i]) return null;
  return payload;
}

/* ----------------------------------------------------------------- bech32 */

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

/** Human-readable part, when `raw` is valid bech32 or bech32m (BIP-173 / BIP-350). */
function bech32Hrp(raw: string): string | null {
  // Mixed case is invalid; either case alone is fine.
  if (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) return null;
  const s = raw.toLowerCase();
  const sep = s.lastIndexOf("1");
  if (sep < 1 || sep + 7 > s.length || s.length > 90) return null;
  const hrp = s.slice(0, sep);
  const data: number[] = [];
  for (const ch of s.slice(sep + 1)) {
    const v = BECH32_CHARSET.indexOf(ch);
    if (v === -1) return null;
    data.push(v);
  }
  const values = [
    ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...hrp].map((c) => c.charCodeAt(0) & 31),
    ...data,
  ];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) ^ v) >>> 0;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk = (chk ^ BECH32_GEN[i]) >>> 0;
  }
  // 1 is bech32 (segwit v0, BNB); 0x2bc830a3 is bech32m (taproot).
  return chk === 1 || chk === 0x2bc830a3 ? hrp : null;
}

/* --------------------------------------------------------------- cashaddr */

// 40-bit constants, so BigInt; built with calls because the compile target
// (ES2017) has no BigInt literals.
const CASHADDR_GEN = ["0x98f2bc8e61", "0x79b76d99e2", "0xf33e5fb3c4", "0xae2eabe2a8", "0x1e4f43e470"].map(
  (h) => BigInt(h),
);

/** Bitcoin Cash's own address format, with or without its `bitcoincash:` prefix. */
function isCashAddr(raw: string): boolean {
  if (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) return false;
  const s = raw.toLowerCase();
  const body = s.startsWith("bitcoincash:") ? s.slice("bitcoincash:".length) : s;
  if (!/^[qp][qpzry9x8gf2tvdw0s3jn54khce6mua7l]{41}$/.test(body)) return false;
  const values = [
    ...[..."bitcoincash"].map((c) => c.charCodeAt(0) & 31),
    0,
    ...[...body].map((c) => BECH32_CHARSET.indexOf(c)),
  ];
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const LOW35 = BigInt("0x07ffffffff");
  let chk = ONE;
  for (const v of values) {
    const top = chk >> BigInt(35);
    chk = ((chk & LOW35) << BigInt(5)) ^ BigInt(v);
    for (let i = 0; i < 5; i++) if (((top >> BigInt(i)) & ONE) !== ZERO) chk ^= CASHADDR_GEN[i];
  }
  return (chk ^ ONE) === ZERO;
}

/* ------------------------------------------------------------- recognise */

const guess = (id: ChainId, verified: boolean): ChainGuess => ({ chain: CHAINS[id], verified });

/**
 * The chain an address belongs to, or null when the string is not a format
 * this file recognises. TRON is tested first and only on a full checksum, so a
 * mistyped TRON address is never offered to the officer as some other chain.
 */
export function identifyChain(raw: string): ChainGuess | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;

  if (checkTronAddress(s).valid) return guess("tron", true);
  // A string that looks like TRON but fails the checksum is a typo, not a clue.
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return null;

  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return guess("evm", false);

  const hrp = bech32Hrp(s);
  if (hrp === "bc") return guess("bitcoin", true);
  if (hrp === "ltc") return guess("litecoin", true);
  if (hrp === "bnb") return guess("bnb-beacon", true);
  if (isCashAddr(s)) return guess("bitcoin-cash", true);

  if (/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(s)) return guess("monero", false);

  const payload = /^[1-9A-HJ-NP-Za-km-z]+$/.test(s) ? base58check(s) : null;
  if (payload && payload.length === 21) {
    switch (payload[0]) {
      case 0x00:
      case 0x05:
        return guess("bitcoin", true);
      case 0x30:
      case 0x32:
        return guess("litecoin", true);
      case 0x1e:
        return guess("dogecoin", true);
      case 0x26:
      case 0x17:
        return guess("bitcoin-gold", true);
      case 0x4c:
      case 0x10:
        return guess("dash", true);
    }
  }
  if (payload && payload.length === 22 && payload[0] === 0x1c && (payload[1] === 0xb8 || payload[1] === 0xbd)) {
    return guess("zcash", true);
  }

  // XRP uses its own base58 alphabet and checksum; matched on format only.
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(s)) return guess("xrp", false);

  // A Solana address is a bare 32-byte key in base58, with no checksum.
  if (s.length >= 32 && s.length <= 44) {
    const bytes = base58Decode(s);
    if (bytes && bytes.length === 32) return guess("solana", false);
  }

  return null;
}
