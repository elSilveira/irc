[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$npm = (Get-Command npm.cmd).Source
$queueDir = Join-Path $repoRoot "data\service-ops"
$logPath = Join-Path $repoRoot "service-ops.log"
$lockStream = $null

function Write-ServiceOpsLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    $line = "[$(Get-Date -Format o)] $Message"
    Add-Content -Path $logPath -Value $line
}

function Invoke-Build {
    Push-Location $repoRoot
    try {
        Write-ServiceOpsLog "Build started"
        $buildLog = Join-Path $repoRoot "service-build.log"
        $buildErr = Join-Path $repoRoot "service-build.err.log"
        & $npm run typecheck 1>$buildLog 2>$buildErr
        if ($LASTEXITCODE -ne 0) {
            throw "npm run typecheck failed with exit $LASTEXITCODE"
        }
        Write-ServiceOpsLog "Build passed"
    }
    finally {
        Pop-Location
    }
}

function Invoke-Restart {
    Write-ServiceOpsLog "Restart requested"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\restart-service.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "restart-service.ps1 failed with exit $LASTEXITCODE"
    }
    Write-ServiceOpsLog "Restart script completed"
}

function Invoke-ServiceRequest {
    param([Parameter(Mandatory = $true)]$Request)

    switch ($Request.action) {
        "build" {
            Invoke-Build
        }
        "restart" {
            Invoke-Restart
        }
        "deploy" {
            Invoke-Build
            Invoke-Restart
        }
        default {
            throw "Unknown service op action: $($Request.action)"
        }
    }
}

New-Item -ItemType Directory -Path $queueDir -Force | Out-Null
try {
    $lockPath = Join-Path $queueDir "service-control-loop.lock"
    $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
}
catch {
    exit 0
}

Write-ServiceOpsLog "Service-control loop started"

try {
    while ($true) {
        $requests = @(Get-ChildItem -Path $queueDir -Filter "*.request.json" -File | Sort-Object LastWriteTimeUtc)
        foreach ($file in $requests) {
            $runningPath = $file.FullName -replace "\.request\.json$", ".running.json"
            $resultPath = $file.FullName -replace "\.request\.json$", ".result.json"
            $request = @{ id = $file.BaseName; action = "unknown" }
            try {
                Move-Item -LiteralPath $file.FullName -Destination $runningPath -ErrorAction Stop
                $request = Get-Content -LiteralPath $runningPath -Raw | ConvertFrom-Json
                Write-ServiceOpsLog "Processing $($request.action) request $($request.id)"
                Invoke-ServiceRequest -Request $request
                @{ id = $request.id; action = $request.action; ok = $true; completedAt = (Get-Date -Format o) } |
                    ConvertTo-Json -Depth 4 |
                    Set-Content -LiteralPath $resultPath
                Remove-Item -LiteralPath $runningPath -Force
            }
            catch {
                Write-ServiceOpsLog "ERROR processing request: $($_.Exception.Message)"
                @{ id = $request.id; action = $request.action; ok = $false; error = $_.Exception.Message; completedAt = (Get-Date -Format o) } |
                    ConvertTo-Json -Depth 4 |
                    Set-Content -LiteralPath $resultPath
                if (Test-Path -LiteralPath $runningPath) {
                    Remove-Item -LiteralPath $runningPath -Force
                }
            }
        }
        Start-Sleep -Milliseconds 1000
    }
}
finally {
    if ($lockStream) {
        $lockStream.Dispose()
    }
}
