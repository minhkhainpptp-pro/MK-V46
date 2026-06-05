# MK-V46 Ledger Rules

Append-only ledgers:
- `arLedgers`
- `fundLedgers`
- `inventories`
- `journals`

Never edit historical ledger rows. If a posting is wrong, create a reversal/adjustment row.

All ledger writes must go through:
- `src/services/ledger/*`
- `src/core/postingEngine.js`
