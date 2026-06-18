SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DATABASE_PRINCIPAL_ID(N'v45_bridge_reader') IS NULL
    CREATE ROLE v45_bridge_reader AUTHORIZATION dbo;
GO

IF DATABASE_PRINCIPAL_ID(N'v45_bridge_return_writer') IS NULL
    CREATE ROLE v45_bridge_return_writer AUTHORIZATION dbo;
GO

GRANT SELECT ON OBJECT::v45_int.IntegrationConfig TO v45_bridge_reader;
GRANT SELECT ON OBJECT::v45_int.ReturnReceiptMap TO v45_bridge_reader;
GRANT SELECT ON OBJECT::v45_int.ReturnReceiptRequest TO v45_bridge_reader;
GRANT SELECT ON OBJECT::v45_int.ReturnReceiptRequestItem TO v45_bridge_reader;
GRANT SELECT ON OBJECT::v45_int.BridgeCheckpoint TO v45_bridge_reader;
GRANT SELECT ON OBJECT::v45_int.BridgeAudit TO v45_bridge_reader;
GO

GRANT EXECUTE ON OBJECT::v45_int.sp_StageReturnReceiptRequest TO v45_bridge_return_writer;
GRANT EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptProcessing TO v45_bridge_return_writer;
GRANT EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptPosted TO v45_bridge_return_writer;
GRANT EXECUTE ON OBJECT::v45_int.sp_MarkReturnReceiptFailed TO v45_bridge_return_writer;
GRANT EXECUTE ON OBJECT::v45_int.sp_GetReturnReceiptStatus TO v45_bridge_return_writer;
GO

-- Không tạo LOGIN/USER trong script dùng chung.
-- Quản trị viên DB phải ánh xạ service account vào đúng role, ví dụ:
-- ALTER ROLE v45_bridge_reader ADD MEMBER [DOMAIN\S3V45Bridge$];
-- ALTER ROLE v45_bridge_return_writer ADD MEMBER [DOMAIN\S3V45Bridge$];
