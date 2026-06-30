# Bump version, tag, and push to trigger automated GitHub Release
# Usage: .\scripts\release.ps1 0.3.0

param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$Tag = "v$Version"
$PkgPath = Join-Path $Root "package.json"
$Pkg = Get-Content $PkgPath -Raw | ConvertFrom-Json

if ($Pkg.version -ne $Version) {
    Write-Host "Updating package.json: $($Pkg.version) -> $Version" -ForegroundColor Cyan
    (Get-Content $PkgPath -Raw) -replace '"version":\s*"[^"]+"', "`"version`": `"$Version`"" | Set-Content $PkgPath -NoNewline
    git add package.json
    git commit -m "Bump version to $Version"
}

git tag $Tag
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tag $Tag already exists. Delete with: git tag -d $Tag" -ForegroundColor Yellow
    exit 1
}

Write-Host "Pushing main and tag $Tag..." -ForegroundColor Cyan
git push origin main
git push origin $Tag

Write-Host ""
Write-Host "Release triggered! Track progress at:" -ForegroundColor Green
Write-Host "  https://github.com/Vet-TV/grok-browser/actions" -ForegroundColor Cyan
Write-Host "  https://github.com/Vet-TV/grok-browser/releases/tag/$Tag" -ForegroundColor Cyan