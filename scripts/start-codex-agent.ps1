[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node.exe).Source
$logPath = Join-Path $repoRoot "codex-agent.log"
$errPath = Join-Path $repoRoot "codex-agent.err.log"

Push-Location $repoRoot
try {
    Start-Process `
        -FilePath $node `
        -ArgumentList @("packages\orchestrator\src\codex-bot.js") `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logPath `
        -RedirectStandardError $errPath

    Write-Output "Started codex-agent. Logs: $logPath"
}
finally {
    Pop-Location
}
