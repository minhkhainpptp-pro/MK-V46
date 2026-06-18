# PHASE 73 — BƯỚC 5: BIÊN API HMAC CHO S3 BRIDGE

## Đã thực hiện

- Route riêng `/api/integrations/s3`.
- HMAC-SHA256 ràng buộc method, path, timestamp, nonce và raw body.
- So sánh constant-time cho key hash và signature.
- Timestamp window mặc định 60 giây.
- Nonce lưu Mongo với unique index + TTL để chống replay.
- Allowlist Agent ID và rate limit riêng.
- Namespace integration được miễn JWT người dùng nhưng bắt buộc HMAC riêng.
- Raw body chỉ được giữ cho namespace S3 và không được log.

## Header contract

- `X-Integration-Key`
- `X-Agent-Id`
- `X-Timestamp`
- `X-Nonce`
- `X-Signature`

## Bước tiếp theo

Bước 6: xây Full Sync theo run/batch, upsert danh mục và snapshot tồn S3 mà không xóa dữ liệu hay ghi đè trạng thái thực thi.
