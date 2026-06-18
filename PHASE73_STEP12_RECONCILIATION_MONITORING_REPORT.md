# PHASE 73 — BƯỚC 12: RECONCILIATION & MONITORING

## Đã thực hiện

- Health tổng hợp Inbox/Outbox, dead-letter, lỗi chưa xử lý, conflict và tuổi queue.
- Metrics Prometheus dạng text, có queue status, oldest age, conflict và snapshot age.
- Danh sách lỗi tích hợp và failed/dead-letter Outbox.
- Đối soát đơn tổng: số đơn con source/snapshot và conflict.
- Đối soát phiếu trả: ReturnOrder ↔ Outbox ↔ mã phiếu S3.
- Retry command có transaction, không cho retry command đã hoàn thành hoặc đang được lease.
- Health trả HTTP 503 khi có dead-letter để hệ thống giám sát phát hiện ngay.

## API

- `GET /api/integrations/s3/health`
- `GET /api/integrations/s3/metrics`
- `GET /api/integrations/s3/errors`
- `GET /api/integrations/s3/reconciliation/master-orders`
- `GET /api/integrations/s3/reconciliation/returns`
- `POST /api/integrations/s3/return-commands/:eventId/retry`
