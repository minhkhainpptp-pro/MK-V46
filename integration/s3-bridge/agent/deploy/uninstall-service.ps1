[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ServiceName = 'S3V45Bridge',
    [Parameter(Mandatory = $true)][string]$NssmPath
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $NssmPath)) { throw "Không tìm thấy NSSM: $NssmPath" }
if ($PSCmdlet.ShouldProcess($ServiceName, 'Stop and remove service')) {
    & $NssmPath stop $ServiceName confirm 2>$null | Out-Null
    & $NssmPath remove $ServiceName confirm
}
