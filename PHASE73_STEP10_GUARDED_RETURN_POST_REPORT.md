# PHASE 73 — BƯỚC 10: GUARDED RETURN POST ORCHESTRATOR

## Đã thực hiện

- Tạo script probe read-only để trích schema, index, trigger, procedure và dependency S3.
- Tạo `v45_int.sp_CreateReturnReceipt` làm entry point duy nhất cho Bridge.
- Orchestrator luôn stage/idempotency trước khi xem xét auto-post.
- Auto-post bị chặn nếu adapter version hoặc contract fingerprint chưa được xác minh.
- Tạo core hook fail-closed; mặc định luôn báo lỗi và không ghi bảng S3.
- Tách procedure đăng ký adapter và bật auto-post cho DBA; Bridge không có quyền gọi.
- Thu hồi quyền Bridge tự đánh dấu `posted/failed`.
- Cung cấp template yêu cầu kỹ thuật cho adapter production, cố ý không chứa SQL đoán schema.

## Giới hạn có chủ đích

ZIP S3 chỉ có binary/report, không có schema database và source stored procedure. Vì vậy bước này không giả lập insert vào `s3_INDoc/s3_INTran`. Việc đó chỉ được triển khai sau khi chạy probe và kiểm thử trên database S3 test.

## Trạng thái an toàn

- Staging: có thể triển khai trên DB test.
- Auto-post: khóa mặc định.
- Core inventory write: chưa được kích hoạt.
