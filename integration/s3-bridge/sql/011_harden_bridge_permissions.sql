SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Bridge chỉ được gọi orchestrator và đọc trạng thái.
-- Không cho Bridge tự đánh dấu posted/failed, tránh giả mạo kết quả kho.
REVOKE EXECUTE ON OBJECT::v45_int.sp_StageReturnReceiptRequest FROM v45_bridge_return_writer;
REVOKE EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptProcessing FROM v45_bridge_return_writer;
REVOKE EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptPosted FROM v45_bridge_return_writer;
REVOKE EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptFailed FROM v45_bridge_return_writer;

GRANT EXECUTE ON OBJECT::v45_int.sp_CreateReturnReceipt TO v45_bridge_return_writer;
GRANT EXECUTE ON OBJECT::v45_int.sp_GetReturnReceiptStatus TO v45_bridge_return_writer;

-- Không grant hai procedure quản trị dưới đây cho role Bridge:
-- v45_int.sp_RegisterVerifiedCoreAdapter
-- v45_int.sp_SetReturnAutoPostEnabled
