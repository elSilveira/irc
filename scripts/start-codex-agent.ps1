[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node.exe).Source

function Start-BotProcess {
    param([Parameter(Mandatory = $true)][string]$Nick)

    $oldNick = $env:CODEX_IRC_NICK
    $logPath = Join-Path $repoRoot "$Nick.log"
    $errPath = Join-Path $repoRoot "$Nick.err.log"

    try {
        $env:CODEX_IRC_NICK = $Nick
        Start-Process `
            -FilePath $node `
            -ArgumentList @("packages\orchestrator\src\codex-bot.js") `
            -WorkingDirectory $repoRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $logPath `
            -RedirectStandardError $errPath
    }
    finally {
        $env:CODEX_IRC_NICK = $oldNick
    }
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
