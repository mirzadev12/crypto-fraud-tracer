# Reading the chain from the agency's own nodes

## What it does

Every read FineX makes names a wallet an officer is investigating. Against the
public endpoints (TronGrid, Blockscout, public Ethereum nodes), that is a
running record, held by third parties, of which wallets Indian law enforcement
is looking at and when. A laundering network would pay for exactly that signal.
The blockchain is public; **what investigators are looking at is not**.

FineX can now point each kind of chain read at infrastructure the agency runs
itself, with one setting each:

| Setting | What it reads | What must answer there |
| --- | --- | --- |
| `TRONGRID_URL` | TRON wallet histories (every trace, the watch, the alerts, the wallet card, payers) and transaction lookups | An API serving TronGrid's `/v1/accounts/{address}/transactions/trc20` and `/v1/transactions/{id}/events` |
| `TRON_NODE_URL` | The Tether freeze check on TRON | A TRON full node's HTTP API (`/wallet/triggerconstantcontract`), which java-tron serves as it stands |
| `BLOCKSCOUT_URL` | Every Ethereum read | A Blockscout instance's API base, ending `/api/v2`. Blockscout is open source |
| `ETH_RPC_URL` | The Tether freeze check on Ethereum | Any Ethereum JSON-RPC node, such as geth, Erigon or Nethermind |

Four rules, all for one reason: a silent fallback would send out the very
wallet a setting exists to keep in-house.

- **A setting that is given is used alone.** When the agency's node is down,
  those reads fail and say so; they never go to a public endpoint instead. A
  setting that is not an http(s) URL fails the same way, at once.
- **A chain read in-house stays in-house.**
  - With `TRONGRID_URL` set, the TRON freeze check uses `TRON_NODE_URL`, or
    else the same host (TronGrid serves both APIs).
  - With `BLOCKSCOUT_URL` set, the Ethereum freeze check uses `ETH_RPC_URL`, or
    else is not made. The check then says why, instead of asking a public node.
- **Pages are followed by cursor, on the configured endpoint.** TronGrid hands
  back each next page as an absolute link. A mirror or proxy of TronGrid would
  pass on links to the public host, so FineX builds the next page itself from
  the documented cursor (`fingerprint`). Checked live: TronGrid's own link and
  the one FineX builds have the same path and the same parameters.
- **A key goes only to the service it belongs to.** `TRONGRID_API_KEY` and
  `BLOCKSCOUT_API_KEY` are never sent to an agency's endpoint.

`/api/health` now reports `reads`: for each kind of read, `own`, `public`,
`invalid` or `none` (not made). It never gives the address, so an uptime monitor
or a teammate can see at a glance whether anything still goes public.

**It is also faster.** An agency's own endpoint has no public rate limit, so
the gap between reads drops from 250–350 ms to 20 ms. A refusal still doubles
it, whoever sends it.

## How to use it

Set the four variables where the server runs (the hosting dashboard, or the
service's environment), restart, and open `/api/health`: all four `reads` should
say `own`. Leave any of them unset to keep that kind of read on the public
endpoint.

What to run behind them:

- **Ethereum:**
  - an Ethereum node (`ETH_RPC_URL`);
  - Blockscout, which is open source and indexes that node (`BLOCKSCOUT_URL`,
    ending `/api/v2`).

  FineX needs nothing that Blockscout's standard API does not already serve.
- **TRON:**
  - a java-tron full node answers the freeze check (`TRON_NODE_URL`) as it
    stands;
  - wallet histories (`TRONGRID_URL`) need an indexer that serves TronGrid's two
    routes above. TronGrid itself is not open source, and no open-source drop-in
    was verified here. An agency would run an indexer exposing those routes, or
    a licensed on-premises TronGrid.

## Verified

- **Unit tests, `tests/endpoints.test.mjs` (4):**
  - with nothing set, every read is public and each key goes only to its own
    service;
  - an own endpoint is used alone and sent no key, the TRON node read follows
    TRON history in-house, and Ethereum's freeze check is not made from a public
    node;
  - a setting that is not a URL fails and never falls back;
  - **the leak test.** A stand-in "own" TronGrid returns a full page whose
    `links.next` points at a different host. The client asks its own server for
    page 2 by cursor, and the other host receives **zero** requests.
- **The paging change against the live chain:** all 13 recorded cases (10
  TRON, 3 Ethereum), re-derived from the chain as of their capture, fingerprint
  exactly as their recorded copies do (13 same, 0 different, 0 errors).
- **End to end, 18 of 18,** on a production build. The agency's node was a
  stand-in that relays to the public services and counts every request it
  carries:
  - **Health:** every kind of read reports `own`, and the address is never
    shown.
  - **Traces:** a TRON and an Ethereum recorded case, re-derived through the
    agency's node, are identical to their recorded copies. Every one of each
    trace's chain requests went through that node (103 of 103 for TRON, 6 of 6
    for Ethereum).
  - **Everything else:** both freeze checks, the transaction lookup and the
    watch went through the agency's node.
  - **Node down:** the trace reads nothing, and says "this deployment's own
    endpoint did not answer". The freeze check reads "unchecked". Nothing is
    answered from elsewhere.
  - **Only the explorer in-house:** the Ethereum freeze check says why it was
    not made, instead of asking a public node.
  - **A setting that is not a URL:** health reports it invalid, and a trace
    fails in 19 ms, naming the setting.
  - No unexpected server errors.
- **The failure sentence was fixed along the way.** An unread wallet used to be
  blamed on "the public endpoint … rate-limiting this deployment", whatever the
  endpoint was. It now names the real cause (`unreadCause`).
- **Regression:**
  - tsc, eslint and the build are clean, and all 73 unit tests pass;
  - demo mode serves every recorded case (14 of 14);
  - the route × width sweep is clean (32 of 32).

## Limits

- **TRON histories need a TronGrid-compatible indexer.** No open-source one was
  verified here, and the note says so rather than naming one.
- **The command-line scripts** (`scripts/*.mjs`: clustering, calibration,
  verification) are offline tools and still read public endpoints. Run them
  from a machine where that is acceptable.
- **The agency's node is trusted as the public one was.** Every response is
  still hashed for the chain of custody, and `scripts/verify-case.mjs` can
  re-check a case against other nodes.
- **Explorer links on screen** ("Open in block explorer") still go to the
  public explorers. Clicking one tells that site which address was opened. That
  is an officer's click, not a server read, and repointing the links is not
  built yet.
