[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node.exe).Source
$restartLog = Join-Path $repoRoot "restart-service.log"
Set-Content -Path $restartLog -Value "Restart started $(Get-Date -Format o)"

function Write-RestartLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    $line = "[$(Get-Date -Format o)] $Message"
    Add-Content -Path $restartLog -Value $line
    Write-Output $Message
}

function Normalize-CommandLinePath {
    param([Parameter(Mandatory = $true)][string]$Value)

    return $Value -replace "\\", "/"
}

function Stop-ProcessByCommandLine {
    param([Parameter(Mandatory = $true)][string]$PathPattern)

    $escapedPath = [regex]::Escape((Normalize-CommandLinePath -Value $PathPattern))
    $matches = @(
        Get-CimInstance Win32_Process |
            Where-Object {
                if (-not $_.CommandLine) { return $false }
                $commandLine = Normalize-CommandLinePath -Value $_.CommandLine
                return $commandLine -match $escapedPath
            }
    )

    foreach ($process in $matches) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    return $matches.Count
}

function Start-NodeProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Command
    )

    $logPath = Join-Path $repoRoot "$Name.log"
    $errPath = Join-Path $repoRoot "$Name.err.log"
    $redirected = "cd /d `"$repoRoot`" && $Command 1>`"$logPath`" 2>`"$errPath`""
    & cmd.exe /d /c "start `"irc-$Name`" /min cmd.exe /d /c `"$redirected`""
}

function Start-ServiceControlLoop {
    $script = Join-Path $repoRoot "scripts\service-control-loop.ps1"
    & cmd.exe /d /c "start `"irc-service-control`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
}

Push-Location $repoRoot
try {
    $dockerOk = $true
    try {
        Write-RestartLog "Docker down"
        docker compose down --remove-orphans
        Write-RestartLog "Docker up"
        docker compose up -d --build
    }
    catch {
        $dockerOk = $false
        Write-RestartLog "WARN docker restart failed: $($_.Exception.Message)"
    }

    Write-RestartLog "Stopping Node control-plane processes"
    $stopped = 0
    $stopped += Stop-ProcessByCommandLine -PathPattern "packages/orchestrator/src/codex-bot.js"
    $stopped += Stop-ProcessByCommandLine -PathPattern "apps/orchestrator/src/index.ts"
    Write-RestartLog "Stopped $stopped Node control-plane process(es)"

    Write-RestartLog "Starting service-control loop"
    Start-ServiceControlLoop
    Write-RestartLog "Starting helper"
    Start-NodeProcess -Name "helper" -Command "`"$node`" `"packages\orchestrator\src\codex-bot.js`" --nick `"helper`""
    Write-RestartLog "Starting BotService"
    Start-NodeProcess -Name "BotService" -Command "`"$node`" `"packages\orchestrator\src\codex-bot.js`" --nick `"BotService`""
    Write-RestartLog "Starting orchestrator"
    Start-NodeProcess -Name "orchestrator-runtime" -Command "`"$node`" --no-warnings --import tsx `"apps\orchestrator\src\index.ts`""

    if ($dockerOk) {
        Write-RestartLog "Restart completed with Docker and Node control-plane services."
    }
    else {
        Write-RestartLog "Restart completed for Node control-plane services; Docker restart needs elevated access."
    }
}
finally {
    Pop-Location
}
