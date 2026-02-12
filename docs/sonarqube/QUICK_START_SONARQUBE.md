# SonarQube Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start SonarQube Server

```bash
# Start SonarQube services
docker-compose -f docker-compose.dev.yml up -d sonarqube sonarqube-db

# Wait for SonarQube to be ready (1-2 minutes)
# Check status: http://localhost:9000
```

### Step 2: Access SonarQube

1. Open browser: **http://localhost:9000**
2. Login with:
   - Username: `admin`
   - Password: `admin`
3. **Change password** when prompted
4. Create a token:
   - Go to: **My Account** > **Security** > **Generate Tokens**
   - Copy the token

### Step 3: Run Analysis

#### Windows (PowerShell):
```powershell
# Set your token
$env:SONAR_TOKEN = "your-token-here"

# Analyze backend
.\scripts\sonar-analyze-backend.ps1

# Analyze frontend
.\scripts\sonar-analyze-frontend.ps1
```

#### Linux/macOS (Bash):
```bash
# Set your token
export SONAR_TOKEN="your-token-here"

# Analyze backend
./scripts/sonar-analyze-backend.sh

# Analyze frontend
./scripts/sonar-analyze-frontend.sh

# Or analyze everything
./scripts/sonar-analyze-all.sh
```

## 📊 View Results

After analysis completes, view results at:
- **Backend**: http://localhost:9000/dashboard?id=alpha-cv-backend
- **Frontend**: http://localhost:9000/dashboard?id=alpha-cv-frontend

## 🔍 What SonarQube Detects

### Security Issues
- ✅ SQL Injection vulnerabilities
- ✅ XSS (Cross-Site Scripting) risks
- ✅ Authentication/Authorization flaws
- ✅ Hardcoded secrets and credentials
- ✅ Insecure dependencies
- ✅ Cryptographic weaknesses
- ✅ Input validation issues
- ✅ CORS misconfigurations

### Code Quality
- ✅ Code smells and maintainability issues
- ✅ Potential bugs
- ✅ Code duplication
- ✅ Technical debt
- ✅ Test coverage metrics
- ✅ Complexity issues

## 📝 Next Steps

1. **Review Security Hotspots**: Check flagged security-sensitive code
2. **Fix Critical Issues**: Prioritize security vulnerabilities
3. **Set Quality Gates**: Configure quality gates for CI/CD
4. **Regular Analysis**: Run analysis before each commit/PR

For detailed documentation, see: [SONARQUBE_SETUP.md](./SONARQUBE_SETUP.md)
