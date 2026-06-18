SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM v45_int.IntegrationConfig WHERE ConfigKey = N'S3_CORE_ADAPTER_VERSION')
    INSERT INTO v45_int.IntegrationConfig (ConfigKey, ConfigValue, UpdatedBy)
    VALUES (N'S3_CORE_ADAPTER_VERSION', N'UNIMPLEMENTED', N'migration');
GO

IF NOT EXISTS (SELECT 1 FROM v45_int.IntegrationConfig WHERE ConfigKey = N'S3_CONTRACT_FINGERPRINT')
    INSERT INTO v45_int.IntegrationConfig (ConfigKey, ConfigValue, UpdatedBy)
    VALUES (N'S3_CONTRACT_FINGERPRINT', N'UNVERIFIED', N'migration');
GO

/*
  Fail-closed hook. Chỉ thay procedure này sau khi:
  - đã chạy 006_probe_s3_contract.sql trên DB test,
  - đã chụp before/after một phiếu TK tạo bằng giao diện S3,
  - đã có integration tests chứng minh transaction/rollback/idempotency.
*/
IF OBJECT_ID(N'v45_int.sp_PostReturnReceiptCore', N'P') IS NULL
BEGIN
    EXEC(N'
        CREATE PROCEDURE v45_int.sp_PostReturnReceiptCore
            @V45ReturnId NVARCHAR(100),
            @S3INNbr NVARCHAR(100) OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;
            THROW 51100, N''S3 core adapter chưa được triển khai/xác minh. Auto-post bị khóa an toàn.'', 1;
        END;
    ');
END;
GO

IF OBJECT_ID(N'v45_int.sp_CreateReturnReceipt', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_CreateReturnReceipt AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_CreateReturnReceipt
    @V45ReturnId NVARCHAR(100),
    @V45EventId NVARCHAR(150),
    @PayloadHash CHAR(64),
    @CustomerCode NVARCHAR(100),
    @SourceOrderCode NVARCHAR(100),
    @SiteID NVARCHAR(50),
    @ReturnDate DATE,
    @ConfirmedAt DATETIME2(3) = NULL,
    @Note NVARCHAR(1000) = NULL,
    @RawPayload NVARCHAR(MAX) = NULL,
    @Items v45_int.ReturnReceiptItemType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @StagingEnabled NVARCHAR(100);
    DECLARE @AutoPostEnabled NVARCHAR(100);
    DECLARE @AdapterVersion NVARCHAR(100);
    DECLARE @ContractFingerprint NVARCHAR(1000);
    DECLARE @CurrentStatus NVARCHAR(30);
    DECLARE @ExistingINNbr NVARCHAR(100);
    DECLARE @S3INNbr NVARCHAR(100);

    SELECT @StagingEnabled = ConfigValue FROM v45_int.IntegrationConfig WHERE ConfigKey = N'RETURN_STAGING_ENABLED';
    IF LOWER(COALESCE(@StagingEnabled, N'false')) <> N'true'
        THROW 51101, N'Vùng staging trả hàng đang bị vô hiệu hóa.', 1;

    EXEC v45_int.sp_StageReturnReceiptRequest
        @V45ReturnId = @V45ReturnId,
        @V45EventId = @V45EventId,
        @PayloadHash = @PayloadHash,
        @CustomerCode = @CustomerCode,
        @SourceOrderCode = @SourceOrderCode,
        @SiteID = @SiteID,
        @ReturnDate = @ReturnDate,
        @ConfirmedAt = @ConfirmedAt,
        @Note = @Note,
        @RawPayload = @RawPayload,
        @Items = @Items,
        @SuppressResult = 1;

    SELECT
        @CurrentStatus = Status,
        @ExistingINNbr = S3INNbr
    FROM v45_int.ReturnReceiptMap
    WHERE V45ReturnId = @V45ReturnId;

    IF @CurrentStatus = N'posted'
    BEGIN
        SELECT
            @V45ReturnId AS V45ReturnId,
            N'posted' AS Status,
            @ExistingINNbr AS S3INNbr,
            CAST(1 AS BIT) AS IsIdempotentReplay;
        RETURN;
    END;

    SELECT @AutoPostEnabled = ConfigValue FROM v45_int.IntegrationConfig WHERE ConfigKey = N'RETURN_AUTO_POST_ENABLED';
    IF LOWER(COALESCE(@AutoPostEnabled, N'false')) <> N'true'
    BEGIN
        SELECT
            @V45ReturnId AS V45ReturnId,
            N'staged' AS Status,
            CAST(NULL AS NVARCHAR(100)) AS S3INNbr,
            CAST(0 AS BIT) AS IsIdempotentReplay;
        RETURN;
    END;

    SELECT @AdapterVersion = ConfigValue FROM v45_int.IntegrationConfig WHERE ConfigKey = N'S3_CORE_ADAPTER_VERSION';
    SELECT @ContractFingerprint = ConfigValue FROM v45_int.IntegrationConfig WHERE ConfigKey = N'S3_CONTRACT_FINGERPRINT';

    IF NULLIF(@AdapterVersion, N'') IS NULL OR @AdapterVersion = N'UNIMPLEMENTED'
        THROW 51102, N'Không thể auto-post: S3 core adapter chưa được đăng ký.', 1;

    IF NULLIF(@ContractFingerprint, N'') IS NULL OR @ContractFingerprint = N'UNVERIFIED'
        THROW 51103, N'Không thể auto-post: contract database S3 chưa được xác minh.', 1;

    BEGIN TRY
        EXEC v45_int.sp_MarkReturnReceiptProcessing @V45ReturnId = @V45ReturnId;

        EXEC v45_int.sp_PostReturnReceiptCore
            @V45ReturnId = @V45ReturnId,
            @S3INNbr = @S3INNbr OUTPUT;

        IF NULLIF(LTRIM(RTRIM(@S3INNbr)), N'') IS NULL
            THROW 51104, N'Core adapter không trả về mã chứng từ S3.', 1;

        EXEC v45_int.sp_MarkReturnReceiptPosted
            @V45ReturnId = @V45ReturnId,
            @S3INNbr = @S3INNbr;

        SELECT
            @V45ReturnId AS V45ReturnId,
            N'posted' AS Status,
            @S3INNbr AS S3INNbr,
            CAST(0 AS BIT) AS IsIdempotentReplay;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        DECLARE @ErrorMessage NVARCHAR(2000) = ERROR_MESSAGE();

        EXEC v45_int.sp_MarkReturnReceiptFailed
            @V45ReturnId = @V45ReturnId,
            @ErrorCode = CONVERT(NVARCHAR(100), @ErrorNumber),
            @ErrorMessage = @ErrorMessage,
            @DeadLetter = 0;

        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'v45_int.sp_RegisterVerifiedCoreAdapter', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_RegisterVerifiedCoreAdapter AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_RegisterVerifiedCoreAdapter
    @AdapterVersion NVARCHAR(100),
    @ContractFingerprint NVARCHAR(1000),
    @UpdatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @AdapterVersion = NULLIF(LTRIM(RTRIM(@AdapterVersion)), N'');
    SET @ContractFingerprint = NULLIF(LTRIM(RTRIM(@ContractFingerprint)), N'');
    SET @UpdatedBy = COALESCE(NULLIF(LTRIM(RTRIM(@UpdatedBy)), N''), N'dba');

    IF @AdapterVersion IS NULL OR @AdapterVersion = N'UNIMPLEMENTED'
        THROW 51110, N'AdapterVersion không hợp lệ.', 1;
    IF @ContractFingerprint IS NULL OR @ContractFingerprint = N'UNVERIFIED'
        THROW 51111, N'ContractFingerprint không hợp lệ.', 1;

    UPDATE v45_int.IntegrationConfig
    SET ConfigValue = @AdapterVersion, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
    WHERE ConfigKey = N'S3_CORE_ADAPTER_VERSION';

    UPDATE v45_int.IntegrationConfig
    SET ConfigValue = @ContractFingerprint, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
    WHERE ConfigKey = N'S3_CONTRACT_FINGERPRINT';

    -- Đăng ký adapter không tự bật auto-post.
    UPDATE v45_int.IntegrationConfig
    SET ConfigValue = N'false', UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
    WHERE ConfigKey = N'RETURN_AUTO_POST_ENABLED';
END;
GO

IF OBJECT_ID(N'v45_int.sp_SetReturnAutoPostEnabled', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_SetReturnAutoPostEnabled AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_SetReturnAutoPostEnabled
    @Enabled BIT,
    @ExpectedAdapterVersion NVARCHAR(100),
    @ExpectedContractFingerprint NVARCHAR(1000),
    @UpdatedBy NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Enabled = 1
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM v45_int.IntegrationConfig
            WHERE ConfigKey = N'S3_CORE_ADAPTER_VERSION'
              AND ConfigValue = @ExpectedAdapterVersion
              AND ConfigValue <> N'UNIMPLEMENTED'
        ) THROW 51120, N'Adapter version không khớp bản đã xác minh.', 1;

        IF NOT EXISTS (
            SELECT 1 FROM v45_int.IntegrationConfig
            WHERE ConfigKey = N'S3_CONTRACT_FINGERPRINT'
              AND ConfigValue = @ExpectedContractFingerprint
              AND ConfigValue <> N'UNVERIFIED'
        ) THROW 51121, N'Contract fingerprint không khớp bản đã xác minh.', 1;
    END;

    UPDATE v45_int.IntegrationConfig
    SET ConfigValue = CASE WHEN @Enabled = 1 THEN N'true' ELSE N'false' END,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedBy = COALESCE(NULLIF(LTRIM(RTRIM(@UpdatedBy)), N''), N'dba')
    WHERE ConfigKey = N'RETURN_AUTO_POST_ENABLED';
END;
GO
