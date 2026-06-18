# PHASE 73 — BƯỚC 3: NỀN TẢNG DỮ LIỆU TÍCH HỢP S3

## Mục tiêu

Tạo các collection độc lập cho Inbox/Outbox, checkpoint, sync run, snapshot tồn S3 chỉ đọc và lỗi tích hợp. Không thay đổi collection tồn kho cục bộ và chưa tác động luồng giao/trả hiện tại.

## File mới

- `src/models/IntegrationInbox.js`
- `src/models/IntegrationOutbox.js`
- `src/models/S3SyncCheckpoint.js`
- `src/models/S3SyncRun.js`
- `src/models/S3InventoryBalance.js`
- `src/models/S3IntegrationError.js`
- `test/s3-integration-foundation-models.test.js`

## File thay đổi

- `src/models/index.js`
- `src/services/mongoIndexService.js`

## Quy tắc an toàn

- `eventId` Inbox/Outbox là unique để chống xử lý lặp.
- Tồn S3 nằm trong `s3InventoryBalances`, không dùng `inventories` hoặc `stockTransactions`.
- Checkpoint unique theo stream.
- Sync run unique theo `runId`.
- Kho lỗi có hàng đợi retry riêng và không làm mất payload/correlation.
- Chưa có migration phá dữ liệu; index được tạo qua cơ chế quản lý index hiện hữu.

## Bước tiếp theo

Bước 4: mở rộng `SalesOrder`, `MasterOrder`, `ReturnOrder` với metadata nguồn S3, execution state, conflict state và trạng thái đồng bộ phiếu trả.
