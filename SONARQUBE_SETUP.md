# SonarQube Setup & Usage Guide

## Overview

SonarQube is integrated into the Alpha CV Analyzer project to provide comprehensive code quality and security analysis. It detects:

- **Security Vulnerabilities**: SQL injection, XSS, authentication issues, etc.
- **Code Smells**: Code quality issues, maintainability problems
- **Bugs**: Potential runtime errors and logic issues
- **Code Coverage**: Test coverage metrics
- **Technical Debt**: Areas that need refactoring
- **Code Duplication**: Duplicated code blocks

---

## Quick Start

### 1. Start SonarQube Server

```bash
# Start SonarQube services
docker-compose -f docker-compose.dev.yml up -d sonarqube sonarqube-db

# Or use the setup script
./scripts/sonar-setup.sh
```

### 2. Access SonarQube Web Interface

Open your browser and navigate to:
```
http://localhost:9000
```

**Default Credentials:**
- Username: `admin`
- Password: `admin`

⚠️ **IMPORTANT**: Change the default password on first login!

### 3. Create Authentication Token

1. Login to SonarQube
2. Go to: **My Account** > **Security** > **Generate Tokens**
3. Create a token (e.g., `alpha-cv-token`)
4. Copy the token and set it as an environment variable:

```bash
export SONAR_TOKEN=your-token-here
```

### 4. Run Analysis

#### Analyze Backend (Python/FastAPI)
```bash
./scripts/sonar-analyze-backend.sh
```

#### Analyze Frontend (Next.js/TypeScript)
```bash
./scripts/sonar-analyze-frontend.sh
```

#### Analyze Entire Project
```bash
./scripts/sonar-analyze-all.sh
```

---

## Manual Analysis

If you prefer to run analysis manually:

### Backend Analysis

```bash
cd alpha-backend
sonar-scanner \
  -Dsonar.projectKey=alpha-cv-backend \
  -Dsonar.sources=app \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=your-token-here
```

### Frontend Analysis

```bash
cd cv-analyzer-frontend
sonar-scanner \
  -Dsonar.projectKey=alpha-cv-frontend \
  -Dsonar.sources=src \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=your-token-here
```

---

## Installing Sonar Scanner

### Linux/macOS

#### Option 1: Using Docker (Recommended)
```bash
# No installation needed - use Docker
docker run --rm -v $(pwd):/usr/src -w /usr/src sonarsource/sonar-scanner-cli
```

#### Option 2: Manual Installation

**macOS (Homebrew):**
```bash
brew install sonar-scanner
```

**Linux:**
```bash
# Download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip
unzip sonar-scanner-cli-*.zip
sudo mv sonar-scanner-* /opt/sonar-scanner
export PATH=$PATH:/opt/sonar-scanner/bin
```

### Windows

1. Download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
2. Extract to `C:\sonar-scanner`
3. Add `C:\sonar-scanner\bin` to your PATH
4. Restart your terminal

---

## Configuration Files

### Root Configuration
- `sonar-project.properties` - Root project configuration

### Backend Configuration
- `alpha-backend/sonar-project.properties` - Python/FastAPI specific settings

### Frontend Configuration
- `cv-analyzer-frontend/sonar-project.properties` - TypeScript/JavaScript specific settings

---

## Viewing Results

After running analysis, view results at:

- **Backend Dashboard**: http://localhost:9000/dashboard?id=alpha-cv-backend
- **Frontend Dashboard**: http://localhost:9000/dashboard?id=alpha-cv-frontend

---

## Key Metrics Tracked

### Security
- **Vulnerabilities**: Critical security issues (SQL injection, XSS, etc.)
- **Security Hotspots**: Security-sensitive code that needs review
- **OWASP Top 10**: Coverage of OWASP security standards

### Code Quality
- **Code Smells**: Maintainability issues
- **Bugs**: Potential runtime errors
- **Technical Debt**: Time to fix all issues
- **Code Duplication**: Percentage of duplicated code

### Coverage
- **Line Coverage**: Percentage of lines covered by tests
- **Branch Coverage**: Percentage of branches covered
- **Condition Coverage**: Percentage of conditions covered

---

## Common Security Issues Detected

SonarQube will detect and flag:

1. **SQL Injection**: Unsafe database queries
2. **XSS (Cross-Site Scripting)**: Unescaped user input
3. **Authentication Issues**: Weak passwords, missing authentication
4. **Sensitive Data Exposure**: Hardcoded secrets, API keys
5. **Insecure Dependencies**: Vulnerable third-party libraries
6. **Cryptographic Issues**: Weak encryption, deprecated algorithms
7. **Input Validation**: Missing or weak input validation
8. **Error Handling**: Information leakage in error messages
9. **CORS Misconfiguration**: Overly permissive CORS settings
10. **Rate Limiting**: Missing rate limiting on sensitive endpoints

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: SonarQube Analysis

on:
  push:
    branches: [ main, Syed-dev ]
  pull_request:
    branches: [ main ]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: SonarQube Scan
        uses: sonarsource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

---

## Troubleshooting

### SonarQube Server Not Starting

```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs sonarqube

# Check if port 9000 is already in use
netstat -an | grep 9000

# Restart services
docker-compose -f docker-compose.dev.yml restart sonarqube sonarqube-db
```

### Scanner Not Found

```bash
# Use Docker-based scanner instead
docker run --rm -v $(pwd):/usr/src -w /usr/src sonarsource/sonar-scanner-cli \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=your-token
```

### Analysis Fails

1. Check SonarQube server is running: `curl http://localhost:9000/api/system/status`
2. Verify token is correct: `echo $SONAR_TOKEN`
3. Check project key doesn't conflict with existing projects
4. Review logs: `docker-compose -f docker-compose.dev.yml logs sonarqube`

---

## Best Practices

1. **Run Analysis Regularly**: Integrate into your development workflow
2. **Fix Critical Issues First**: Prioritize security vulnerabilities and bugs
3. **Set Quality Gates**: Configure quality gates to fail builds on critical issues
4. **Review Security Hotspots**: Manually review security-sensitive code
5. **Track Technical Debt**: Monitor and reduce technical debt over time
6. **Maintain Coverage**: Aim for >80% code coverage

---

## Resources

- [SonarQube Documentation](https://docs.sonarqube.org/)
- [SonarQube Rules](https://rules.sonarsource.com/)
- [Security Standards](https://www.sonarsource.com/products/codeanalysis/security-standards/)
- [Quality Gates](https://docs.sonarqube.org/latest/user-guide/quality-gates/)

---

## Support

For issues or questions:
1. Check SonarQube logs: `docker-compose -f docker-compose.dev.yml logs sonarqube`
2. Review SonarQube documentation
3. Check project configuration files

---

**Last Updated**: 2026-02-09
