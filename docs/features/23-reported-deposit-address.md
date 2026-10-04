# A reported address that is itself the answer

## What it does

The simplest real case is a victim who paid straight into an exchange deposit
address. FineX used to treat the reported address as the subject of a case and
never its finding, so it traced what the exchange did next (the sweeps into its
hot wallet) and named the hot wallet, not the deposit address. The critics'
compliance review probed this live and put it first among the claims that failed
(`docs/review/2026-10-04-critic-ps-compliance.md`).

Now, when the reported address is itself an exchange's, that address is the exit
(`ownExit` in `lib/tracer.ts`):

| The reported address is | Disposition | Terminal |
| --- | --- | --- |
| a derived exchange deposit address | WARM | itself, as the customer deposit address |
| an exchange's tagged hot wallet | WARM | itself, as the hot wallet |
| an OFAC-listed address (or a labelled mixer) | as before: followed onward | wherever the trail ends |

A listed reported address is **not** made the exit. Where a listed entity sent the
money is worth knowing, and two recorded TRON cases are exactly that: their roots
(`TRWDtgCfXzTcMv8W6iJxh6umeqeF3zG7n5`, `TBfVDwNS6hC2Ln2qTLTRKMMPddscFEhhrU`) are
ISIL KHORASAN addresses in `data/risk-lists.json`, and each closes COLD at the next
listed wallet. The first version of this rule made such a root its own exit, which
would have erased that finding on a re-derivation; it was narrowed on 5 Oct before
it shipped. The summary now opens "The reported address is itself on the OFAC
sanctions list, under ISIL KHORASAN" for such a case, which is wording only: the
findings fingerprint is unchanged.

- **It is read, not followed** (`runTrace` in `lib/tracer.ts`). Its own history
  still sets the window and the amount, but like any attributed wallet it ends the
  trace. Its outflows are an exchange's own sweeps, so they are recorded as none:
  no rule scores an exchange's routine as a wallet's behaviour.
- **It is worded as what it is.** `decide()` (now exported) says, for MEXC, "The
  reported address is itself a likely MEXC customer deposit address, so payments to
  it are credited to one account at MEXC; a freeze request naming that address is
  viable". The summary (`lib/narrative.ts`) opens "The reported address … is itself
  attributed to …. It is not followed further". The two exchange leads
  (`lib/leads.ts`) read "the payment went straight into it" and "the whole exchange
  transacts through". Nothing says money "reached" the address it started at.
- **It stays the subject on the canvas** (depth 0), so the result is one wallet
  and no edges.
- **A freeze request is offered** as for any exit: `freezable()` reads the
  terminal's kind.

## How to use it

Paste the wallet in New case, or post it. `TWJvZiEsi3sKhFqbLLBDtZ76xYBKMqnKJ2` is
a derived Bybit deposit address in `data/deposit-addresses.json` (2 sweeps,
confidence 0.56):

```bash
curl -X POST http://localhost:3000/api/trace -H "Content-Type: application/json" -d "{\"address\":\"TWJvZiEsi3sKhFqbLLBDtZ76xYBKMqnKJ2\"}"
```

## Verified

- **Unit tests, `tests/root-exit.test.mjs` (4):**
  - a reported deposit address is the exit, named as itself: WARM, the terminal
    and the deposit address are the address, and the reason begins "The reported
    address is itself a likely MEXC customer deposit address" and never says
    "reached";
  - only an exchange's address is its own exit (`ownExit`); a sanctioned label
    returns nothing, so a listed root is followed onward;
  - an unattributed reported address is decided as before;
  - the summary says what the address is, not that money reached it.
- **Live probe, 4 Oct 2026**, `TWJvZi…` above: WARM in about a second, terminal the
  address itself, 1 wallet, 0 edges, no flags.
- **Recorded cases.** Checked against the label tables on 5 Oct 2026: 12 of the 14
  recorded roots carry no attribution and the other two are OFAC-listed, which this
  rule does not touch, so the engine reads all 14 as before. `scripts/check-demo.mjs`
  passes 15 of 15 against a demo-mode server (14 recorded cases and the one address
  the file does not hold).

## Limits

- **The freeze request has no traced transfer to list.** None exists: the payment
  went straight into the account. Section 03 says so, and section 04 asks for the
  victim's own payment (its hash and time, from the complaint or the victim's
  exchange record) to be attached, instead of an empty table. For a hot wallet,
  section 01 reads "The reported address is itself this … wallet".
- **A sanctioned or mixer address that is reported gets no lead of its own.** Leads
  list wallets the money reached, and the reported wallet is not one. The
  disposition sentence and the summary carry it.
- **Only the reported address itself.** An address one hop from an exchange is
  traced as before.
- **A derived deposit address is still heuristic.** The request states its
  confidence as for any derived exit, and confidence is not accuracy: a merchant
  settling to one exchange looks the same.
