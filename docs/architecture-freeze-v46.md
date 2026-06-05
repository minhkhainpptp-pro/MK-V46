# Architecture Freeze V46

This document freezes the first stable MK-V46 architecture.

## Change control
Do not add:
- new collection
- new ledger type
- new status
- new posting behavior
- new API contract

unless the following are updated:
1. Docs
2. Constants
3. Validators
4. Static checks/tests
5. Release checklist

## Ownership
- UI displays and sends API requests.
- Services handle business logic.
- Posting Engine posts ledgers.
- Ledgers are the reporting truth.
