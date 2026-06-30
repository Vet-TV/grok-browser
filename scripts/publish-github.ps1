# Creates the GitHub repo and pushes Grok Browser
# Prerequisites: gh auth login

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run:" -ForegroundColor Yellow
    Write-Host "  gh auth login --hostname github.com --git-protocol https --web" -ForegroundColor Cyan
    exit 1
}

$User = gh api user -q .login
$RepoUrl = "https://github.com/$User/grok-browser"

gh repo view "$User/grok-browser" --json name 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating public repo: $User/grok-browser" -ForegroundColor Cyan
    gh repo create grok-browser `
        --public `
        --description "Open-source Chromium browser with Grok AI baked in - inspired by Perplexity Comet" `
        --source . `
        --remote origin `
        --push

    gh repo edit --add-topic browser,chromium,electron,grok,xai,ai-browser,open-source,perplexity-comet
} else {
    Write-Host "Repo exists, pushing to origin/main..." -ForegroundColor Cyan
    git push -u origin main
}

Write-Host ""
Write-Host "Published: $RepoUrl" -ForegroundColor Green