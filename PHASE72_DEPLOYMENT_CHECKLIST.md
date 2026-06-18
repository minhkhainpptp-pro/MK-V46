# PHASE 72 — DEPLOYMENT CHECKLIST

## 1. Trước triển khai

- Sao lưu biến môi trường production hiện tại.
- Xác nhận S3 integration adapter chưa bật đồng bộ ngoài ý muốn.
- Xác nhận tài khoản vận hành vẫn có quyền đọc đơn, giao hàng và xác nhận kế toán.
- Không chạy migration database; Phase 72 không thay đổi schema.

## 2. Biến môi trường production

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

Restart service sau khi thay đổi ENV. Cấu hình sai mode/authority sẽ làm service fail startup thay vì fail-open.

## 3. Smoke test bắt buộc

### Phải bị chặn với HTTP 409

- Tạo/sửa/xóa/hủy đơn bán nguồn.
- Thay đổi thiết lập VAT trên đơn nguồn.
- Tạo/sửa thành phần/hủy/xóa đơn tổng.
- Import đơn DMS/Excel và import tồn/phiếu nhập.
- Rebuild, normalize hoặc điều chỉnh tồn V45.

Mã lỗi kỳ vọng:

- `ORDER_MANAGED_BY_S3`
- `MASTER_ORDER_MANAGED_BY_S3`
- `INVENTORY_MANAGED_BY_S3`
- `SOURCE_IMPORT_MANAGED_BY_S3`

### Phải tiếp tục hoạt động

- Đọc danh sách/chi tiết đơn bán và đơn tổng.
- Danh sách giao hôm nay và cập nhật trạng thái giao.
- Giao thiếu, không giao, ghi chú, GPS và ảnh.
- Ghi nhận hàng trả.
- Kế toán xác nhận phiếu trả để chuẩn bị gửi S3.
- Import danh mục sản phẩm, khách hàng, người dùng và khuyến mại.

## 4. Giám sát sau triển khai

Theo dõi warning log có message:

```text
S3 execution mode blocked local source command
```

Phân nhóm theo `code`, `method`, `path`, `userCode`. Nếu xuất hiện đường ghi chưa dự kiến, giữ nguyên fail-loud và bổ sung xử lý vào integration thay vì bỏ guard.

## 5. Rollback

```env
SYSTEM_MODE=STANDALONE
INVENTORY_AUTHORITY=LOCAL
ORDER_AUTHORITY=LOCAL
MASTER_ORDER_AUTHORITY=LOCAL
S3_INTEGRATION_ENABLED=false
```

Restart service. Không cần rollback database.
