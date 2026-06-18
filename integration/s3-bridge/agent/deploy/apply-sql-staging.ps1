[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)][string]$ServerInstance,
    [Parameter(Mandatory = $true)][string]$Database,
    [string]$SqlRoot = (Join-Path $PSScriptRoot '..\..\sql')
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue)) {
    throw 'Thiếu Invoke-Sqlcmd. Cài module PowerShell SqlServer trên máy quản trị.'
}

$scripts = @(
    '001_create_schema.sql',
    '002_create_staging_tables.sql',
    '003_create_staging_procedures.sql',
    '004_create_roles_and_permissions.sql',
    '010_create_guarded_return_orchestrator.sql',
    '011_harden_bridge_permissions.sql',
    '020_create_master_order_read_contract.sql',
    '005_verify_staging.sql'
)

foreach ($name in $scripts) {
    $path = Join-Path $SqlRoot $name
    if (-not (Test-Path $path)) { throw "Thiếu SQL script: $path" }
    if ($PSCmdlet.ShouldProcess("$ServerInstance/$Database", "Run $name")) {
        Write-Host "Applying $name ..."
        Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -InputFile $path -AbortOnError
    }
}

Write-Host 'SQL staging v45_int đã áp dụng. Auto-post vẫn phải ở trạng thái false.'
