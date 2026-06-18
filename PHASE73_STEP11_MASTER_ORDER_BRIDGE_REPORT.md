# PHASE 73 — BƯỚC 11C: MASTER ORDER BRIDGE

## Đã thực hiện

- Định nghĩa SQL result-set contract cho đơn tổng hoàn tất.
- Reader adapter mặc định fail-closed và feature flag SQL mặc định tắt.
- Tạo dispatch map theo `EventId` và `SourceMasterOrderId + SourceVersion`.
- Tạo checkpoint có tính đơn điệu: chỉ tăng sau khi V45 acknowledge thành công/conflict.
- Agent kiểm tra canonical payload hash trước khi gọi V45.
- Khi một bản ghi lỗi, batch dừng để không vượt checkpoint và bỏ sót dữ liệu.
- V45 conflict được ghi nhận rõ nhưng vẫn acknowledge để vận hành tiếp.
- Cung cấp template read-only, không chứa SQL đoán bảng S3.

## Giới hạn

Procedure reader thật phải được DBA triển khai sau khi chạy probe trên database test. Hiện `MASTER_ORDER_READ_ENABLED=false` và stub sẽ báo lỗi nếu bật nhầm.
