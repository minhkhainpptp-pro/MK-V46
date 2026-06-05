# MK-V46 Clean Core - Checklist đã triển khai

## Nguyên tắc giữ xuyên suốt

- Route chỉ gọi controller; controller chỉ gọi service; service xử lý nghiệp vụ.
- Không sinh công nợ, quỹ, tồn kho khi mới tạo đơn bán.
- Công nợ chỉ sinh ở bước kế toán xác nhận.
- Hàng trả chỉ lấy từ `returnOrders`.
- Tồn kho chính thức là `inventories`; snapshot chỉ để tăng tốc.
- API danh sách giao hàng không load `items` nặng; chi tiết đơn mới load `items`.
- Các API danh sách đều có `limit`, `page` và filter mặc định để tránh scan vô hạn.

## Module đã bổ sung

1. `SalesOrder` model chuẩn collection `salesOrders`.
2. `salesOrderService` đủ create/list/detail/update/cancel/import-preview/import-confirm.
3. `salesOrder.controller` và `salesOrder.routes` có route import nền.
4. `MasterOrder` model chuẩn collection `masterOrders`.
5. `masterOrderService` tạo/gộp/hủy/sửa/giao/xem chi tiết đơn tổng.
6. Route `/api/master-orders/create` để gộp đơn.
7. `ReturnOrder` model chuẩn collection `returnOrders`.
8. `ArLedger` model chuẩn collection `arLedgers`.
9. `FundLedger` model chuẩn collection `fundLedgers`.
10. `accountingService` xác nhận kế toán: AR-SALE, AR-RETURN, AR-RECEIPT, AR-BONUS, Inventory OUT/IN, Fund CASH/BANK.
11. Delivery API có performance log và không load items ở danh sách.
12. `GET /api/reports/dashboard` đọc từ nguồn chuẩn.
13. `src/config/indexes.js` trỏ về registry index gọi khi bootstrap.
14. `public/js/search/unifiedSearchEngine.js` gom tìm kiếm khách hàng/sản phẩm/NVBH/NVGH.
15. `npm test` chạy static check module.

## Luồng test thực tế sau khi deploy

1. `GET /health` phải trả `ok: true`.
2. Tạo sản phẩm và khách hàng mẫu.
3. `POST /api/sales-orders` tạo đơn pending.
4. `GET /api/sales-orders` thấy đơn mới.
5. `PUT /api/sales-orders/:id` sửa được khi pending.
6. `POST /api/master-orders/create` gộp đơn.
7. Tạo lại master với cùng đơn phải bị chặn trùng.
8. `GET /api/mobile/delivery/orders?deliveryDate=YYYY-MM-DD&deliveryStaffCode=...` thấy đơn.
9. `GET /api/mobile/delivery/orders/:id` thấy items và return lines.
10. `POST /api/mobile/delivery/confirm` với returnQty = 0 không tạo returnOrder.
11. `POST /api/mobile/delivery/confirm` với returnQty > 0 tạo/cập nhật returnOrders.
12. `POST /api/accounting/confirm` sinh AR/Fund/Inventory và set accountingStatus = posted.
13. `GET /api/reports/dashboard` đọc đúng từ nguồn chuẩn.
