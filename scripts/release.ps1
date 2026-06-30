# Bump version, tag, and push to trigger automated GitHub Release
# Usage: .\scripts\release.ps1 0.4.2

param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [switch]$Force
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
    $Pkg.version = $Version
}

$HeadVersion = (Get-Content $PkgPath -Raw | ConvertFrom-Json).version
if ($HeadVersion -ne $Version) {
    Write-Error "package.json version ($HeadVersion) must match release version ($Version) before tagging."
}

$ExistingTag = git tag -l $Tag
if ($ExistingTag) {
    if (-not $Force) {
        Write-Host "Tag $Tag already exists. Use -Force to move it to HEAD, or: git tag -d $Tag" -ForegroundColor Yellow
        exit 1
    }
    git tag -d $Tag
}

git tag -a $Tag -m "Release $Tag"
Write-Host "Tagged $Tag at $(git rev-parse --short HEAD)" -ForegroundColor Cyan

Write-Host "Pushing main and tag $Tag..." -ForegroundColor Cyan
git push origin main
if ($Force) {
    git push origin $Tag --force
} else {
    git push origin $Tag
}

Write-Host ""
Write-Host "Release triggered! Track progress at:" -ForegroundColor Green
Write-Host "  https://github.com/Vet-TV/grok-browser/actions" -ForegroundColor Cyan
Write-Host "  https://github.com/Vet-TV/grok-browser/releases/tag/$Tag" -ForegroundColor Cyan