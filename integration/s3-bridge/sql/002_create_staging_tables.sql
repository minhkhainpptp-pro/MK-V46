SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'v45_int') IS NULL
    THROW 51000, N'Chưa tạo schema v45_int. Chạy 001_create_schema.sql trước.', 1;
GO

IF OBJECT_ID(N'v45_int.ReturnReceiptMap', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.ReturnReceiptMap (
        V45ReturnId NVARCHAR(100) NOT NULL,
        V45EventId NVARCHAR(150) NOT NULL,
        PayloadHash CHAR(64) NOT NULL,
        Status NVARCHAR(30) NOT NULL,
        S3INNbr NVARCHAR(100) NULL,
        AttemptCount INT NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptMap_AttemptCount DEFAULT 0,
        ErrorCode NVARCHAR(100) NULL,
        ErrorMessage NVARCHAR(2000) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptMap_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptMap_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CompletedAt DATETIME2(3) NULL,
        CONSTRAINT PK_v45_int_ReturnReceiptMap PRIMARY KEY (V45ReturnId),
        CONSTRAINT UQ_v45_int_ReturnReceiptMap_Event UNIQUE (V45EventId),
        CONSTRAINT CK_v45_int_ReturnReceiptMap_Status CHECK (
            Status IN (N'staged', N'processing', N'posted', N'failed', N'dead_letter')
        ),
        CONSTRAINT CK_v45_int_ReturnReceiptMap_AttemptCount CHECK (AttemptCount >= 0)
    );
END;
GO

IF OBJECT_ID(N'v45_int.ReturnReceiptRequest', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.ReturnReceiptRequest (
        RequestId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptRequest_Id DEFAULT NEWSEQUENTIALID(),
        V45ReturnId NVARCHAR(100) NOT NULL,
        CustomerCode NVARCHAR(100) NOT NULL,
        SourceOrderCode NVARCHAR(100) NOT NULL,
        SiteID NVARCHAR(50) NOT NULL,
        ReturnDate DATE NOT NULL,
        ConfirmedAt DATETIME2(3) NULL,
        Note NVARCHAR(1000) NULL,
        PayloadHash CHAR(64) NOT NULL,
        RawPayload NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptRequest_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_v45_int_ReturnReceiptRequest PRIMARY KEY (RequestId),
        CONSTRAINT UQ_v45_int_ReturnReceiptRequest_Return UNIQUE (V45ReturnId),
        CONSTRAINT FK_v45_int_ReturnReceiptRequest_Map FOREIGN KEY (V45ReturnId)
            REFERENCES v45_int.ReturnReceiptMap(V45ReturnId),
        CONSTRAINT CK_v45_int_ReturnReceiptRequest_RawPayloadJson CHECK (
            RawPayload IS NULL OR ISJSON(RawPayload) = 1
        )
    );
END;
GO

IF OBJECT_ID(N'v45_int.ReturnReceiptRequestItem', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.ReturnReceiptRequestItem (
        RequestItemId BIGINT IDENTITY(1,1) NOT NULL,
        RequestId UNIQUEIDENTIFIER NOT NULL,
        LineNo INT NOT NULL,
        ProductCode NVARCHAR(100) NOT NULL,
        BaseQuantity DECIMAL(18,4) NOT NULL,
        Reason NVARCHAR(500) NULL,
        SourceLineId NVARCHAR(100) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_ReturnReceiptRequestItem_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_v45_int_ReturnReceiptRequestItem PRIMARY KEY (RequestItemId),
        CONSTRAINT UQ_v45_int_ReturnReceiptRequestItem_Line UNIQUE (RequestId, LineNo),
        CONSTRAINT FK_v45_int_ReturnReceiptRequestItem_Request FOREIGN KEY (RequestId)
            REFERENCES v45_int.ReturnReceiptRequest(RequestId),
        CONSTRAINT CK_v45_int_ReturnReceiptRequestItem_LineNo CHECK (LineNo > 0),
        CONSTRAINT CK_v45_int_ReturnReceiptRequestItem_Qty CHECK (BaseQuantity > 0)
    );
END;
GO

IF OBJECT_ID(N'v45_int.BridgeCheckpoint', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.BridgeCheckpoint (
        StreamName NVARCHAR(100) NOT NULL,
        CursorValue NVARCHAR(1000) NULL,
        LastSuccessAt DATETIME2(3) NULL,
        LastRunId NVARCHAR(100) NULL,
        LastError NVARCHAR(2000) NULL,
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_BridgeCheckpoint_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_v45_int_BridgeCheckpoint PRIMARY KEY (StreamName)
    );
END;
GO

IF OBJECT_ID(N'v45_int.BridgeAudit', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.BridgeAudit (
        AuditId BIGINT IDENTITY(1,1) NOT NULL,
        CorrelationId NVARCHAR(150) NULL,
        EventId NVARCHAR(150) NULL,
        Operation NVARCHAR(100) NOT NULL,
        EntityType NVARCHAR(100) NULL,
        EntityId NVARCHAR(150) NULL,
        Status NVARCHAR(30) NOT NULL,
        DurationMs INT NULL,
        Details NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_BridgeAudit_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_v45_int_BridgeAudit PRIMARY KEY (AuditId),
        CONSTRAINT CK_v45_int_BridgeAudit_DetailsJson CHECK (Details IS NULL OR ISJSON(Details) = 1)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'v45_int.ReturnReceiptMap')
      AND name = N'IX_v45_int_ReturnReceiptMap_StatusUpdated'
)
    CREATE INDEX IX_v45_int_ReturnReceiptMap_StatusUpdated
        ON v45_int.ReturnReceiptMap(Status, UpdatedAt);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'v45_int.BridgeAudit')
      AND name = N'IX_v45_int_BridgeAudit_EventCreated'
)
    CREATE INDEX IX_v45_int_BridgeAudit_EventCreated
        ON v45_int.BridgeAudit(EventId, CreatedAt DESC);
GO

IF TYPE_ID(N'v45_int.ReturnReceiptItemType') IS NULL
BEGIN
    EXEC(N'
        CREATE TYPE v45_int.ReturnReceiptItemType AS TABLE (
            LineNo INT NOT NULL,
            ProductCode NVARCHAR(100) NOT NULL,
            BaseQuantity DECIMAL(18,4) NOT NULL,
            Reason NVARCHAR(500) NULL,
            SourceLineId NVARCHAR(100) NULL,
            PRIMARY KEY (LineNo),
            CHECK (LineNo > 0),
            CHECK (BaseQuantity > 0)
        );
    ');
END;
GO
