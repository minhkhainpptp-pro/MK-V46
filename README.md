# MK-V46 Clean Core

ERP/DMS clean core for NPP Minh Khai.

## Start

```bash
npm install
cp .env.example .env
npm start
```

## Render

Build command: `npm install`
Start command: `npm start`

## Health

`GET /api/health`

## Phase 5 - Mobile Delivery V46

Mobile delivery app uses the existing clean-core collections only:

- `salesOrders`
- `masterOrders`
- `returnOrders`
- `arLedgers`

No separate mobile collection is created.

### Delivery orders

```txt
GET /api/mobile/delivery/orders?deliveryDate=YYYY-MM-DD&deliveryStaffCode=...
GET /api/mobile/delivery/order/:salesOrderIdOrCode
POST /api/mobile/delivery/confirm
```

`GET /api/mobile/delivery/orders` queries `masterOrders` by `deliveryDate` and `deliveryStaffCode`, then loads child `salesOrders` in one query.

### Confirm delivery

`POST /api/mobile/delivery/confirm` updates the sales order to delivered and creates/updates `returnOrders` when any line has `returnQty > 0`.

Return amount is always calculated as:

```txt
returnAmount = returnQty * salePrice
```

### Collection

```txt
GET /api/mobile/collection/customer-debts?customerCode=...
POST /api/mobile/collection/receipt
```

Collection uses only `arLedgers`. It does not update `customerDebt`, `remainingDebt`, or `orderDebt`.

### Report

```txt
GET /api/mobile/delivery/report?deliveryDate=YYYY-MM-DD&deliveryStaffCode=...
```

Report data sources:

- Delivered / undelivered orders: `salesOrders`
- Return value: `returnOrders`
- Collected money: `arLedgers` with `type = AR_RECEIPT`
