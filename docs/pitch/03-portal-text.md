# Portal text — idea title and idea description

The SIH portal asks the team leader for three things: the **idea title**, the
**idea description** and the **presentation PDF**. The first two are scored text
and most teams paste something generic into them. Paste these instead.

Written against the nine official criteria: novelty, complexity, clarity and
detail, feasibility, practicability, sustainability, scale of impact, user
experience, and potential for future work.

---

## Idea title

Paste this (88 characters):

```
FineX — TRON/USDT tracing that names the exchange deposit account, not just the exchange
```

Two shorter fallbacks if the field is tight:

```
FineX — naming the exchange account that can actually be frozen
```

```
FineX — real-time TRON/USDT attribution with a filed-ready evidence packet
```

---

## Idea description — full version (1,581 characters)

Use this if the field allows 1,600 characters or more.

```
An officer receives a victim-reported wallet and has hours, not days, before the
money is cashed out. Existing tools stop at "the funds reached Binance". That is
not actionable: an exchange cannot freeze an exchange.

FineX traces the wallet forward on TRON, hop by hop, carrying the victim's share
of the money through each transfer, and names the CUSTOMER DEPOSIT ADDRESS the
funds landed in — the account an exchange can actually restrain. It then triages
every complaint as CRITICAL (funds still at rest), SUSPICIOUS (a freezable exit
named) or CLOSED (mixer or sanctioned, nothing follows), so a cyber cell knows
which of today's complaints still have recoverable money.

The attribution dataset is ours and it is derived, not licensed: an address that
repeatedly forwards 90%+ of its inflow into one tagged exchange wallet is a
customer deposit address. That yields 241 deposit addresses across 10 exchanges
from 15 public seeds, plus 334 OFAC-sanctioned addresses — at zero licence cost.

Every finding is explainable: six behavioural rules, each stating in plain words
why it fired. No machine-learning black box makes an attribution, because an
officer has to defend it. Each case produces an evidence packet carrying the
SHA-256 of every blockchain response behind it, and a draft restraint request.

Working and deployed: https://crypto-fraud-tracer.onrender.com

Tracing is TRON/USDT, where these proceeds move; an address on any other chain
is screened against OFAC. Cross-chain tracing, NCRP/SAHYOG intake and
departmental indexing are designed and next, not claimed.
```

---

## Idea description — short version (693 characters)

Use this if the field is small.

```
An officer gets a victim-reported wallet and has hours before the money is cashed
out. Most tools stop at "the funds reached Binance" — but an exchange cannot freeze
an exchange. FineX traces the wallet forward on TRON and names the customer deposit
ADDRESS the funds landed in: the account that can be restrained. It then triages
each complaint as CRITICAL, SUSPICIOUS or CLOSED, so a cyber cell knows which cases
still have recoverable money. Attribution is derived from public data — 241 deposit
addresses across 10 exchanges — with six explainable rules, an evidence packet
hashing every chain response, and zero licence cost. Deployed and working:
https://crypto-fraud-tracer.onrender.com
```

---

## Why it is written this way

| Criterion | Where it is answered |
|---|---|
| Novelty | The deposit-address derivation, stated as the thing others do not do |
| Complexity | Taint propagation, clustering, six rules, hashed provenance |
| Clarity and detail | Plain first sentence; no jargon before the problem is stated |
| Feasibility, practicability | A live URL an evaluator can open, and a named output an exchange can act on |
| Sustainability | Public data, no licence, no database, self-hosted |
| Scale of impact | Triage across a queue of complaints, not one wallet |
| User experience | The officer's decision — which case to work next — is the product |
| Future work | The last line names what is next without pretending it exists |

## Before pasting

- Check the character limit the portal enforces and pick the matching version.
- Keep the URL in the text. It is the strongest single line in the submission.
- Do not add a claim that is not in these documents. Everything here is
  countable from the repository.
