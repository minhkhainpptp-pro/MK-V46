# PHASE 73 — BƯỚC 7: ĐƠN TỔNG S3 → V45

## Đã thực hiện

- API `POST /api/integrations/s3/master-orders/upsert`.
- Một Mongo transaction bao gồm Inbox, toàn bộ đơn con và đơn tổng.
- Idempotency theo `eventId`.
- Upsert đơn con theo `sourceOrderId`, đơn tổng theo `sourceMasterOrderId`.
- Gán NVGH, ngày giao và liên kết master/child từ S3.
- Không trừ tồn V45; `stockPosted=false` cho mirror order.

## Chính sách xung đột

Nếu source hash thay đổi khi V45 đã bắt đầu/hoàn tất giao:

- Không ghi đè dữ liệu đang thực thi.
- Đặt `syncConflict=true`.
- Lưu `pendingSourcePayload` và `pendingSourceHash` để đối soát.
- Đơn tổng được đánh dấu conflict nếu có bất kỳ đơn con conflict.

## Feature flag

`S3_MASTER_ORDER_SYNC_ENABLED=true` mới cho phép nhận đơn tổng.

## Bước tiếp theo

Bước 8: sửa vòng đời trả hàng S3 mode để không post tồn/AR tại V45; kế toán xác nhận sẽ tạo Outbox command nguyên tử.
