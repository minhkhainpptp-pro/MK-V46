/*
  TEMPLATE KHÔNG ĐƯỢC CHẠY NGUYÊN TRẠNG.

  DBA phải ALTER v45_int.sp_GetCompletedMasterOrdersForV45 dựa trên schema thật:
    s3_DeliveryDoc -> s3_DeliveryDet -> s3_OrdHead -> s3_OrdDet.

  Quy tắc bắt buộc:
    - Chỉ lấy đơn tổng đã complete, không lấy draft.
    - Không dùng WITH (NOLOCK) trên dữ liệu đang tạo đơn.
    - Result set đúng 6 cột được mô tả trong 020_create_master_order_read_contract.sql.
    - EventId ổn định theo master id + source version.
    - PayloadHash SHA-256 của canonical payload.
    - Có cửa sổ overlap khi đọc incremental; V45 tự idempotency.
    - Không UPDATE/INSERT/DELETE bảng S3.
*/
THROW 51210, N'Không được chạy template master-order adapter khi chưa xác minh contract.', 1;
