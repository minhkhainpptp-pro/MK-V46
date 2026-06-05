# MK-V46 Business Rules

## Sales flow
1. Create `salesOrder` as `pending`.
2. Group into `masterOrder`; sales order becomes `assigned`.
3. Delivery confirms actual delivery/return/payment draft.
4. Accounting confirms and posts AR/Fund/Inventory/Journal.

## Debt
Debt is calculated from `arLedgers` only:
`AR-SALE - AR-RETURN - AR-RECEIPT - AR-BONUS`.

## Inventory
Inventory balance is calculated from `inventories` only.
`inventorySnapshots` is cache only.

## Return
Return value must be calculated from original sales order item price.
Never use current product price for historical return value.
