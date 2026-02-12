# Test runner script for Alpha CV Analyzer backend (PowerShell)

Write-Host "🧪 Running Alpha CV Analyzer Backend Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pytest is installed
try {
    pytest --version | Out-Null
} catch {
    Write-Host "❌ pytest is not installed. Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Run tests with coverage
Write-Host "📊 Running tests with coverage report..." -ForegroundColor Green
Write-Host ""

pytest `
    --cov=app `
    --cov-report=term-missing `
    --cov-report=html `
    --cov-report=xml `
    --verbose `
    -v

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Coverage report generated:" -ForegroundColor Cyan
    Write-Host "   - Terminal: See above"
    Write-Host "   - HTML: htmlcov/index.html"
    Write-Host "   - XML: coverage.xml"
    Write-Host ""
    Write-Host "🌐 Open htmlcov/index.html in your browser to view detailed coverage" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Some tests failed. Check the output above for details." -ForegroundColor Red
    exit 1
}
