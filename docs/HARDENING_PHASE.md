# MK-V46 Hardening Phase

## Nội dung đã triển khai

1. Xóa cảnh báo duplicate schema index
   - Bỏ `index: true` trong field schema.
   - Giữ index nghiệp vụ ở `schema.index()` và `ensureMongoIndexes()`.

2. Transaction cho nghiệp vụ nhạy cảm
   - `confirmDelivery`
   - `confirmMasterOrderAccounting`
   - `confirmDeliveryAccounting`
   - `accountingConfirmReturnOrder`
   - `createOrUpdateReturnOrder`

3. Idempotency
   - Thêm collection `operationLogs`.
   - Chặn bấm xác nhận trùng bằng `operationId`.

4. Audit Log
   - Thêm collection `auditLogs`.
   - Ghi lại nghiệp vụ giao hàng, kế toán xác nhận, tạo/xác nhận hàng trả.

5. Response chuẩn
   - Thêm `successResponse`, `createdResponse`, `errorResponse`.
   - Chuẩn hóa các controller/API trọng yếu.

6. Validation
   - Thêm validation cho Product, Customer, SalesOrder, ReturnOrder.

7. Production Index
   - Bổ sung index cho operationLogs, auditLogs, apiLogs.
   - Bổ sung index tồn kho theo productCode + warehouseCode + createdAt.

8. API Monitor
   - Thêm `apiLogs`.
   - Middleware tự ghi log API, statusCode, thời gian phản hồi.

9. Test suite
   - Cập nhật static-check để load các module hardening mới.

## Nguyên tắc sau hardening

- Không ghi nhiều ledger ngoài transaction.
- Không xác nhận nghiệp vụ nhạy cảm nếu thiếu operation guard.
- Không thêm index trực tiếp ở cả field và `schema.index()` cùng lúc.
- Không dùng `res.json()` rải rác cho API mới; dùng response util.
