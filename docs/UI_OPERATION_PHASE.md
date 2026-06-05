# MK-V46 UI Operation Phase

Đã triển khai lớp giao diện vận hành theo nguyên tắc:

1. Mọi màn gọi API qua `public/js/core/apiClient.js`.
2. Mọi thông báo/loading dùng `public/js/core/uiNotify.js`.
3. Layout dùng `public/index.html`, CSS chung `public/css/app.css`.
4. Giao hàng không load chi tiết khi chưa click đơn.
5. Xác nhận giao có chống double click ở UI và operationId ở backend.
6. Xác nhận kế toán tách riêng, chỉ lúc này mới sinh AR/Inventory/Journal.
7. Công nợ đọc từ `arLedgers` qua API `/api/debts/customers` và `/api/debts/customer-detail`.
8. Tồn kho đọc từ `inventories`; snapshot chỉ phục vụ tăng tốc.
9. Import DMS đi qua preview rồi mới confirm.
10. App bán hàng chỉ tạo `salesOrder pending`, không sinh công nợ.

## Các màn đã có

- `/` Dashboard vận hành
- `/#catalog` Danh mục
- `/#sales-orders` Đơn bán
- `/#master-orders` Đơn tổng
- `/#delivery` Đơn giao hàng hôm nay + chi tiết + thu tiền + hàng trả
- `/#returns` Trả hàng
- `/#accounting` Xác nhận kế toán
- `/#debts` Công nợ
- `/#inventory` Tồn kho
- `/#import-dms` Import DMS
- `/#system` Health/login/checklist
- `/mobile/sales.html` App bán hàng 3 tab

## Checklist test UI

1. Mở `/` không lỗi console.
2. Dashboard load `/api/reports/dashboard`.
3. Danh mục load products/customers/users/warehouses.
4. Tạo đơn bán từ màn Đơn bán.
5. Gộp đơn tổng từ màn Đơn tổng.
6. Mở màn Giao hàng, lọc ngày + NVGH, thấy đơn.
7. Click đơn, nhập SL trả + tiền mặt/chuyển khoản, xác nhận giao.
8. Mở Xác nhận kế toán, xác nhận đơn đã giao.
9. Kiểm tra Công nợ, Tồn kho, Dashboard cập nhật.
10. Test App bán hàng tạo đơn pending.
