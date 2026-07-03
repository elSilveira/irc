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
        "set ""CODEX_IRC_NICK=$Nick"""
        "cd /d ""$repoRoot"""
        """$node"" ""packages\orchestrator\src\codex-bot.js"""
    ) -join " && "

    $redirected = "$command 1>""$logPath"" 2>""$errPath"""
    & cmd.exe /d /c "start ""irc-$Nick"" /min cmd.exe /d /c ""$redirected"""
}

Push-Location $repoRoot
try {
    Start-BotProcess -Nick "codex-agent"
    Start-BotProcess -Nick "BotServ"

    Write-Output "Started codex-agent and BotServ."
}
finally {
    Pop-Location
}
