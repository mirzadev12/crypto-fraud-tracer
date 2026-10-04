# Request to Tether

## What it does

A CRITICAL case whose money sits at rest in a wallet, with no exchange on its
trail, has no account to restrain. The issuer of USDT is the one party that can
still stop the USDT moving, and note 02 already reads whether it has. This
completes the route: the case can now **draft the request to the issuer**.

- **On the trace**, **Request to Tether** takes the place of **Freeze request**
  when the trail has no exchange exit and the watch finds a wallet at rest
  (`watchTargetFor`, `lib/watch.ts`).
- **The freeze page** (`/freeze/<address>`, same parameters) then drafts the letter
  (`components/IssuerRequest.tsx`): "Request to freeze USDT at an address", to
  "Tether, issuer of USDT".
- **Above the letter, on screen only:** the live issuer-freeze line for the resting
  wallet (note 02), and the sending guide.
- **The letter has five sections:**
  - 01 The address holding the funds: the largest at-rest wallet the watch names,
    the USDT traced to it and its share, the chain and token, "No outgoing transfer
    observed since the money arrived", and the moment the chain was read.
  - 02 The reported fraud: case reference, "Date of fraud" or "Window opened (no
    date reported)", the reported address, "Amount reported" or "Amount traced
    (none reported)", and the disposition sentence.
  - 03 What is requested: freeze the USDT pending legal process; say whether it was
    already frozen, and from when; preserve Tether's records for the address;
    confirm receipt and the action taken.
  - 04 Verification: the count of hashed responses, and the findings fingerprint
    with its check link.
  - 05 Issued by: FIR number, NCRP acknowledgement number, scam type, officer,
    designation, unit, contact, the legal-basis picker (note 28), date, **Duration
    of the restriction**, and signature and seal.
- **The same two rules as the exchange request.** It is a draft for an authorised
  officer to complete and sign, and it asserts no legal basis. It also says the
  address is not attributed to anyone: the finding is that USDT traced from a
  reported fraud reached it and nothing was seen leaving it.

**Where to send it is not invented.** Tether's entry in `data/le-contacts.json` is
**not found**, with the reason and the date read (4 Oct 2026). Its legal terms
(`tether.to/en/legal`) refer to a Law Enforcement Requests Policy without giving
its text. The one law-enforcement address it publishes, `inforequests@tether.to`, is
on the policy page of Tether Hadron (`hadron.tether.to/en/law-enforcement`, last
updated 30 January 2025), which covers Hadron's customer data and does not say it
covers USDT. So the guide says "No law-enforcement channel is recorded for Tether"
with that reason, and to find the channel on Tether's own site before sending. The
letter prints no addressee address.

## How to use it

Open a CRITICAL case that has no exchange exit, for example the recorded case
`TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx`:

```
/trace/TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx?amount=5535.981436&since=2026-09-09T13%3A09%3A36.000Z&asof=2026-09-14T08%3A51%3A02.929Z
```

Press **Request to Tether**, read the issuer-freeze line, complete section 05, and
print. That wallet was selected by a script for being at rest, not reported by a
victim: never describe its later movement as fraud proceeds.

## Verified

- Opened on the recorded CRITICAL case above through its pinned link.
- The wording and the not-found entry come from the data file and the component; no
  unit test covers the letter. `tests/le-contacts.test.mjs` covers the entry's shape
  (a not-found entry must say why).

## Limits

- **No channel to send to.** The officer finds it. Whether and when Tether acts is
  for Tether.
- **Money at rest is a claim with a timestamp.** Section 01 says "when read", and
  the issuer-freeze line is the chain now, not at capture (note 02). The wallet may
  have moved since; the desk's watch reports that.
- **One case at a time.** Batch triage combines requests per exchange (note 04) and
  does not combine requests to Tether.
- **Only when a wallet at rest is named.** A case with no exit and no wallet at
  rest has no request: the freeze page says no exchange endpoint was identified.
