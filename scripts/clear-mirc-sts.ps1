[CmdletBinding()]
param(
    [string]$MircDir = (Join-Path $env:APPDATA "mIRC")
)

$ErrorActionPreference = "Stop"

$serversPath = Join-Path $MircDir "servers.ini"
if (-not (Test-Path $serversPath)) {
    throw "mIRC servers.ini not found: $serversPath"
}

$backupPath = "$serversPath.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $serversPath -Destination $backupPath

$lines = Get-Content -LiteralPath $serversPath
$output = New-Object System.Collections.Generic.List[string]
$inSts = $false
$removed = 0

foreach ($line in $lines) {
    if ($line -match '^\[sts\]$') {
        $inSts = $true
        $output.Add($line)
        continue
    }

    if ($inSts -and $line -match '^\[') {
        $inSts = $false
    }

    if ($inSts -and $line -match '127\.0\.0\.1') {
        $removed++
        continue
    }

    $output.Add($line)
}

Set-Content -LiteralPath $serversPath -Value $output -Encoding ASCII
Write-Output "Backed up mIRC servers.ini to $backupPath"
Write-Output "Removed $removed STS entr$(if ($removed -eq 1) { 'y' } else { 'ies' }) for 127.0.0.1"
