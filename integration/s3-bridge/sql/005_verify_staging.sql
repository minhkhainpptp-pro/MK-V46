SET NOCOUNT ON;

DECLARE @Errors TABLE (CheckName NVARCHAR(200), ErrorMessage NVARCHAR(1000));

IF SCHEMA_ID(N'v45_int') IS NULL
    INSERT INTO @Errors VALUES (N'schema', N'Thiếu schema v45_int');

IF OBJECT_ID(N'v45_int.ReturnReceiptMap', N'U') IS NULL
    INSERT INTO @Errors VALUES (N'ReturnReceiptMap', N'Thiếu bảng idempotency map');

IF OBJECT_ID(N'v45_int.ReturnReceiptRequest', N'U') IS NULL
    INSERT INTO @Errors VALUES (N'ReturnReceiptRequest', N'Thiếu bảng staging header');

IF OBJECT_ID(N'v45_int.ReturnReceiptRequestItem', N'U') IS NULL
    INSERT INTO @Errors VALUES (N'ReturnReceiptRequestItem', N'Thiếu bảng staging detail');

IF OBJECT_ID(N'v45_int.sp_StageReturnReceiptRequest', N'P') IS NULL
    INSERT INTO @Errors VALUES (N'sp_StageReturnReceiptRequest', N'Thiếu stored procedure staging');

IF EXISTS (
    SELECT 1
    FROM v45_int.IntegrationConfig
    WHERE ConfigKey = N'RETURN_AUTO_POST_ENABLED' AND LOWER(ConfigValue) <> N'false'
)
    INSERT INTO @Errors VALUES (N'auto-post', N'RETURN_AUTO_POST_ENABLED phải là false ở bước staging');

IF EXISTS (SELECT 1 FROM @Errors)
BEGIN
    SELECT * FROM @Errors;
    THROW 51090, N'Kiểm tra staging v45_int không đạt.', 1;
END;

SELECT
    N'PASS' AS VerificationStatus,
    DB_NAME() AS DatabaseName,
    SYSUTCDATETIME() AS VerifiedAt,
    (SELECT ConfigValue FROM v45_int.IntegrationConfig WHERE ConfigKey = N'RETURN_AUTO_POST_ENABLED') AS ReturnAutoPostEnabled;
