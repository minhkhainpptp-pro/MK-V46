/*
  TEMPLATE CỐ Ý KHÔNG THỂ DEPLOY NGUYÊN TRẠNG.

  Chỉ thay `v45_int.sp_PostReturnReceiptCore` sau khi đã có tài liệu:
    1. Schema/constraint/trigger thực tế của s3_INDoc và s3_INTran.
    2. Signature + hành vi transaction của s3_INDoc_sp_Post.
    3. Before/after diff của phiếu TK tạo từ giao diện S3.
    4. Test idempotency, rollback và quy đổi thùng/lẻ trên DB test.

  Adapter production phải:
    - Đọc request từ v45_int.ReturnReceiptRequest/Item.
    - Validate product/site bằng dữ liệu S3.
    - Sinh INNbr theo đúng cơ chế S3, không tự đoán MAX+1.
    - Tạo header + toàn bộ detail trong một transaction.
    - Gọi nghiệp vụ post chính thức của S3.
    - Kiểm tra chứng từ đã post.
    - Gán @S3INNbr OUTPUT.
    - Không cập nhật trực tiếp số tồn.
*/

THROW 51130, N'Không được chạy template. Cần tạo adapter theo contract database S3 đã xác minh.', 1;
