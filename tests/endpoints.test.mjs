import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  PUBLIC,
  blockscoutKey,
  ethHistory,
  ethNodes,
  readSources,
  tronHistory,
  tronKey,
  tronNode,
} from "../lib/endpoints.ts";

const NAMES = ["TRONGRID_URL", "TRON_NODE_URL", "BLOCKSCOUT_URL", "ETH_RPC_URL", "TRONGRID_API_KEY", "BLOCKSCOUT_API_KEY"];

/** Run with exactly these settings — until an async body has finished — then put the environment back. */
async function withEnv(values, run) {
  const before = Object.fromEntries(NAMES.map((n) => [n, process.env[n]]));
  for (const n of NAMES) delete process.env[n];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const n of NAMES) {
      if (before[n] === undefined) delete process.env[n];
      else process.env[n] = before[n];
    }
  }
}

test("with nothing set, every read is public and keys go to their own services", async () => {
  await withEnv({ TRONGRID_API_KEY: "tk", BLOCKSCOUT_API_KEY: "bk" }, () => {
    assert.deepEqual(tronHistory(), { base: PUBLIC.tron, source: "public" });
    assert.deepEqual(tronNode(), { base: PUBLIC.tron, source: "public" });
    assert.deepEqual(ethHistory(), { base: PUBLIC.ethereumKeyed, source: "public" }, "a key means the Pro API");
    assert.deepEqual(ethNodes(), { bases: [...PUBLIC.rpcs], source: "public" });
    assert.equal(tronKey(tronHistory()), "tk");
    assert.equal(blockscoutKey(), "bk");
  });
  await withEnv({}, () => assert.equal(ethHistory().base, PUBLIC.ethereum));
});

test("an own endpoint is used alone, and is never sent a public key", async () => {
  await withEnv(
    { TRONGRID_URL: "http://tron.agency.local/", BLOCKSCOUT_URL: "https://blockscout.agency.local/api/v2/", TRONGRID_API_KEY: "tk", BLOCKSCOUT_API_KEY: "bk" },
    () => {
      assert.deepEqual(tronHistory(), { base: "http://tron.agency.local", source: "own" });
      assert.deepEqual(tronNode(), { base: "http://tron.agency.local", source: "own" }, "the TRON node read stays in-house too");
      assert.equal(tronKey(tronHistory()), null);
      assert.deepEqual(ethHistory(), { base: "https://blockscout.agency.local/api/v2", source: "own" });
      assert.equal(blockscoutKey(), null);
      assert.deepEqual(ethNodes(), { bases: [], source: "none" }, "no public Ethereum node once Ethereum is read in-house");
      assert.deepEqual(readSources(), { tronHistory: "own", tronNode: "own", ethHistory: "own", ethNode: "none" });
    },
  );
  await withEnv({ TRON_NODE_URL: "http://node:8090", ETH_RPC_URL: "http://geth:8545" }, () => {
    assert.deepEqual(readSources(), { tronHistory: "public", tronNode: "own", ethHistory: "public", ethNode: "own" });
    assert.deepEqual(ethNodes().bases, ["http://geth:8545"]);
  });
});

test("a setting that is not an http(s) URL fails, and never falls back to public", async () => {
  await withEnv({ TRONGRID_URL: "tron.agency.local", BLOCKSCOUT_URL: "ftp://x", ETH_RPC_URL: "nonsense" }, () => {
    assert.deepEqual(tronHistory(), { base: null, source: "invalid" });
    assert.deepEqual(tronNode(), { base: null, source: "invalid" });
    assert.deepEqual(ethHistory(), { base: null, source: "invalid" });
    assert.deepEqual(ethNodes(), { bases: [], source: "invalid" });
  });
});

test("a TRON history read pages by cursor on its own endpoint, never by the absolute link it is handed", async () => {
  const seen = { own: [], elsewhere: 0 };
  const elsewhere = createServer((req, res) => {
    seen.elsewhere += 1;
    res.end("{}");
  });
  await new Promise((r) => elsewhere.listen(0, "127.0.0.1", r));
  const row = (i) => ({
    transaction_id: i.toString(16).padStart(64, "0"),
    block_timestamp: 1_790_000_000_000 - i * 1000,
    from: "TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN",
    to: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
    value: "1000000",
    token_info: { symbol: "USDT", decimals: 6, address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
    type: "Transfer",
  });
  const own = createServer((req, res) => {
    const url = new URL(req.url, "http://own");
    seen.own.push(url.pathname + url.search);
    const second = url.searchParams.has("fingerprint");
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        data: second ? [row(200)] : Array.from({ length: 200 }, (_, i) => row(i)),
        meta: second
          ? { at: 0, page_size: 1 }
          : {
              at: 0,
              page_size: 200,
              fingerprint: "cursor-1",
              // A mirror of TronGrid hands back TronGrid's own absolute link.
              links: { next: `http://127.0.0.1:${elsewhere.address().port}/v1/accounts/x/transactions/trc20?fingerprint=cursor-1` },
            },
      }),
    );
  });
  await new Promise((r) => own.listen(0, "127.0.0.1", r));
  try {
    await withEnv({ TRONGRID_URL: `http://127.0.0.1:${own.address().port}` }, async () => {
      const { TronGrid } = await import("../lib/trongrid.ts");
      const client = new TronGrid();
      const got = await client.transfers("TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN");
      assert.equal(got.length, 201, "both pages read");
      assert.equal(client.wasTruncated("TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN"), false);
    });
    assert.equal(seen.elsewhere, 0, "the absolute link was never followed");
    assert.equal(seen.own.length, 2);
    assert.match(seen.own[1], /^\/v1\/accounts\/TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN\/transactions\/trc20\?limit=200&only_confirmed=true&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&fingerprint=cursor-1$/);
  } finally {
    own.close();
    elsewhere.close();
  }
});
