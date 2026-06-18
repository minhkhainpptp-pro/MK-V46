[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ServiceName = 'S3V45Bridge',
    [Parameter(Mandatory = $true)][string]$NssmPath,
    [Parameter(Mandatory = $true)][string]$ServerInstance,
    [Parameter(Mandatory = $true)][string]$Database,
    [string]$SqlRoot = (Join-Path $PSScriptRoot '..\..\sql')
)

$ErrorActionPreference = 'Stop'
if ($PSCmdlet.ShouldProcess($ServiceName, 'Stop Bridge and disable SQL integration')) {
    & $NssmPath stop $ServiceName confirm 2>$null | Out-Null
    Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database `
        -InputFile (Join-Path $SqlRoot '099_disable_integration.sql') -AbortOnError
}
Write-Host 'Rollback hoàn tất: Bridge dừng, SQL integration disabled, audit/idempotency được giữ nguyên.'
