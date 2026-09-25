# Tamper-evident evidence packet

## What it does

Every evidence packet now ends with a **findings fingerprint**: one SHA-256
over what the case found. It sits next to a link and a QR code that let anyone
holding a copy (an exchange, a court clerk, another unit) check that copy
against the public chain. They don't need to trust whoever sent it.

**What the fingerprint covers:**

- the run: chain, reported address, amount, fraud window, and the moment it
  was read;
- the disposition and the exit (including the customer deposit address);
- every wallet, with its attribution (entity, kind, source, confidence) and the
  victim money that reached it;
- every transfer (hash, from, to, amount, time, time held);
- every rule that fired, and where it fired.

**What it does not cover:** the sentences. They are built from the figures
above, which are all covered. Leaving them out means a later FineX that words a
finding better doesn't make an older packet fail its check. Response hashes
aren't covered either: a response body carries the moment it was served, so the
same query answers with different bytes the next day. That is why these hashes
record custody but can't be re-checked, while a finding can.

**Why it can be checked at all:** confirmed transfers never change, and a trace
pinned to the moment it was read (`asof`) re-derives the same case on any later
day. The check link re-opens exactly that run. It carries:

- the amount and window the packet was given (automatic stays automatic);
- the moment the run was read;
- the fingerprint.

Opened, the packet re-derives the case and shows, above it:

- **Fingerprint matches.** The findings re-derived now are the ones the copy
  states. It also says where they came from: the public chain, or the recorded
  case file in demo mode.
- **Fingerprint does not match.** Both values are shown. The page names all
  three possible causes:
  - part of the chain could not be read just now (a result has no field that
    marks an unread wallet, so a throttled re-read changes the finding) — hence
    a **Check again** button;
  - FineX's attribution tables or rules have changed since the packet was issued;
  - the copy was altered.

  The packet below is the finding as re-derived now, so the figures can be
  compared line by line.
- **Not possible.** The case is an illustrative case: hand-built, on an address
  that was never on the chain. Its packet prints the fingerprint but no link,
  and says why.

The freeze request prints the same fingerprint and check link in its
Verification section. The combined request lists one per complaint, with the
NCRP number, so an exchange can check each case it is asked to act on.

The QR code needs no new dependency. `lib/qr.ts` is an encoder written from the
standard: byte mode, versions 1 to 15, error correction level M on the packet
(about 15% of a damaged or badly printed code can be recovered). It is drawn as
one SVG path, so it prints sharp at any size.

## How to use it

- **To issue:** open any evidence packet (Evidence, or *Evidence packet* on a
  case) and print it. The fingerprint, link and code are section 6 or 7, just
  before Limitations.
- **To check a copy:** scan the code or open the link printed on it. Compare the
  banner and the figures with the copy. On a PDF, the link is clickable.
- **Link form, for integration:** `/report/<address>?amount=…&since=…&asof=…&fp=<64 hex>`.
  The other parameters are the packet's own pinned run. Anything that isn't
  64 hex digits in `fp` is ignored.
- **In code:** `findingsFingerprint(trace)` in `lib/fingerprint.ts` returns
  the fingerprint. `findingsCanonical(trace)` returns the exact text that is
  hashed, so anyone can see what the digest covers.

## Verified

- **Encoder, against an independent decoder.** jsQR 1.4.0 (read from the local
  npm cache, used for checking only, not added to the project) decoded 1,080
  codes: all four error-correction levels × versions 1–15 × two lengths × every
  mask plus the automatic choice. Each decoded to the text that went in, at the
  version the encoder chose.
- **Encoder, against an independent encoder.** It reproduces the deck's QR
  (`docs/pitch/qr-finex-light.svg`, made by a different encoder, level H,
  version 5) module for module. Its penalty score also picks the same mask the
  other encoder chose. This is a unit test (`tests/qr.test.mjs`).
- **Fingerprint, against the chain.** All 13 recorded cases (10 TRON,
  3 Ethereum) were re-derived from the chain with the parameters their packet
  links carry. **13 of 13 produced the same fingerprint as the recorded copy.**
  That includes the two recorded HOT wallets whose funds moved after capture
  (`TDii6vao…`, `0xda4E10D8…`): the check replays the moment the case was read.
- **End to end:** 22 of 22 checks on production builds, with demo mode both on
  and off:
  - the packet prints the case's fingerprint;
  - the printed code decodes (jsQR, from the SVG as the browser draws it) to
    the check link;
  - the check link matches, and a one-digit change in it does not, and
    **Check again** re-derives and answers again;
  - a packet opened bare pins the captured run;
  - an illustrative case offers no link and never shows a match;
  - the freeze request and the combined request carry the same fingerprints;
  - no sideways scroll at 375 px, and nothing past the edge at A4 print width;
  - with demo mode off, TRON WARM, Ethereum WARM and Ethereum HOT recorded cases
    re-derived from the public chain match;
  - a fresh live packet for an unrecorded wallet (`TWa8Uyry…`, bare, automatic
    amount and window) matches its own check link;
  - no console errors.
- Unit tests (`tests/fingerprint.test.mjs`):
  - order doesn't change the fingerprint;
  - rewording, response hashes and call counts don't change it;
  - each covered figure does: amount, hash, time, entity, deposit address,
    confidence, disposition, reported amount, a flag, the moment read;
  - `fp` is read only when it is one;
  - the check link re-opens the right run for live, recorded and illustrative
    cases.

## Limits

- **A match says the copy's findings are what the chain shows. It does not
  prove who printed the copy.** It isn't a signature. A digital signature needs
  a key held by the issuing authority, which is a deployment decision, not
  something this repository can decide.
- **An honest mismatch is possible.** It happens when the attribution tables or
  rules change after issue: a new deposit address clustered, a sanctions
  refresh, a rule fix. The page states this as the alternative to alteration
  and shows the re-derived finding. `FINGERPRINT_SCHEME` names the covered
  content, so a later change to what is covered cannot be mistaken for this one.
- **The re-derivation reads the chain.**
  - If the reported wallet cannot be read at all, the page shows the "no trace"
    state and gives no answer.
  - If a wallet further along cannot be read, the finding changes and shows as a
    mismatch. This is the first cause the banner names, with **Check again**
    beside it.
  - In demo mode, recorded cases are answered from the recorded file, and the
    banner says so.
- **A live packet opened without a pinned link describes the chain "now".**
  Its check link pins the moment it was read. A transfer that confirmed in the
  seconds while the trace was running could, in principle, make a later
  re-derivation differ. A packet opened from a case's own links is already
  pinned, and is exact.
