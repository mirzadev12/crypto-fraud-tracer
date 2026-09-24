// node --test tests/   (Node 24 strips the types from lib/evm.ts itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  checkEvmAddress,
  isEvmTxHash,
  keccak256,
  sha3_256,
  toChecksumAddress,
  toHex,
  wordToAddress,
} from "../lib/evm.ts";

const utf8 = (s) => new TextEncoder().encode(s);

test("keccak256 known vectors", () => {
  assert.equal(
    toHex(keccak256(utf8(""))),
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
  assert.equal(
    toHex(keccak256(utf8("abc"))),
    "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
  );
  // The ERC-20 Transfer event topic every USDT log carries.
  assert.equal(
    toHex(keccak256(utf8("Transfer(address,address,uint256)"))),
    "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  );
});

test("the permutation matches Node's SHA3-256 at every length across three blocks", () => {
  for (let n = 0; n <= 420; n++) {
    const data = randomBytes(n);
    assert.equal(
      toHex(sha3_256(new Uint8Array(data))),
      createHash("sha3-256").update(data).digest("hex"),
      `length ${n}`,
    );
  }
});

test("EIP-55 examples from the EIP", () => {
  for (const a of [
    "0x52908400098527886E0F7030069857D2E4169EE7",
    "0x8617E340B3D01FA5F11F306F4090FD50E238070D",
    "0xde709f2102306220921060314715629080e2fb77",
    "0x27b1fdb04752bbc536007a920d24acb045561c26",
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ]) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a);
  }
  // USDT, as every explorer prints it.
  assert.equal(
    toChecksumAddress("0xdac17f958d2ee523a2206206994597c13d831ec7"),
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  );
});

test("address check: checksum verified, absent, or wrong", () => {
  const good = checkEvmAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  assert.deepEqual(good, {
    valid: true,
    address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    checksummed: true,
  });
  const lower = checkEvmAddress(" 0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed ");
  assert.equal(lower.valid, true);
  assert.equal(lower.checksummed, false);
  assert.equal(lower.address, "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  // One letter's case flipped: a typo the checksum catches.
  const typo = checkEvmAddress("0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  assert.equal(typo.valid, false);
  assert.match(typo.reason, /Checksum/);
  assert.equal(checkEvmAddress("0x123").valid, false);
  assert.equal(checkEvmAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").valid, false);
  assert.equal(checkEvmAddress("0xZZ5aeb6053f3e94c9b9a09f33669435e7ef1beaed").valid, false);
});

test("tx hash and log-word helpers", () => {
  assert.equal(isEvmTxHash(`0x${"ab".repeat(32)}`), true);
  assert.equal(isEvmTxHash("ab".repeat(32)), false);
  assert.equal(
    wordToAddress("0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60"),
    "0x28C6c06298d514Db089934071355E5743bf21d60",
  );
  assert.equal(wordToAddress("0x1234"), null);
});
