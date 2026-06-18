[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ServerInstance,
    [Parameter(Mandatory = $true)][string]$Database,
    [string]$OutputFile = (Join-Path $PSScriptRoot "s3-contract-probe-$((Get-Date).ToString('yyyyMMdd-HHmmss')).txt"),
    [string]$SqlRoot = (Join-Path $PSScriptRoot '..\..\sql')
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $SqlRoot '006_probe_s3_contract.sql'
if (-not (Test-Path $script)) { throw "Thiếu $script" }
if (-not (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue)) {
    throw 'Thiếu Invoke-Sqlcmd.'
}

Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -InputFile $script -AbortOnError |
    Format-List * | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Đã xuất contract probe: $OutputFile"
