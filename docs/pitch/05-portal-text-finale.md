# Portal text for the finale submission — DRAFT, 4 Oct 2026

**Use this only once `finale/refine` (with Plan B merged) is live on the
deployed site.** Every sentence describes something on that branch; the site
an evaluator opens must show it. Until then, `03-portal-text.md` stays the one
to paste. Figures counted from `data/` on 4 Oct 2026; re-count before pasting.

## Idea title

```
FineX — tracing stolen crypto to the exact exchange account that can be frozen, built for Indian cyber cells
```

## Idea description (1,921 characters; limit 2,000)

```
₹22,845 crore was reported lost to cyber fraud in India in 2024 (MHA). Most open tools stop at "the funds reached Binance". An exchange cannot freeze an exchange; it can freeze a customer's account.

FineX traces stolen USDT hop by hop on TRON, Ethereum and Polygon, carrying the victim's share through every transfer, and names the CUSTOMER DEPOSIT ADDRESS it landed in: the account an exchange can identify and restrain. Each complaint is triaged CRITICAL (not yet at an exchange: at rest or still moving), SUSPICIOUS (an exchange account named) or CLOSED (an OFAC-sanctioned address), so a cyber cell can paste a morning's complaint sheet and sees which still have recoverable money, by state, with one freeze request per exchange.

The attribution data is derived from public chains, not bought: 241 deposit addresses across 10 exchanges on TRON, 221 across 9 on Ethereum and 103 on Polygon. 80 are at CoinDCX, WazirX and CoinSwitch, all on Ethereum (52 active in September 2026, 28 from 2021), with FIU-IND registration shown. 1,043 OFAC-listed addresses across 20 assets are screened.

The register and every figure are computed from the server's own chain reads and the committed data files; recorded reference cases are re-read every six hours and every trace is logged in a SHA-256 hash-chained audit log. Six rules flag laundering patterns, each printed with how often it fires on unreported wallets; an isolation forest only ranks unusual wallets. Rules decide; no model does.

Each case produces a tamper-evident evidence packet (a fingerprint and QR anyone can re-check against the chain), a court-preparation sheet answering counsel's likely questions from the case's own record, and a freeze request showing the exchange's own law-enforcement channel, its conditions and whether this desk has access. A watch alerts the officer when money at rest moves.

Prototype: https://crypto-fraud-tracer.onrender.com
```

## Before pasting, check

- The deployed site shows: the live register, the INR figures, the "Unusual
  wallets · advisory" panel, Ethereum and Polygon cases, the 1930 footer.
- The GitHub link anywhere in the submission is public (the Render-connected
  repository was private on 4 Oct).
- Count the characters against the portal's limit; the short version in
  `03-portal-text.md` still fits a small field.
- Do not add a statute: the legal-basis picker offers sections to the officer;
  the description does not claim any law requires a freeze.
