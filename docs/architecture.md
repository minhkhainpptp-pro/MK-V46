# MK-V46 Architecture

## Core principle
MK-V46 is document-driven and ledger-based.

```
Catalog → Documents → Posting Engine → Ledgers → Reports/UI
```

## Single sources of truth
- Sales orders: `salesOrders`
- Master delivery orders: `masterOrders`
- Returns: `returnOrders`
- Accounts receivable: `arLedgers`
- Cash/bank fund: `fundLedgers`
- Inventory movement: `inventories`
- Accounting journal: `journals`

## Forbidden patterns
- Do not update balances directly.
- Do not calculate business truth in UI.
- Do not write ledger rows outside ledger services/posting engine.
- Do not add new collection/status/API without updating docs + constants + tests.
