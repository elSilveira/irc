[CmdletBinding()]
param(
    [string]$BackupRoot = "backups"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backupDir = Join-Path $repoRoot $BackupRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $backupDir "irc-server-$timestamp.zip"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "irc-server-backup-$timestamp"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    @(
        "config",
        "data",
        "certs"
    ) | ForEach-Object {
        $source = Join-Path $repoRoot $_
        $destination = Join-Path $tempRoot $_

        if (Test-Path $source) {
            Copy-Item -Path $source -Destination $destination -Recurse -Force
        }
    }

    @"
IRC server backup
Created: $(Get-Date -Format o)
Includes directories when present: config, data, certs.
"@ | Set-Content -Path (Join-Path $tempRoot "BACKUP-MANIFEST.txt") -Encoding UTF8

    Compress-Archive -Path (Join-Path $tempRoot "*") -DestinationPath $archivePath -Force
    Write-Output "Created backup: $archivePath"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Path $tempRoot -Recurse -Force
    }
}
