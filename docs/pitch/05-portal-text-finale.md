# Portal text for the finale submission — DRAFT, 4 Oct 2026

**Use this only once `finale/refine` (with Plan B merged) is live on the
deployed site.** Every sentence describes something on that branch; the site
an evaluator opens must show it. Until then, `03-portal-text.md` stays the one
to paste. Figures counted from `data/` on 4 Oct 2026; re-count before pasting.

## Idea title

```
FineX — tracing stolen crypto to the exact exchange account that can be frozen, built for Indian cyber cells
```

## Idea description (2,000 characters)

```
₹22,845 crore was reported lost to cyber fraud in India in 2024 (MHA). When a victim reports a crypto wallet, an officer has hours before the money is cashed out, and most tools stop at "the funds reached Binance". An exchange cannot freeze an exchange; it can freeze a customer's account.

FineX traces the stolen USDT forward, hop by hop, on TRON, Ethereum and Polygon, carrying the victim's share through every transfer, and names the CUSTOMER DEPOSIT ADDRESS the money landed in — the account an exchange can identify and restrain. Each complaint is triaged CRITICAL (money still at rest), SUSPICIOUS (a freezable exchange account named) or CLOSED (sanctioned or mixer), so a cyber cell knows which of today's complaints still have recoverable money. Amounts are shown in rupees at the live USDT/INR rate on CoinDCX.

The attribution data is ours, derived from public chains rather than bought: 241 deposit addresses across 10 exchanges on TRON, 221 across 9 on Ethereum — 80 of them at Indian exchanges CoinDCX, WazirX and CoinSwitch, which foreign tools under-label — and 103 on Polygon, with FIU-IND registration shown for Indian exchanges. 1,043 OFAC-listed addresses across 20 assets are screened.

Nothing on screen is hardcoded: the case register is rebuilt from the server's own live chain reads, the recorded reference cases are re-traced every six hours, and every trace is logged in a SHA-256 hash-chained audit log. Six explainable rules flag laundering patterns, and an unsupervised machine-learning model (an isolation forest) ranks unusual wallets for a closer look — advisory only, because an officer must be able to defend every finding.

Each case produces a tamper-evident evidence packet (a fingerprint and QR code anyone can check, and the hash of every blockchain response) and a freeze request addressed to the exchange's own law-enforcement channel. A watch alerts the officer when money that was at rest moves.

Working prototype: https://crypto-fraud-tracer.onrender.com
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
