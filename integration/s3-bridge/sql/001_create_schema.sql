SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'v45_int')
BEGIN
    EXEC(N'CREATE SCHEMA v45_int AUTHORIZATION dbo;');
END;
GO

IF OBJECT_ID(N'v45_int.IntegrationConfig', N'U') IS NULL
BEGIN
    CREATE TABLE v45_int.IntegrationConfig (
        ConfigKey NVARCHAR(100) NOT NULL CONSTRAINT PK_v45_int_IntegrationConfig PRIMARY KEY,
        ConfigValue NVARCHAR(1000) NOT NULL,
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_v45_int_IntegrationConfig_UpdatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedBy NVARCHAR(100) NOT NULL CONSTRAINT DF_v45_int_IntegrationConfig_UpdatedBy DEFAULT N'migration'
    );
END;
GO

MERGE v45_int.IntegrationConfig AS target
USING (VALUES
    (N'RETURN_STAGING_ENABLED', N'true'),
    (N'RETURN_AUTO_POST_ENABLED', N'false'),
    (N'SCHEMA_VERSION', N'1')
) AS source (ConfigKey, ConfigValue)
ON target.ConfigKey = source.ConfigKey
WHEN NOT MATCHED THEN
    INSERT (ConfigKey, ConfigValue) VALUES (source.ConfigKey, source.ConfigValue);
GO
