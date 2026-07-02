[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedArchive = Resolve-Path $ArchivePath -ErrorAction Stop

function Get-RunningComposeServices {
    try {
        $services = & docker compose ps --services --filter "status=running" 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @($services | Where-Object { $_ })
        }
    }
    catch {
        return @()
    }

    return @()
}

$runningServices = Get-RunningComposeServices
if ($runningServices.Count -gt 0 -and -not $Force) {
    $names = $runningServices -join ", "
    throw "Docker Compose services are running ($names). Stop them with 'docker compose down' before restore, or rerun with -Force."
}

Expand-Archive -Path $resolvedArchive -DestinationPath $repoRoot -Force
Write-Output "Restored backup into: $repoRoot"
