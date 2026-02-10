#!/bin/bash
# Test runner script for Alpha CV Analyzer backend

echo "🧪 Running Alpha CV Analyzer Backend Tests"
echo "=========================================="
echo ""

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest is not installed. Installing dependencies..."
    pip install -r requirements.txt
fi

# Run tests with coverage
echo "📊 Running tests with coverage report..."
echo ""

pytest \
    --cov=app \
    --cov-report=term-missing \
    --cov-report=html \
    --cov-report=xml \
    --verbose \
    -v

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo ""
    echo "📊 Coverage report generated:"
    echo "   - Terminal: See above"
    echo "   - HTML: htmlcov/index.html"
    echo "   - XML: coverage.xml"
    echo ""
    echo "🌐 Open htmlcov/index.html in your browser to view detailed coverage"
else
    echo ""
    echo "❌ Some tests failed. Check the output above for details."
    exit 1
fi
