[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node.exe).Source

function Start-BotProcess {
    param([Parameter(Mandatory = $true)][string]$Nick)

    $logPath = Join-Path $repoRoot "$Nick.log"
    $errPath = Join-Path $repoRoot "$Nick.err.log"
    $command = @(
        "cd /d ""$repoRoot"""
        """$node"" ""packages\orchestrator\src\codex-bot.js"" --nick ""$Nick"""
    ) -join " && "

    $redirected = "$command 1>""$logPath"" 2>""$errPath"""
    & cmd.exe /d /c "start ""irc-$Nick"" /min cmd.exe /d /c ""$redirected"""
}

function Start-ServiceControlLoop {
    $script = Join-Path $repoRoot "scripts\service-control-loop.ps1"
    & cmd.exe /d /c "start ""irc-service-control"" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""$script"""
}

Push-Location $repoRoot
try {
    Start-ServiceControlLoop
    Start-BotProcess -Nick "helper"
    Start-BotProcess -Nick "BotService"

    Write-Output "Started helper, BotService, and service-control loop."
}
finally {
    Pop-Location
}
