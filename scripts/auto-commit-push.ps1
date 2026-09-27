<#
.SYNOPSIS
    Automated Git Commit & Push script that runs on a recurring interval.
.DESCRIPTION
    Monitors the repository for changes. When changes are detected, it stages all modified/new files,
    creates a timestamped commit, and pushes to the configured remote and branch.
    Runs every 15 minutes by default.
.PARAMETER IntervalMinutes
    Interval between checks in minutes (default: 15).
.PARAMETER Remote
    The git remote to push to (default: 'origin').
.PARAMETER Branch
    The git branch to push to (default: auto-detected current branch).
.PARAMETER Prefix
    Commit message prefix (default: 'Auto-commit').
.PARAMETER RunOnce
    If specified, performs a single check/commit/push and exits.
#>

param(
    [int]$IntervalMinutes = 15,
    [string]$Remote = "origin",
    [string]$Branch = "",
    [string]$Prefix = "Auto-commit",
    [switch]$RunOnce
)

$ErrorActionPreference = "Continue"

# Resolve git repository root
try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null)
    if (-not $repoRoot) {
        Write-Host "[ERROR] Current directory is not inside a Git repository." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Git is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

Set-Location $repoRoot

function Get-CurrentBranch {
    $b = (git rev-parse --abbrev-ref HEAD 2>$null)
    if (-not $b -or $b -eq "HEAD") {
        return "main"
    }
    return $b.Trim()
}

$targetBranch = if ($Branch) { $Branch } else { Get-CurrentBranch }
$sleepSeconds = [Math]::Max(10, $IntervalMinutes * 60)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GIT AUTO-COMMIT & PUSH WATCHER" -ForegroundColor Cyan
Write-Host "   Repository : $repoRoot" -ForegroundColor Gray
Write-Host "   Remote     : $Remote" -ForegroundColor Gray
Write-Host "   Branch     : $targetBranch" -ForegroundColor Gray
Write-Host "   Interval   : $IntervalMinutes minutes ($sleepSeconds seconds)" -ForegroundColor Gray
Write-Host "   Press Ctrl+C at any time to stop" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

function Invoke-GitCycle {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $status = git status --porcelain
    
    if (-not $status) {
        Write-Host "[$now] Working tree clean. No changes detected." -ForegroundColor DarkGray
        return
    }

    $changedFiles = ($status | Measure-Object).Count
    Write-Host "[$now] Changes detected ($changedFiles item(s)). Staging changes..." -ForegroundColor Green
    
    git add -A
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[$now] [WARNING] git add failed with exit code $LASTEXITCODE" -ForegroundColor Yellow
        return
    }

    $commitMessage = "$($Prefix): $now ($changedFiles file(s) updated)"
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[$now] [WARNING] git commit failed or nothing to commit." -ForegroundColor Yellow
        return
    }
    Write-Host "[$now] Committed: $commitMessage" -ForegroundColor Cyan

    $activeBranch = if ($Branch) { $Branch } else { Get-CurrentBranch }
    Write-Host "[$now] Pushing to $Remote/$activeBranch..." -ForegroundColor Green
    
    git push $Remote $activeBranch
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$now] Push succeeded!" -ForegroundColor Green
    } else {
        Write-Host "[$now] [WARNING] Push failed with exit code $LASTEXITCODE. Will retry next cycle." -ForegroundColor Yellow
    }
}

# Main Execution Loop
do {
    Invoke-GitCycle

    if ($RunOnce) {
        Write-Host "Completed single run." -ForegroundColor Green
        break
    }

    $nextRun = (Get-Date).AddSeconds($sleepSeconds).ToString("HH:mm:ss")
    Write-Host "Sleeping for $IntervalMinutes minutes (Next check at $nextRun)..." -ForegroundColor DarkGray
    Write-Host ""
    
    Start-Sleep -Seconds $sleepSeconds
} while ($true)
