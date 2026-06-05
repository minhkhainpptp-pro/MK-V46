# V46 Production Hardening Report

## Scope
This hardening pass was intentionally implemented in bounded modules to avoid side effects:
- Mongo index lifecycle
- Delivery canonical engine façade
- Delivery daily closing
- AR Ledger customer statement and over-collection guard
- Inventory engine façade and snapshot rebuild script
- Import DMS preview/confirm transaction
- Permission and audit-read protection
- Production static checks

## Implemented
1. Centralized Mongo index registry: `src/core/indexDefinitions.js`.
2. Production Mongo connection uses `autoIndex: false` unless explicitly enabled.
3. Added CLI scripts:
   - `npm run db:indexes`
   - `npm run inventory:rebuild`
   - `npm run production-check`
4. Added Delivery engine façade and split modules:
   - `src/engines/DeliveryEngine.js`
   - `src/engines/DeliveryAssignmentEngine.js`
   - `src/engines/DeliveryConfirmEngine.js`
   - `src/engines/DeliveryPaymentEngine.js`
   - `src/engines/DeliveryReturnEngine.js`
5. Added daily closing:
   - Model: `deliveryClosings`
   - API: `/api/delivery-closings`
6. Added AR customer statement:
   - API: `/api/ar-ledgers/customer-statement`
7. Added over-collection protection in `postReceiptAr()`.
8. Added Inventory engine façade and protected rebuild path.
9. Import DMS confirm now runs in a Mongo transaction.
10. Added permission middleware and audit log read API.

## Important Design Rules
- AR Ledger remains the only canonical receivable source.
- `inventorySnapshots` is read cache only; rebuildable from `inventories`.
- Delivery Web/App should call DeliveryEngine façade rather than directly querying models.
- Production should create indexes with `npm run db:indexes`, not at request time.

## Remaining Manual Checks
- Run a real MongoDB integration test with Atlas URI.
- Execute a 10,000-order load test before production rollout.
- Verify role headers/JWT mapping for deployed authentication.
