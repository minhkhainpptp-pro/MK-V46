# PHASE 73 — BƯỚC 6: FULL SYNC S3 → V45

## Đã thực hiện

- Sync run `FULL|INCREMENTAL`.
- Batch API cho products, customers, users, inventory và orders.
- Batch idempotency qua `IntegrationInbox.eventId`.
- Upsert theo mã nghiệp vụ; không `deleteMany` và không drop collection.
- Publish full run chỉ khi expected count khớp processed count.
- Bản ghi S3 không còn trong snapshot chỉ bị đánh dấu inactive và chỉ khi full run hoàn tất.
- Tồn S3 ghi vào `s3InventoryBalances`, tuyệt đối không tạo stock transaction V45.
- User sync không nhập mật khẩu S3; tài khoản mới có credential vô hiệu và phải được cấp quyền riêng trên V45.
- Order sync chỉ cập nhật dữ liệu nguồn; execution state chỉ được đặt khi insert mới.

## API

- `POST /api/integrations/s3/sync-runs`
- `GET /api/integrations/s3/sync-runs/:runId`
- `POST /api/integrations/s3/:entityType/batch`
- `POST /api/integrations/s3/sync-runs/:runId/complete`

## Bước tiếp theo

Bước 7: đồng bộ đơn tổng S3 → V45 trong một Mongo transaction, có conflict policy khi V45 đã bắt đầu giao.
