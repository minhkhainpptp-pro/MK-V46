SET NOCOUNT ON;

/*
  Script chỉ đọc metadata. Chạy trên database test đã restore từ backup S3.
  Xuất toàn bộ result set để làm bằng chứng contract trước khi viết core adapter.
*/

DECLARE @ExpectedObjects TABLE (
    ObjectName SYSNAME NOT NULL,
    ObjectType CHAR(2) NOT NULL
);

INSERT INTO @ExpectedObjects (ObjectName, ObjectType) VALUES
    (N's3_DeliveryDoc', N'U'),
    (N's3_DeliveryDet', N'U'),
    (N's3_OrdHead', N'U'),
    (N's3_OrdDet', N'U'),
    (N's3_OrdHead2', N'U'),
    (N's3_INDoc', N'U'),
    (N's3_INTran', N'U'),
    (N's3_DeliveryDoc_sp_Complete', N'P'),
    (N's3_INDoc_sp_Post', N'P');

SELECT
    e.ObjectName,
    e.ObjectType AS ExpectedType,
    o.object_id AS ObjectId,
    o.type AS ActualType,
    o.type_desc AS ActualTypeDescription,
    s.name AS SchemaName,
    CASE WHEN o.object_id IS NULL THEN N'MISSING' ELSE N'FOUND' END AS ContractStatus
FROM @ExpectedObjects AS e
LEFT JOIN sys.objects AS o ON o.name = e.ObjectName AND o.type = e.ObjectType
LEFT JOIN sys.schemas AS s ON s.schema_id = o.schema_id
ORDER BY e.ObjectType, e.ObjectName;

SELECT
    s.name AS SchemaName,
    t.name AS TableName,
    c.column_id AS ColumnOrder,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.precision AS NumericPrecision,
    c.scale AS NumericScale,
    c.is_nullable AS IsNullable,
    c.is_identity AS IsIdentity,
    dc.definition AS DefaultDefinition,
    cc.definition AS ComputedDefinition
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
INNER JOIN sys.columns AS c ON c.object_id = t.object_id
INNER JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints AS dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
LEFT JOIN sys.computed_columns AS cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
WHERE t.name IN (
    N's3_DeliveryDoc', N's3_DeliveryDet', N's3_OrdHead', N's3_OrdDet',
    N's3_OrdHead2', N's3_INDoc', N's3_INTran'
)
ORDER BY t.name, c.column_id;

SELECT
    s.name AS SchemaName,
    t.name AS TableName,
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    i.is_primary_key AS IsPrimaryKey,
    ic.key_ordinal AS KeyOrdinal,
    c.name AS ColumnName,
    ic.is_included_column AS IsIncludedColumn
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
INNER JOIN sys.indexes AS i ON i.object_id = t.object_id
INNER JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
INNER JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE t.name IN (N's3_DeliveryDoc', N's3_DeliveryDet', N's3_INDoc', N's3_INTran')
ORDER BY t.name, i.name, ic.key_ordinal, c.column_id;

SELECT
    OBJECT_SCHEMA_NAME(tr.parent_id) AS ParentSchema,
    OBJECT_NAME(tr.parent_id) AS ParentTable,
    tr.name AS TriggerName,
    tr.is_disabled AS IsDisabled,
    OBJECT_DEFINITION(tr.object_id) AS TriggerDefinition
FROM sys.triggers AS tr
WHERE OBJECT_NAME(tr.parent_id) IN (N's3_INDoc', N's3_INTran');

SELECT
    s.name AS SchemaName,
    p.name AS ProcedureName,
    p.modify_date AS ModifiedAt,
    OBJECT_DEFINITION(p.object_id) AS ProcedureDefinition
FROM sys.procedures AS p
INNER JOIN sys.schemas AS s ON s.schema_id = p.schema_id
WHERE p.name IN (N's3_DeliveryDoc_sp_Complete', N's3_INDoc_sp_Post');

SELECT
    OBJECT_SCHEMA_NAME(d.referencing_id) AS ReferencingSchema,
    OBJECT_NAME(d.referencing_id) AS ReferencingObject,
    d.referenced_schema_name AS ReferencedSchema,
    d.referenced_entity_name AS ReferencedObject
FROM sys.sql_expression_dependencies AS d
WHERE OBJECT_NAME(d.referencing_id) IN (N's3_DeliveryDoc_sp_Complete', N's3_INDoc_sp_Post')
ORDER BY ReferencingObject, ReferencedObject;
