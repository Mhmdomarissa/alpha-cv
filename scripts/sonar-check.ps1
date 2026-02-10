# Quick SonarQube Health Check Script (PowerShell)
# Checks if SonarQube is running and accessible

$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking SonarQube Status..." -ForegroundColor Cyan
Write-Host ""

# Check if SonarQube container is running
Write-Host "📦 Checking Docker containers..." -ForegroundColor Yellow
$sonarqube = docker ps --filter "name=sonarqube" --format "{{.Names}}" 2>$null
$sonarqubeDb = docker ps --filter "name=sonarqube-db" --format "{{.Names}}" 2>$null

if ($sonarqube) {
    Write-Host "   ✅ SonarQube container is running: $sonarqube" -ForegroundColor Green
} else {
    Write-Host "   ❌ SonarQube container is not running" -ForegroundColor Red
    Write-Host "   💡 Start it with: docker-compose -f docker-compose.dev.yml up -d sonarqube" -ForegroundColor Yellow
}

if ($sonarqubeDb) {
    Write-Host "   ✅ SonarQube DB container is running: $sonarqubeDb" -ForegroundColor Green
} else {
    Write-Host "   ❌ SonarQube DB container is not running" -ForegroundColor Red
    Write-Host "   💡 Start it with: docker-compose -f docker-compose.dev.yml up -d sonarqube-db" -ForegroundColor Yellow
}

Write-Host ""

# Check if SonarQube API is accessible
Write-Host "🌐 Checking SonarQube API..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "http://localhost:9000/api/system/status" -Method Get -TimeoutSec 5
    if ($status.status -eq "UP") {
        Write-Host "   ✅ SonarQube API is UP and accessible" -ForegroundColor Green
        Write-Host "   📊 Web Interface: http://localhost:9000" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  SonarQube API status: $($status.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ SonarQube API is not accessible" -ForegroundColor Red
    Write-Host "   💡 Make sure SonarQube is running and wait 1-2 minutes for startup" -ForegroundColor Yellow
}

Write-Host ""

# Check if token is set
Write-Host "🔑 Checking authentication..." -ForegroundColor Yellow
if ($env:SONAR_TOKEN) {
    Write-Host "   ✅ SONAR_TOKEN is set" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  SONAR_TOKEN is not set" -ForegroundColor Yellow
    Write-Host "   💡 Set it with: `$env:SONAR_TOKEN = 'your-token-here'" -ForegroundColor Yellow
    Write-Host "   💡 Or use default admin credentials (admin/admin)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Health check complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
