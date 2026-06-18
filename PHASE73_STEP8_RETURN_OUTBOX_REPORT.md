# PHASE 73 — BƯỚC 8: HÀNG TRẢ V45 → OUTBOX S3

## Đã thực hiện

- Trong `S3_EXECUTION`, nhận hàng trả chỉ xác nhận kiểm đếm vật lý; không cộng tồn V45.
- Đơn tổng trả hàng không còn gắn `stockPosted=true` trong S3 mode.
- Kế toán xác nhận phiếu trả tạo Outbox `S3_CREATE_RETURN_TK` trong cùng Mongo transaction.
- Event ID cố định `V45:RETURN:<returnCode>` chống tạo phiếu TK trùng.
- Payload chỉ chứa mã đơn gốc, khách hàng, kho S3, ngày trả và số lượng cơ sở dương.
- Không ghi AR-RETURN cục bộ trong S3 mode.
- Nhánh xác nhận kế toán theo đơn tổng cũng enqueue chính `returnOrders`, không tạo AR-RETURN tổng hợp ảo.

## Trạng thái

- Nghiệp vụ: `received → accounting_confirmed`.
- Đồng bộ: `not_requested → pending → processing → completed|failed|dead_letter`.
- `stockPosted=false`, `arPosted=false` cho đến khi S3 phản hồi chứng từ.

## Điều kiện cấu hình

- `S3_RETURN_SYNC_ENABLED=true`
- `S3_RETURN_DEFAULT_SITE_ID=<mã kho thật trên S3>`

## Bước tiếp theo

Bước 9: tạo bộ SQL staging/idempotency cho S3, chỉ trong schema `v45_int`, chưa ghi bảng lõi S3.
