# SonarQube Analysis Script for TypeScript/JavaScript Frontend (PowerShell)
# This script runs SonarQube analysis on the frontend codebase

$ErrorActionPreference = "Stop"

Write-Host "🔍 Starting SonarQube analysis for TypeScript/JavaScript Frontend..." -ForegroundColor Cyan

# Check if SonarQube is running
try {
    $status = Invoke-RestMethod -Uri "http://localhost:9000/api/system/status" -Method Get
    if ($status.status -ne "UP") {
        Write-Host "❌ SonarQube server is not running. Please start it first:" -ForegroundColor Red
        Write-Host "   docker-compose -f docker-compose.dev.yml up -d sonarqube" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ SonarQube server is not accessible. Please start it first:" -ForegroundColor Red
    Write-Host "   docker-compose -f docker-compose.dev.yml up -d sonarqube" -ForegroundColor Yellow
    exit 1
}

# Navigate to frontend directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$frontendDir = Join-Path $projectRoot "cv-analyzer-frontend"

if (-not (Test-Path $frontendDir)) {
    Write-Host "❌ Frontend directory not found: $frontendDir" -ForegroundColor Red
    exit 1
}

Set-Location $frontendDir

# Check if sonar-scanner is available (try Docker first)
$scannerCmd = $null

# Try Docker-based scanner
try {
    $null = docker run --rm sonarsource/sonar-scanner-cli --version 2>&1
    $scannerCmd = "docker run --rm -v ${PWD}:/usr/src -w /usr/src sonarsource/sonar-scanner-cli"
    Write-Host "✅ Using Docker-based sonar-scanner" -ForegroundColor Green
} catch {
    # Try local installation
    if (Get-Command sonar-scanner -ErrorAction SilentlyContinue) {
        $scannerCmd = "sonar-scanner"
        Write-Host "✅ Using local sonar-scanner" -ForegroundColor Green
    } else {
        Write-Host "❌ sonar-scanner not found. Please install it:" -ForegroundColor Red
        Write-Host "   Download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/" -ForegroundColor Yellow
        Write-Host "   Or use Docker (recommended)" -ForegroundColor Yellow
        exit 1
    }
}

# Set SonarQube server URL
$sonarHostUrl = if ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL } else { "http://localhost:9000" }
$sonarToken = $env:SONAR_TOKEN

# Build scanner command
$scannerArgs = @(
    "-Dsonar.projectKey=alpha-cv-frontend",
    "-Dsonar.sources=src",
    "-Dsonar.host.url=$sonarHostUrl",
    "-Dsonar.sourceEncoding=UTF-8",
    "-Dsonar.typescript.tsconfigPath=tsconfig.json"
)

if ($sonarToken) {
    $scannerArgs += "-Dsonar.token=$sonarToken"
} else {
    Write-Host "⚠️  No SONAR_TOKEN provided. Using default admin credentials." -ForegroundColor Yellow
    Write-Host "   For production, create a token at: $sonarHostUrl/account/security" -ForegroundColor Yellow
    $scannerArgs += "-Dsonar.login=admin"
    $scannerArgs += "-Dsonar.password=admin"
}

# Run SonarQube analysis
Write-Host "🚀 Running SonarQube scanner..." -ForegroundColor Cyan

if ($scannerCmd -like "docker*") {
    $dockerArgs = @(
        "run", "--rm",
        "-v", "${PWD}:/usr/src",
        "-w", "/usr/src",
        "sonarsource/sonar-scanner-cli"
    ) + $scannerArgs
    & docker $dockerArgs
} else {
    & sonar-scanner $scannerArgs
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SonarQube analysis complete!" -ForegroundColor Green
    Write-Host "📊 View results at: $sonarHostUrl/dashboard?id=alpha-cv-frontend" -ForegroundColor Cyan
} else {
    Write-Host "❌ SonarQube analysis failed!" -ForegroundColor Red
    exit 1
}
