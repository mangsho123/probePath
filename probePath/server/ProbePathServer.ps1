param(
  [int]$Port = 5050
)

$ErrorActionPreference = 'Stop'

$serverRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$appRoot = (Resolve-Path (Join-Path $serverRoot '..\app')).Path
$reportsRoot = Join-Path (Resolve-Path (Join-Path $serverRoot '..\data')).Path 'reports'
New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null

function Send-Bytes {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][byte[]]$Bytes,
    [Parameter(Mandatory = $true)][string]$ContentType,
    [int]$StatusCode = 200
  )

  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = $ContentType
  $response.ContentLength64 = $Bytes.Length
  $response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $response.OutputStream.Close()
}

function Send-Text {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][string]$Text,
    [string]$ContentType = 'text/plain; charset=utf-8',
    [int]$StatusCode = 200
  )

  $encoding = [System.Text.UTF8Encoding]::new($false)
  Send-Bytes -Context $Context -Bytes $encoding.GetBytes($Text) -ContentType $ContentType -StatusCode $StatusCode
}

function Send-Json {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)]$Payload,
    [int]$StatusCode = 200
  )

  $json = $Payload | ConvertTo-Json -Depth 16
  Send-Text -Context $Context -Text $json -ContentType 'application/json; charset=utf-8' -StatusCode $StatusCode
}

function Read-Body {
  param([Parameter(Mandatory = $true)]$Request)

  $reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Get-MimeType {
  param([Parameter(Mandatory = $true)][string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js' { return 'text/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.svg' { return 'image/svg+xml' }
    default { return 'application/octet-stream' }
  }
}

function Get-ReportMetadata {
  $files = Get-ChildItem -Path $reportsRoot -Filter '*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 8
  $items = @()

  foreach ($file in $files) {
    try {
      $payload = Get-Content -Path $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
      $items += [pscustomobject]@{
        id = $payload.id
        title = $payload.title
        url = "/report.html?id=$($payload.id)"
        topFault = $payload.report.rankedFaults[0].label
        createdAt = $payload.createdAt
      }
    }
    catch {
      continue
    }
  }

  return $items
}

function Handle-Api {
  param([Parameter(Mandatory = $true)]$Context)

  $request = $Context.Request
  $path = $request.Url.AbsolutePath

  if ($path -eq '/api/health') {
    Send-Json -Context $Context -Payload @{ name = 'ProbePath'; ok = $true; now = [DateTime]::UtcNow.ToString('o') }
    return
  }

  if ($path -eq '/api/history') {
    Send-Json -Context $Context -Payload @{ reports = Get-ReportMetadata }
    return
  }

  if ($path -eq '/api/reports' -and $request.HttpMethod -eq 'POST') {
    $rawBody = Read-Body -Request $request
    $payload = $rawBody | ConvertFrom-Json
    $id = [Guid]::NewGuid().ToString('N').Substring(0, 10)
    $record = [ordered]@{
      id = $id
      title = $payload.title
      templateId = $payload.templateId
      templateName = $payload.templateName
      symptomId = $payload.symptomId
      symptomLabel = $payload.symptomLabel
      createdAt = $payload.createdAt
      summary = $payload.summary
      report = $payload.report
    }
    $json = $record | ConvertTo-Json -Depth 16
    [System.IO.File]::WriteAllText((Join-Path $reportsRoot "$id.json"), $json, [System.Text.UTF8Encoding]::new($false))
    Send-Json -Context $Context -Payload @{ id = $id; url = "/report.html?id=$id"; createdAt = $payload.createdAt } -StatusCode 201
    return
  }

  if ($path -match '^/api/reports/([a-zA-Z0-9\-]+)$' -and $request.HttpMethod -eq 'GET') {
    $id = $matches[1]
    $filePath = Join-Path $reportsRoot "$id.json"

    if (-not (Test-Path -LiteralPath $filePath)) {
      Send-Json -Context $Context -Payload @{ error = 'Report not found.' } -StatusCode 404
      return
    }

    $payload = Get-Content -Path $filePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Send-Json -Context $Context -Payload $payload
    return
  }

  Send-Json -Context $Context -Payload @{ error = 'Not found.' } -StatusCode 404
}

function Handle-Static {
  param([Parameter(Mandatory = $true)]$Context)

  $requestPath = $Context.Request.Url.AbsolutePath

  if ($requestPath -eq '/favicon.ico') {
    $Context.Response.StatusCode = 204
    $Context.Response.OutputStream.Close()
    return
  }

  if ($requestPath -eq '/') {
    $relativePath = 'index.html'
  }
  elseif ($requestPath -eq '/report' -or $requestPath -eq '/report/') {
    $relativePath = 'report.html'
  }
  else {
    $relativePath = [System.Uri]::UnescapeDataString($requestPath.TrimStart('/'))
  }

  $fullPath = Join-Path $appRoot $relativePath

  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Send-Text -Context $Context -Text 'Not found.' -StatusCode 404
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes($fullPath)
  $mime = Get-MimeType -Path $fullPath
  Send-Bytes -Context $Context -Bytes $bytes -ContentType $mime
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "ProbePath running at $prefix"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()

    try {
      if ($context.Request.Url.AbsolutePath.StartsWith('/api/')) {
        Handle-Api -Context $context
      }
      else {
        Handle-Static -Context $context
      }
    }
    catch {
      if ($context.Response.OutputStream.CanWrite) {
        Send-Json -Context $context -Payload @{ error = $_.Exception.Message } -StatusCode 500
      }
    }
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
