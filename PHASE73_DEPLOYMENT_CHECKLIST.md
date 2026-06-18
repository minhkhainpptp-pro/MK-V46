# PHASE 73 — DEPLOYMENT CHECKLIST

## Cổng 0 — Backup và môi trường test

- [ ] Backup SQL Server S3 và MongoDB V45.
- [ ] Restore SQL S3 sang database test riêng.
- [ ] Dùng Bridge service account riêng, không dùng `sa`.
- [ ] V45 deploy với tất cả cờ đồng bộ ghi ở trạng thái `false`.

## Cổng 1 — Deploy V45 execution-only

```env
SYSTEM_MODE=S3_EXECUTION
INVENTORY_AUTHORITY=S3
ORDER_AUTHORITY=S3
MASTER_ORDER_AUTHORITY=S3
S3_INTEGRATION_ENABLED=true
S3_MASTER_ORDER_SYNC_ENABLED=false
S3_RETURN_SYNC_ENABLED=false
S3_RETURN_AUTO_POST_ENABLED=false
```

- [ ] Chạy `npm ci --omit=dev`.
- [ ] Chạy `npm run check:syntax`.
- [ ] Chạy `npm run docs:check`.
- [ ] Chạy `npm test`.
- [ ] Chạy `npm run mongo:indexes` sau khi audit duplicate source IDs.

## Cổng 2 — SQL staging

- [ ] Chạy `deploy/apply-sql-staging.ps1` trên DB test.
- [ ] Xác nhận `RETURN_AUTO_POST_ENABLED=false`.
- [ ] Xác nhận `MASTER_ORDER_READ_ENABLED=false`.
- [ ] Ánh xạ Bridge account vào role đọc/return-writer.
- [ ] Không cấp INSERT/UPDATE/DELETE bảng lõi S3.

## Cổng 3 — Shadow read đơn tổng

- [ ] Chạy `006_probe_s3_contract.sql`.
- [ ] Xây reader adapter theo schema thật.
- [ ] So sánh payload với ít nhất 20 đơn tổng trên giao diện S3.
- [ ] Bật `MASTER_ORDER_READ_ENABLED` trên DB test trước.
- [ ] Bật `BRIDGE_MASTER_ORDER_ENABLED=true` cho một NVGH/tuyến thử.
- [ ] Không có duplicate/conflict ngoài dự kiến.

## Cổng 4 — Return staging

- [ ] Bật `S3_RETURN_SYNC_ENABLED=true` trên V45.
- [ ] Bật `BRIDGE_RETURN_ENABLED=true`.
- [ ] Giữ `S3_RETURN_AUTO_POST_ENABLED=false` và SQL auto-post false.
- [ ] Phiếu trả vào `v45_int.ReturnReceiptRequest/Item` đúng 100%.
- [ ] Kế toán tạo phiếu TK thủ công và đối chiếu mã/số lượng/quy cách.

## Cổng 5 — Auto-post giới hạn

- [ ] Core adapter được kiểm thử transaction/rollback/idempotency.
- [ ] Đăng ký adapter version + contract fingerprint.
- [ ] Chỉ DBA bật SQL auto-post.
- [ ] Chạy một kho, một nhóm sản phẩm, một nhóm người dùng.
- [ ] Không có phiếu trùng khi mô phỏng timeout sau commit.

## Cổng 6 — Mở rộng production

- [ ] Health không `critical`.
- [ ] Queue oldest age dưới ngưỡng.
- [ ] Dead-letter bằng 0.
- [ ] Đối soát đơn tổng và hàng trả không lệch.
- [ ] Rollback script đã chạy thử trên môi trường test.
