SET NOCOUNT ON;
SET XACT_ABORT ON;

IF TYPE_ID(N'v45_int.ReturnReceiptItemType') IS NULL
    THROW 51000, N'Chưa tạo type v45_int.ReturnReceiptItemType. Chạy 002_create_staging_tables.sql trước.', 1;
GO

IF OBJECT_ID(N'v45_int.sp_StageReturnReceiptRequest', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_StageReturnReceiptRequest AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_StageReturnReceiptRequest
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
    @Items v45_int.ReturnReceiptItemType READONLY,
    @SuppressResult BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @V45ReturnId = NULLIF(LTRIM(RTRIM(@V45ReturnId)), N'');
    SET @V45EventId = NULLIF(LTRIM(RTRIM(@V45EventId)), N'');
    SET @CustomerCode = NULLIF(LTRIM(RTRIM(@CustomerCode)), N'');
    SET @SourceOrderCode = NULLIF(LTRIM(RTRIM(@SourceOrderCode)), N'');
    SET @SiteID = NULLIF(LTRIM(RTRIM(@SiteID)), N'');

    IF @V45ReturnId IS NULL THROW 51001, N'V45ReturnId không được để trống.', 1;
    IF @V45EventId IS NULL THROW 51002, N'V45EventId không được để trống.', 1;
    IF @PayloadHash IS NULL OR LEN(@PayloadHash) <> 64 THROW 51003, N'PayloadHash không hợp lệ.', 1;
    IF @CustomerCode IS NULL THROW 51004, N'CustomerCode không được để trống.', 1;
    IF @SourceOrderCode IS NULL THROW 51005, N'SourceOrderCode không được để trống.', 1;
    IF @SiteID IS NULL THROW 51006, N'SiteID không được để trống.', 1;
    IF @ReturnDate IS NULL THROW 51007, N'ReturnDate không được để trống.', 1;
    IF NOT EXISTS (SELECT 1 FROM @Items) THROW 51008, N'Phiếu trả phải có ít nhất một dòng hàng.', 1;
    IF @RawPayload IS NOT NULL AND ISJSON(@RawPayload) <> 1 THROW 51009, N'RawPayload không phải JSON hợp lệ.', 1;

    DECLARE @LockResult INT;
    DECLARE @RequestId UNIQUEIDENTIFIER;
    DECLARE @ExistingHash CHAR(64);
    DECLARE @ExistingStatus NVARCHAR(30);
    DECLARE @ExistingINNbr NVARCHAR(100);

    BEGIN TRANSACTION;

    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'v45_int:return:' + @V45ReturnId,
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 10000;

    IF @LockResult < 0
        THROW 51010, N'Không thể khóa idempotency cho phiếu trả.', 1;

    SELECT
        @ExistingHash = PayloadHash,
        @ExistingStatus = Status,
        @ExistingINNbr = S3INNbr
    FROM v45_int.ReturnReceiptMap WITH (UPDLOCK, HOLDLOCK)
    WHERE V45ReturnId = @V45ReturnId;

    IF @ExistingHash IS NOT NULL
    BEGIN
        IF @ExistingHash <> @PayloadHash
            THROW 51011, N'Phiếu trả đã tồn tại nhưng payload khác nội dung ban đầu.', 1;

        COMMIT TRANSACTION;

        IF @SuppressResult = 0
        BEGIN
            SELECT
                CAST(1 AS BIT) AS IsDuplicate,
                @V45ReturnId AS V45ReturnId,
                @ExistingStatus AS Status,
                @ExistingINNbr AS S3INNbr;
        END;
        RETURN;
    END;

    INSERT INTO v45_int.ReturnReceiptMap (
        V45ReturnId, V45EventId, PayloadHash, Status
    ) VALUES (
        @V45ReturnId, @V45EventId, @PayloadHash, N'staged'
    );

    SET @RequestId = NEWID();

    INSERT INTO v45_int.ReturnReceiptRequest (
        RequestId, V45ReturnId, CustomerCode, SourceOrderCode, SiteID,
        ReturnDate, ConfirmedAt, Note, PayloadHash, RawPayload
    ) VALUES (
        @RequestId, @V45ReturnId, @CustomerCode, @SourceOrderCode, @SiteID,
        @ReturnDate, @ConfirmedAt, @Note, @PayloadHash, @RawPayload
    );

    INSERT INTO v45_int.ReturnReceiptRequestItem (
        RequestId, LineNo, ProductCode, BaseQuantity, Reason, SourceLineId
    )
    SELECT
        @RequestId,
        LineNo,
        LTRIM(RTRIM(ProductCode)),
        BaseQuantity,
        NULLIF(LTRIM(RTRIM(Reason)), N''),
        NULLIF(LTRIM(RTRIM(SourceLineId)), N'')
    FROM @Items;

    INSERT INTO v45_int.BridgeAudit (
        CorrelationId, EventId, Operation, EntityType, EntityId, Status, Details
    ) VALUES (
        @V45EventId,
        @V45EventId,
        N'STAGE_RETURN_RECEIPT',
        N'ReturnOrder',
        @V45ReturnId,
        N'completed',
        CONCAT(N'{"itemCount":', (SELECT COUNT(1) FROM @Items), N'}')
    );

    COMMIT TRANSACTION;

    IF @SuppressResult = 0
    BEGIN
        SELECT
            CAST(0 AS BIT) AS IsDuplicate,
            @V45ReturnId AS V45ReturnId,
            N'staged' AS Status,
            CAST(NULL AS NVARCHAR(100)) AS S3INNbr;
    END;
END;
GO

IF OBJECT_ID(N'v45_int.sp_MarkReturnReceiptProcessing', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_MarkReturnReceiptProcessing AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_MarkReturnReceiptProcessing
    @V45ReturnId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    UPDATE v45_int.ReturnReceiptMap
    SET Status = N'processing',
        AttemptCount = AttemptCount + 1,
        ErrorCode = NULL,
        ErrorMessage = NULL,
        UpdatedAt = SYSUTCDATETIME()
    WHERE V45ReturnId = @V45ReturnId
      AND Status IN (N'staged', N'failed');

    IF @@ROWCOUNT = 0
    BEGIN
        IF EXISTS (SELECT 1 FROM v45_int.ReturnReceiptMap WHERE V45ReturnId = @V45ReturnId AND Status IN (N'processing', N'posted'))
            RETURN;
        THROW 51020, N'Không tìm thấy phiếu trả ở trạng thái có thể xử lý.', 1;
    END;
END;
GO

IF OBJECT_ID(N'v45_int.sp_MarkReturnReceiptPosted', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_MarkReturnReceiptPosted AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_MarkReturnReceiptPosted
    @V45ReturnId NVARCHAR(100),
    @S3INNbr NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @S3INNbr = NULLIF(LTRIM(RTRIM(@S3INNbr)), N'');
    IF @S3INNbr IS NULL THROW 51021, N'S3INNbr không được để trống.', 1;

    BEGIN TRANSACTION;

    UPDATE v45_int.ReturnReceiptMap
    SET Status = N'posted',
        S3INNbr = @S3INNbr,
        ErrorCode = NULL,
        ErrorMessage = NULL,
        UpdatedAt = SYSUTCDATETIME(),
        CompletedAt = COALESCE(CompletedAt, SYSUTCDATETIME())
    WHERE V45ReturnId = @V45ReturnId
      AND (Status <> N'posted' OR S3INNbr = @S3INNbr);

    IF @@ROWCOUNT = 0
        THROW 51022, N'Không thể đánh dấu posted: phiếu không tồn tại hoặc đã liên kết chứng từ khác.', 1;

    INSERT INTO v45_int.BridgeAudit (
        CorrelationId, Operation, EntityType, EntityId, Status, Details
    ) VALUES (
        @V45ReturnId,
        N'MARK_RETURN_POSTED',
        N'ReturnOrder',
        @V45ReturnId,
        N'completed',
        CONCAT(N'{"s3INNbr":"', STRING_ESCAPE(@S3INNbr, 'json'), N'"}')
    );

    COMMIT TRANSACTION;
END;
GO

IF OBJECT_ID(N'v45_int.sp_MarkReturnReceiptFailed', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_MarkReturnReceiptFailed AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_MarkReturnReceiptFailed
    @V45ReturnId NVARCHAR(100),
    @ErrorCode NVARCHAR(100),
    @ErrorMessage NVARCHAR(2000),
    @DeadLetter BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    UPDATE v45_int.ReturnReceiptMap
    SET Status = CASE WHEN @DeadLetter = 1 THEN N'dead_letter' ELSE N'failed' END,
        ErrorCode = NULLIF(LTRIM(RTRIM(@ErrorCode)), N''),
        ErrorMessage = LEFT(NULLIF(LTRIM(RTRIM(@ErrorMessage)), N''), 2000),
        UpdatedAt = SYSUTCDATETIME()
    WHERE V45ReturnId = @V45ReturnId
      AND Status <> N'posted';

    IF @@ROWCOUNT = 0 AND NOT EXISTS (
        SELECT 1 FROM v45_int.ReturnReceiptMap
        WHERE V45ReturnId = @V45ReturnId AND Status = N'posted'
    )
        THROW 51023, N'Không tìm thấy phiếu trả để đánh dấu lỗi.', 1;
END;
GO

IF OBJECT_ID(N'v45_int.sp_GetReturnReceiptStatus', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_GetReturnReceiptStatus AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_GetReturnReceiptStatus
    @V45ReturnId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.V45ReturnId,
        m.V45EventId,
        m.PayloadHash,
        m.Status,
        m.S3INNbr,
        m.AttemptCount,
        m.ErrorCode,
        m.ErrorMessage,
        m.CreatedAt,
        m.UpdatedAt,
        m.CompletedAt,
        r.CustomerCode,
        r.SourceOrderCode,
        r.SiteID,
        r.ReturnDate,
        r.ConfirmedAt,
        r.Note
    FROM v45_int.ReturnReceiptMap AS m
    LEFT JOIN v45_int.ReturnReceiptRequest AS r ON r.V45ReturnId = m.V45ReturnId
    WHERE m.V45ReturnId = @V45ReturnId;
END;
GO
