[CmdletBinding()]
param(
    [string]$Domain = "irc.eduardosilveira.dev",
    [string]$LocalIp = "192.168.68.57",
    [int]$Days = 30
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
    $command = @"
mkdir -p /etc/letsencrypt/live/$Domain &&
openssl req -x509 -nodes -newkey rsa:2048 -days $Days \
  -keyout /etc/letsencrypt/live/$Domain/privkey.pem \
  -out /etc/letsencrypt/live/$Domain/fullchain.pem \
  -subj "/CN=$Domain" \
  -addext "subjectAltName=DNS:$Domain,IP:127.0.0.1,IP:$LocalIp"
"@

    docker compose run --rm --entrypoint sh certbot -c $command
    Write-Output "Created local self-signed certificate for $Domain, 127.0.0.1, and $LocalIp."
}
finally {
    Pop-Location
}
