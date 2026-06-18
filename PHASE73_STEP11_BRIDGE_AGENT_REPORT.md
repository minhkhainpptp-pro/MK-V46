# PHASE 73 — BƯỚC 11B: BRIDGE AGENT

## Đã thực hiện

- Agent process độc lập, outbound-only từ LAN S3 đến V45.
- HMAC request dùng đúng canonical contract của V45.
- SQL account chỉ gọi `v45_int.sp_CreateReturnReceipt`.
- Validate payload hash trước khi ghi staging.
- Chỉ complete V45 khi SQL trả `posted` và có `S3INNbr`.
- Nếu SQL trả `staged/processing`, command được defer; không báo thành công giả.
- Phân loại lỗi validation SQL thành non-retryable, lỗi hạ tầng thành retryable.
- Log JSON có redaction secret/password.
- Feature flag Bridge mặc định tắt.

## Công nghệ

Agent dùng Node.js process độc lập để có thể kiểm thử trực tiếp cùng contract HMAC của V45. Nó không chạy bên trong S3 và không yêu cầu sửa binary S3.
