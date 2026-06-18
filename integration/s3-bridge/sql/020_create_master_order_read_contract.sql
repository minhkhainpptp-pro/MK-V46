SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM v45_int.IntegrationConfig WHERE ConfigKey = N'MASTER_ORDER_READ_ENABLED')
    INSERT INTO v45_int.IntegrationConfig (ConfigKey, ConfigValue, UpdatedBy)
    VALUES (N'MASTER_ORDER_READ_ENABLED', N'false', N'migration');

IF NOT EXISTS (SELECT 1 FROM v45_int.IntegrationConfig WHERE ConfigKey = N'MASTER_ORDER_ADAPTER_VERSION')
    INSERT INTO v45_int.IntegrationConfig (ConfigKey, ConfigValue, UpdatedBy)
    VALUES (N'MASTER_ORDER_ADAPTER_VERSION', N'UNIMPLEMENTED', N'migration');

IF NOT EXISTS (SELECT 1 FROM v45_int.IntegrationConfig WHERE ConfigKey = N'MASTER_ORDER_CONTRACT_FINGERPRINT')
    INSERT INTO v45_int.IntegrationConfig (ConfigKey, ConfigValue, UpdatedBy)
    VALUES (N'MASTER_ORDER_CONTRACT_FINGERPRINT', N'UNVERIFIED', N'migration');
GO

