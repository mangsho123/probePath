param(
  [int]$Port = 5050
)

$ErrorActionPreference = 'Stop'

$serverRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$appRoot = (Resolve-Path (Join-Path $serverRoot '..\app')).Path
$reportsRoot = Join-Path (Resolve-Path (Join-Path $serverRoot '..\data')).Path 'reports'
New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null

$utf8 = [System.Text.UTF8Encoding]::new($false)

function Get-MimeType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js' { 'text/javascript; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.svg' { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
}

function Get-ReasonPhrase {
  param([int]$StatusCode)

  switch ($StatusCode) {
    200 { 'OK' }
    201 { 'Created' }
    204 { 'No Content' }
    404 { 'Not Found' }
    405 { 'Method Not Allowed' }
    default { 'Internal Server Error' }
  }
}

function ConvertTo-BodyBytes {
  param($Payload)
  return $utf8.GetBytes(($Payload | ConvertTo-Json -Depth 16))
}

function Write-Response {
  param(
    [Parameter(Mandatory = $true)]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [byte[]]$BodyBytes
  )

  if ($null -eq $BodyBytes) {
    $BodyBytes = [byte[]]::new(0)
  }

  $reason = Get-ReasonPhrase -StatusCode $StatusCode
  $headerText = "HTTP/1.1 $StatusCode $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($BodyBytes.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = $utf8.GetBytes($headerText)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($BodyBytes.Length -gt 0) {
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
  }
  $Stream.Flush()
}

function Read-Request {
  param([Parameter(Mandatory = $true)]$Client)

  $stream = $Client.GetStream()
  $reader = [System.IO.StreamReader]::new($stream, $utf8, $false, 4096, $true)

  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return $null
  }

  $parts = $requestLine.Split(' ')
  $headers = @{}

  while ($true) {
    $line = $reader.ReadLine()
    if ([string]::IsNullOrEmpty($line)) {
      break
    }

    $separatorIndex = $line.IndexOf(':')
    if ($separatorIndex -gt 0) {
      $name = $line.Substring(0, $separatorIndex).Trim().ToLowerInvariant()
      $value = $line.Substring($separatorIndex + 1).Trim()
      $headers[$name] = $value
    }
  }

  $body = ''
  if ($headers.ContainsKey('content-length')) {
    $length = [int]$headers['content-length']
    if ($length -gt 0) {
      $chars = New-Object char[] $length
      [void]$reader.ReadBlock($chars, 0, $length)
      $body = -join $chars
    }
  }

  $uri = [System.Uri]::new("http://localhost$($parts[1])")

  return [pscustomobject]@{
    Method = $parts[0]
    Path = $uri.AbsolutePath
    Target = $parts[1]
    Headers = $headers
    Body = $body
    Stream = $stream
  }
}

function Get-ReportMetadata {
  $items = @()

  foreach ($file in (Get-ChildItem -Path $reportsRoot -Filter '*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 8)) {
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
  param($Request)

  if ($Request.Path -eq '/api/health') {
    return @{
      StatusCode = 200
      ContentType = 'application/json; charset=utf-8'
      Body = (ConvertTo-BodyBytes @{ name = 'ProbePath'; ok = $true; now = [DateTime]::UtcNow.ToString('o') })
    }
  }

  if ($Request.Path -eq '/api/history') {
    $reports = @(Get-ReportMetadata)
    return @{
      StatusCode = 200
      ContentType = 'application/json; charset=utf-8'
      Body = (ConvertTo-BodyBytes @{ reports = $reports })
    }
  }

  if ($Request.Path -eq '/api/reports' -and $Request.Method -eq 'POST') {
    $payload = $Request.Body | ConvertFrom-Json
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
    [System.IO.File]::WriteAllText((Join-Path $reportsRoot "$id.json"), ($record | ConvertTo-Json -Depth 16), $utf8)
    return @{
      StatusCode = 201
      ContentType = 'application/json; charset=utf-8'
      Body = (ConvertTo-BodyBytes @{ id = $id; url = "/report.html?id=$id"; createdAt = $payload.createdAt })
    }
  }

  if ($Request.Path -match '^/api/reports/([a-zA-Z0-9\-]+)$' -and $Request.Method -eq 'GET') {
    $id = $matches[1]
    $filePath = Join-Path $reportsRoot "$id.json"
    if (-not (Test-Path -LiteralPath $filePath)) {
      return @{ StatusCode = 404; ContentType = 'application/json; charset=utf-8'; Body = (ConvertTo-BodyBytes @{ error = 'Report not found.' }) }
    }

    return @{
      StatusCode = 200
      ContentType = 'application/json; charset=utf-8'
      Body = $utf8.GetBytes((Get-Content -Path $filePath -Raw -Encoding UTF8))
    }
  }

  return @{ StatusCode = 404; ContentType = 'application/json; charset=utf-8'; Body = (ConvertTo-BodyBytes @{ error = 'Not found.' }) }
}

function Handle-Static {
  param($Request)

  if ($Request.Path -eq '/favicon.ico') {
    return @{ StatusCode = 204; ContentType = 'text/plain; charset=utf-8'; Body = [byte[]]::new(0) }
  }

  if ($Request.Path -eq '/') {
    $relativePath = 'index.html'
  }
  elseif ($Request.Path -eq '/report' -or $Request.Path -eq '/report/') {
    $relativePath = 'report.html'
  }
  else {
    $relativePath = [System.Uri]::UnescapeDataString($Request.Path.TrimStart('/'))
  }

  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $appRoot $relativePath))
  if (-not $fullPath.StartsWith($appRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return @{ StatusCode = 404; ContentType = 'text/plain; charset=utf-8'; Body = $utf8.GetBytes('Not found.') }
  }

  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    return @{ StatusCode = 404; ContentType = 'text/plain; charset=utf-8'; Body = $utf8.GetBytes('Not found.') }
  }

  return @{
    StatusCode = 200
    ContentType = (Get-MimeType -Path $fullPath)
    Body = [System.IO.File]::ReadAllBytes($fullPath)
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host "ProbePath running at http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $request = Read-Request -Client $client
      if ($null -eq $request) {
        continue
      }

      if ($request.Path.StartsWith('/api/')) {
        $response = Handle-Api -Request $request
      }
      else {
        $response = Handle-Static -Request $request
      }

      Write-Response -Stream $request.Stream -StatusCode $response.StatusCode -ContentType $response.ContentType -BodyBytes $response.Body
    }
    catch {
      $stream = $client.GetStream()
      Write-Response -Stream $stream -StatusCode 500 -ContentType 'application/json; charset=utf-8' -BodyBytes (ConvertTo-BodyBytes @{ error = $_.Exception.Message })
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
