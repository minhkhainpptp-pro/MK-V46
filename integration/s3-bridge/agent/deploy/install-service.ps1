[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ServiceName = 'S3V45Bridge',
    [string]$DisplayName = 'S3 - V45 Bridge Agent',
    [string]$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source,
    [Parameter(Mandatory = $true)][string]$NssmPath
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $NssmPath)) { throw "Không tìm thấy NSSM: $NssmPath" }
if (-not (Test-Path (Join-Path $AgentRoot 'package-lock.json'))) { throw 'Thiếu package-lock.json' }

Push-Location $AgentRoot
try {
    npm ci --omit=dev
    npm run check
    npm test
} finally {
    Pop-Location
}

$logs = Join-Path $AgentRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$main = Join-Path $AgentRoot 'src\main.js'

if ($PSCmdlet.ShouldProcess($ServiceName, 'Install/replace NSSM service')) {
    & $NssmPath stop $ServiceName confirm 2>$null | Out-Null
    & $NssmPath remove $ServiceName confirm 2>$null | Out-Null
    & $NssmPath install $ServiceName $NodePath $main
    & $NssmPath set $ServiceName DisplayName $DisplayName
    & $NssmPath set $ServiceName AppDirectory $AgentRoot
    & $NssmPath set $ServiceName Start SERVICE_DELAYED_AUTO_START
    & $NssmPath set $ServiceName AppExit Default Restart
    & $NssmPath set $ServiceName AppRestartDelay 10000
    & $NssmPath set $ServiceName AppStdout (Join-Path $logs 'bridge-stdout.log')
    & $NssmPath set $ServiceName AppStderr (Join-Path $logs 'bridge-stderr.log')
    & $NssmPath set $ServiceName AppRotateFiles 1
    & $NssmPath set $ServiceName AppRotateBytes 10485760
    & $NssmPath start $ServiceName
}

Write-Host 'Lưu ý: secret phải được cấu hình bằng Windows machine environment/secret manager, không đặt trong command line hoặc source.'
