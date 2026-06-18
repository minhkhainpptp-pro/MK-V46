[CmdletBinding()]
param(
    [string]$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source
)

$ErrorActionPreference = 'Stop'
& $NodePath (Join-Path $AgentRoot 'scripts\health-check.js')
if ($LASTEXITCODE -ne 0) { throw "Bridge health check failed with exit code $LASTEXITCODE" }
