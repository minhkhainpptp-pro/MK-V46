# PHASE 73 — BƯỚC 4: TÁCH DỮ LIỆU NGUỒN S3 VÀ TRẠNG THÁI THỰC THI V45

## Thay đổi

- `SalesOrder`: bổ sung source identity/version/hash/read-only, execution state và conflict state.
- `MasterOrder`: bổ sung source master identity, NVGH chuẩn, children và execution/conflict state.
- `ReturnOrder`: bổ sung trạng thái đồng bộ S3, event id, mã phiếu TK và lỗi đồng bộ.
- `mongoIndexService`: unique index theo nguồn S3 và event hàng trả.

## An toàn dữ liệu

- Full/incremental sync chỉ được phép cập nhật nhóm `source*` và dữ liệu nguồn.
- Các trường `execution*`, ảnh/GPS/ghi chú và return state thuộc V45, không bị source sync ghi đè.
- Một `sourceOrderId`/`sourceMasterOrderId` S3 chỉ có một bản ghi V45.
- Một phiếu trả chỉ có một `s3SyncEventId`.

## Bước tiếp theo

Bước 5: xây API integration có HMAC, chống replay, rate limit và route riêng cho Bridge.
