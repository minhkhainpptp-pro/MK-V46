# V46 UI Controls Standardized Report

Đã chuẩn hóa thanh tìm kiếm, vùng lọc và nút bấm trên các màn chính.

## Phạm vi sửa
- public/css/app.css
- public/js/core/app.js
- public/js/pages/catalogPage.js
- public/js/pages/debtPage.js
- public/js/pages/deliveryTodayPage.js
- public/js/pages/accountingConfirmPage.js
- public/js/pages/inventoryPage.js
- public/js/pages/importDmsPage.js
- public/js/pages/masterOrderPage.js
- public/js/pages/returnPage.js
- public/js/pages/salesOrderPage.js

## Nguyên tắc
- Không đụng backend/API/nghiệp vụ.
- Không thay đổi tên id input/button để tránh hỏng event binding.
- Chỉ chuẩn hóa giao diện: kích thước control, focus, nút primary/success/danger/secondary, action bar, inline search, filter grid.

## Kết quả
- Input/select/textarea thống nhất chiều cao, border, focus state.
- Button thống nhất chiều cao, độ đậm, hover, màu theo vai trò.
- Vùng lọc có layout responsive rõ ràng.
- Các ô lọc thiếu label đã được bổ sung ở các màn chính.
