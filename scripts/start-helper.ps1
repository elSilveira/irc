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

Push-Location $repoRoot
try {
    Start-BotProcess -Nick "helper"
    Start-BotProcess -Nick "BotService"

    Write-Output "Started helper and BotService."
}
finally {
    Pop-Location
}
