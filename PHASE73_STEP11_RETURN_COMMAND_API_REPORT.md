# PHASE 73 — BƯỚC 11A: RETURN COMMAND API

## Đã thực hiện

- Claim command bằng atomic lease, giới hạn batch và thời hạn lease.
- Gia hạn lease cho tác vụ SQL kéo dài.
- Complete cập nhật Outbox và ReturnOrder trong cùng Mongo transaction.
- Defer dùng cho staging: không giả báo hoàn thành khi S3 chưa post kho.
- Fail có exponential backoff, retry và dead-letter theo số lần thử.
- Chống agent khác complete/fail command không thuộc lease của mình.
- Complete lặp lại với cùng mã phiếu là idempotent; mã phiếu khác bị chặn conflict.

## API

- `POST /api/integrations/s3/return-commands/claim`
- `POST /api/integrations/s3/return-commands/:eventId/complete`
- `POST /api/integrations/s3/return-commands/:eventId/defer`
- `POST /api/integrations/s3/return-commands/:eventId/fail`
- `POST /api/integrations/s3/return-commands/:eventId/renew`
