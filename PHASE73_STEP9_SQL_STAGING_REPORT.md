# PHASE 73 — BƯỚC 9: SQL STAGING `v45_int`

## Đã thực hiện

- Tạo schema riêng `v45_int`, không sửa binary hoặc bảng lõi S3.
- Tạo bảng idempotency `ReturnReceiptMap`.
- Tạo staging header/detail cho yêu cầu nhập kho trả hàng.
- Tạo checkpoint và audit dành riêng cho Bridge.
- Tạo table type truyền item theo TVP, không ghép SQL động.
- Tạo stored procedure staging có transaction, `XACT_ABORT` và `sp_getapplock`.
- Tạo procedure đánh dấu processing/posted/failed và tra cứu trạng thái.
- Tách role đọc và role ghi; role ghi chỉ được `EXECUTE` procedure.
- Auto-post mặc định bị khóa bằng `RETURN_AUTO_POST_ENABLED=false`.
- Rollback chỉ vô hiệu hóa tích hợp, không xóa audit/idempotency.

## Phạm vi an toàn

Bước này **chưa** insert/update `s3_INDoc`, `s3_INTran`, tồn kho hoặc gọi `s3_INDoc_sp_Post`.
Mục tiêu là tạo vùng đệm có thể kiểm toán trước khi làm adapter post kho.

## Điều kiện triển khai

1. Chạy trên database test được restore từ backup S3.
2. Chạy lần lượt script `001` đến `005`.
3. Không bật auto-post.
4. Ánh xạ Windows Service account vào hai database role theo nguyên tắc tối thiểu.