IF OBJECT_ID(N'v45_int.MasterOrderDispatchMap', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.MasterOrderDispatchMap (
        EventId NVARCHAR(180) NOT NULL,
        SourceMasterOrderId NVARCHAR(100) NOT NULL,
        SourceVersion NVARCHAR(100) NOT NULL,
        PayloadHash CHAR(64) NOT NULL,
        SourceCursor NVARCHAR(1000) NULL,
        Status NVARCHAR(30) NOT NULL,
        AttemptCount INT NOT NULL CONSTRAINT DF_v45_int_MasterOrderDispatchMap_AttemptCount DEFAULT 0,
        LastError NVARCHAR(2000) NULL,
        FirstSeenAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_MasterOrderDispatchMap_FirstSeenAt DEFAULT SYSUTCDATETIME(),
        LastAttemptAt DATETIME2(3) NULL,
        CompletedAt DATETIME2(3) NULL,
        CONSTRAINT PK_v45_int_MasterOrderDispatchMap PRIMARY KEY (EventId),
        CONSTRAINT UQ_v45_int_MasterOrderDispatchMap_SourceVersion UNIQUE (SourceMasterOrderId, SourceVersion),
        CONSTRAINT CK_v45_int_MasterOrderDispatchMap_Status CHECK (
            Status IN (N'pending', N'completed', N'failed', N'conflict')
        )
    );
END;
GO

/*
 Result-set contract của core reader:
   EventId NVARCHAR(180)
   SourceMasterOrderId NVARCHAR(100)
   SourceVersion NVARCHAR(100)
   SourceCursor NVARCHAR(1000)
   PayloadHash CHAR(64)
   PayloadJson NVARCHAR(MAX)

 PayloadJson phải đúng contract POST /api/integrations/s3/master-orders/upsert.
*/
IF OBJECT_ID(N'v45_int.sp_GetCompletedMasterOrdersForV45', N'P') IS NULL
BEGIN
    EXEC(N'
        CREATE PROCEDURE v45_int.sp_GetCompletedMasterOrdersForV45
            @CursorValue NVARCHAR(1000) = NULL,
            @BatchSize INT = 20
        AS
        BEGIN
            SET NOCOUNT ON;
            THROW 51200, N''Master-order SQL adapter chưa được triển khai/xác minh.'', 1;
        END;
    ');
END;
GO

IF OBJECT_ID(N'v45_int.sp_RecordMasterOrderDispatch', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_RecordMasterOrderDispatch AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_RecordMasterOrderDispatch
    @EventId NVARCHAR(180),
    @SourceMasterOrderId NVARCHAR(100),
    @SourceVersion NVARCHAR(100),
    @PayloadHash CHAR(64),
    @SourceCursor NVARCHAR(1000) = NULL,
    @Status NVARCHAR(30),
    @LastError NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Status NOT IN (N'pending', N'completed', N'failed', N'conflict')
        THROW 51201, N'Trạng thái dispatch không hợp lệ.', 1;

    MERGE v45_int.MasterOrderDispatchMap WITH (HOLDLOCK) AS target
    USING (SELECT @EventId AS EventId) AS source
    ON target.EventId = source.EventId
    WHEN MATCHED THEN UPDATE SET
        Status = @Status,
        AttemptCount = target.AttemptCount + 1,
        LastError = LEFT(@LastError, 2000),
        LastAttemptAt = SYSUTCDATETIME(),
        CompletedAt = CASE WHEN @Status IN (N'completed', N'conflict') THEN COALESCE(target.CompletedAt, SYSUTCDATETIME()) ELSE target.CompletedAt END
    WHEN NOT MATCHED THEN INSERT (
        EventId, SourceMasterOrderId, SourceVersion, PayloadHash, SourceCursor,
        Status, AttemptCount, LastError, LastAttemptAt, CompletedAt
    ) VALUES (
        @EventId, @SourceMasterOrderId, @SourceVersion, @PayloadHash, @SourceCursor,
        @Status, 1, LEFT(@LastError, 2000), SYSUTCDATETIME(),
        CASE WHEN @Status IN (N'completed', N'conflict') THEN SYSUTCDATETIME() ELSE NULL END
    );
END;
GO

IF OBJECT_ID(N'v45_int.sp_SaveBridgeCheckpoint', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_SaveBridgeCheckpoint AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_SaveBridgeCheckpoint
    @StreamName NVARCHAR(100),
    @CursorValue NVARCHAR(1000),
    @LastRunId NVARCHAR(100) = NULL,
    @LastError NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    MERGE v45_int.BridgeCheckpoint WITH (HOLDLOCK) AS target
    USING (SELECT @StreamName AS StreamName) AS source
    ON target.StreamName = source.StreamName
    WHEN MATCHED THEN UPDATE SET
        CursorValue = @CursorValue,
        LastSuccessAt = CASE WHEN @LastError IS NULL THEN SYSUTCDATETIME() ELSE target.LastSuccessAt END,
        LastRunId = @LastRunId,
        LastError = LEFT(@LastError, 2000),
        UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
        StreamName, CursorValue, LastSuccessAt, LastRunId, LastError, UpdatedAt
    ) VALUES (
        @StreamName, @CursorValue,
        CASE WHEN @LastError IS NULL THEN SYSUTCDATETIME() ELSE NULL END,
        @LastRunId, LEFT(@LastError, 2000), SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID(N'v45_int.sp_GetBridgeCheckpoint', N'P') IS NULL
    EXEC(N'CREATE PROCEDURE v45_int.sp_GetBridgeCheckpoint AS BEGIN SET NOCOUNT ON; END;');
GO

ALTER PROCEDURE v45_int.sp_GetBridgeCheckpoint
    @StreamName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StreamName, CursorValue, LastSuccessAt, LastRunId, LastError, UpdatedAt
    FROM v45_int.BridgeCheckpoint
    WHERE StreamName = @StreamName;
END;
GO

GRANT EXECUTE ON OBJECT::v45_int.sp_GetCompletedMasterOrdersForV45 TO v45_bridge_reader;
GRANT EXECUTE ON OBJECT::v45_int.sp_RecordMasterOrderDispatch TO v45_bridge_reader;
GRANT EXECUTE ON OBJECT::v45_int.sp_SaveBridgeCheckpoint TO v45_bridge_reader;
GRANT EXECUTE ON OBJECT::v45_int.sp_GetBridgeCheckpoint TO v45_bridge_reader;
GO
