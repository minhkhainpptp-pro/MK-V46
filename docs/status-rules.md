# MK-V46 Status Rules

## Sales order
Allowed:
- `pending`
- `assigned`
- `delivered`
- `cancelled`

## Delivery
Allowed:
- `pending`
- `assigned`
- `delivered`
- `failed`
- `cancelled`

## Accounting
Allowed:
- `pending`
- `posted`
- `cancelled`

Do not introduce new status strings without updating `src/constants/status.constants.js` and tests.
