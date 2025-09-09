# CV Analyzer - Correct Access URLs

## ✅ CORRECT ACCESS URL

**Always use:** `http://13.62.91.25/` (port 80)

This URL provides:
- ✅ Full frontend functionality  
- ✅ Working API endpoints
- ✅ File upload capability
- ✅ All system features

## ❌ INCORRECT ACCESS URLs

**Do NOT use:** `http://13.62.91.25:3000/` (port 3000)

This URL will cause:
- ❌ 500 Internal Server Error on uploads
- ❌ API endpoints not found (404)
- ❌ Broken functionality

## 🔧 Why This Happens

- **Port 80**: Nginx proxy routes frontend requests to Next.js and API requests to FastAPI
- **Port 3000**: Direct Next.js access without backend routing

## 🚀 Quick Fix for Users

If you're getting upload errors:
1. Check your browser URL
2. If it shows `:3000`, remove the `:3000` part
3. Use `http://13.62.91.25/` instead

## 📋 System Architecture

```
User Browser → http://13.62.91.25/ → Nginx (Port 80) → {
  Frontend requests → Next.js (Port 3000)
  API requests → FastAPI (Port 8000)
}
```

Direct port access bypasses this routing.
