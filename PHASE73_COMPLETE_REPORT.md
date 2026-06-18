# PHASE 73 — S3 ↔ V45 EXECUTION BRIDGE

## 1. Kết quả tổng thể

Đã hoàn thành nền tảng tích hợp theo kiến trúc:

```text
S3 = nguồn đơn hàng, đơn tổng, tồn kho và chứng từ kho chính thức
V45 = hệ thống thực thi giao hàng và ghi nhận hàng trả
Bridge = process độc lập, outbound-only, là kênh kết nối duy nhất
```

Không sửa hoặc thay thế bất kỳ EXE/DLL/OCX nào của S3.

## 2. Các bước đã hoàn thành

### Bước 3 — Integration foundation

- Inbox, Outbox, Checkpoint, SyncRun, Error, Nonce.
- Snapshot tồn S3 tách khỏi ledger tồn V45.
- Index idempotency và queue.

### Bước 4 — Source/Execution separation

- Metadata nguồn S3 tách khỏi trạng thái giao hàng V45.
- Unique identity theo mã nguồn S3.
- Phiếu trả lưu trạng thái sync và mã chứng từ S3 riêng.

### Bước 5 — API machine-to-machine

- HMAC-SHA256 trên raw bytes.
- Timestamp, nonce TTL, chống replay.
- Agent allowlist và IPv6-safe rate limiting.

### Bước 6 — Full/Incremental sync

- Run/batch/upsert, không xóa toàn bộ dữ liệu.
- Count validation trước publish.
- Tồn S3 chỉ vào `s3InventoryBalances`.

### Bước 7 — Đơn tổng S3 → V45

- Inbox + đơn con + đơn tổng trong một Mongo transaction.
- Không ghi đè đơn đã bắt đầu giao; chuyển conflict để đối soát.

### Bước 8 — Trả hàng V45 → Outbox

- Trong `S3_EXECUTION`, xác nhận hàng trả không cộng tồn V45.
- Không sinh AR-RETURN cục bộ.
- Kế toán xác nhận tạo Outbox trong cùng transaction.

### Bước 9 — SQL staging `v45_int`

- Staging header/detail, idempotency map, checkpoint, audit.
- TVP item, transaction, `XACT_ABORT`, `sp_getapplock`.
- Role Bridge chỉ được thực thi stored procedure.

### Bước 10 — Guarded TK orchestrator

- Entry point duy nhất: `v45_int.sp_CreateReturnReceipt`.
- Auto-post bị khóa nếu thiếu adapter version/contract fingerprint.
- Core hook fail-closed, không có SQL đoán schema S3.

### Bước 11 — Bridge Agent

- Claim/lease/renew/complete/defer/fail/dead-letter.
- Chỉ complete V45 khi S3 trả `posted + INNbr`.
- Đơn tổng dùng checkpoint; lỗi không làm vượt qua bản ghi chưa xử lý.
- Hai SQL adapter mặc định tắt/fail-closed.

### Bước 12 — Reconciliation & Monitoring

- Health, Prometheus metrics, error queue.
- Đối soát đơn tổng và phiếu trả.
- Retry command có kiểm soát.

### Bước 13 — Quality gate

- 720 file JavaScript hợp lệ.
- OpenAPI 279 operations đồng bộ.
- 676/676 test V45 qua.
- 10/10 test Bridge qua.
- 0 npm vulnerability cho cả hai package.

### Bước 14 — Deployment & Rollback

- SQL staging installer/probe.
- NSSM Windows Service scripts.
- HMAC health check.
- Rollout theo cổng và rollback giữ nguyên audit/idempotency.

## 3. Phần cố ý chưa bật

Hai adapter phụ thuộc schema database S3 thật:

1. `v45_int.sp_GetCompletedMasterOrdersForV45`
2. `v45_int.sp_PostReturnReceiptCore`

Hiện cả hai fail-closed. Đây không phải phần bị bỏ quên mà là chốt an toàn bắt buộc vì ZIP S3 chỉ chứa binary/report, không chứa schema, trigger và source stored procedure thực tế.

Không được bật:

```text
MASTER_ORDER_READ_ENABLED=true
RETURN_AUTO_POST_ENABLED=true
```

trước khi chạy probe, chụp before/after chứng từ và kiểm thử trên database S3 test.

## 4. Cấu hình production ban đầu

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

Bridge:

```env
BRIDGE_MASTER_ORDER_ENABLED=false
BRIDGE_RETURN_ENABLED=false
```

## 5. Kết luận nghiệm thu mã nguồn

Bản phase73 đã sẵn sàng để triển khai **staging/shadow mode**. Chưa được auto-post chứng từ TK vào S3 production cho tới khi hoàn tất adapter theo contract SQL thật.
