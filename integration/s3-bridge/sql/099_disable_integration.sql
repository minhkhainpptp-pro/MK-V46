SET NOCOUNT ON;
SET XACT_ABORT ON;

UPDATE v45_int.IntegrationConfig
SET ConfigValue = N'false',
    UpdatedAt = SYSUTCDATETIME(),
    UpdatedBy = N'rollback-script'
WHERE ConfigKey IN (N'RETURN_STAGING_ENABLED', N'RETURN_AUTO_POST_ENABLED');

-- Cố ý không DROP bảng hoặc xóa dữ liệu audit/idempotency.
-- Dừng Windows Service Bridge sau khi chạy script này.
SELECT ConfigKey, ConfigValue, UpdatedAt
FROM v45_int.IntegrationConfig
WHERE ConfigKey IN (N'RETURN_STAGING_ENABLED', N'RETURN_AUTO_POST_ENABLED');
