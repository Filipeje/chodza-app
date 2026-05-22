param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,
    [string]$RepoName = "chodza-app",
    [ValidateSet("public", "private")]
    [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Find-Git {
    $candidates = @(
        "git",
        "${env:ProgramFiles}\Git\bin\git.exe",
        "${env:ProgramFiles(x86)}\Git\bin\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
    )
    foreach ($c in $candidates) {
        if (Get-Command $c -ErrorAction SilentlyContinue) {
            return (Get-Command $c).Source
        }
        if (Test-Path $c) { return $c }
    }
    return $null
}

$git = Find-Git
if (-not $git) {
    Write-Host "Git nie je nainstalovany. Stiahnite ho z https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

Set-Location $root
$remote = "https://github.com/$GitHubUser/$RepoName.git"

if (-not (Test-Path ".git")) {
    & $git init
}

& $git add .
& $git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Prvý commit: prototyp Chôdza app"
}

& $git branch -M main

$remotes = & $git remote 2>$null
if ($remotes -notcontains "origin") {
    & $git remote add origin $remote
} else {
    & $git remote set-url origin $remote
}

Write-Host ""
Write-Host "Dalsi krok:" -ForegroundColor Cyan
Write-Host "1. Na https://github.com/new vytvorte repo: $RepoName ($Visibility)"
Write-Host "2. Potom spustite:"
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "Remote: $remote"
