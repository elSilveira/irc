[CmdletBinding()]
param(
    [string]$Domain = "irc.eduardosilveira.dev"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$certPath = Join-Path $repoRoot "certs\letsencrypt\live\$Domain\fullchain.pem"

if (-not (Test-Path $certPath)) {
    throw "Certificate not found: $certPath. Run scripts\dev-cert.ps1 first."
}

$result = Import-Certificate `
    -FilePath $certPath `
    -CertStoreLocation "Cert:\CurrentUser\Root"

Write-Output "Trusted local dev certificate in Cert:\CurrentUser\Root."
Write-Output "Subject: $($result.Subject)"
