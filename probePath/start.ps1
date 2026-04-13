param(
  [int]$Port = 5050
)

$serverScript = Join-Path $PSScriptRoot 'server\ProbePathTcpServer.ps1'

Write-Host "Starting ProbePath on http://localhost:$Port"
& $serverScript -Port $Port
