"""
API Usage Analytics Middleware
Tracks endpoint usage, response times, and data volumes without affecting performance.
"""

import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class APIAnalyticsMiddleware(BaseHTTPMiddleware):
    """
    Lightweight middleware to track API usage patterns and performance.
    Helps identify truly unused endpoints and performance bottlenecks.
    """
    
    def __init__(self, app, max_records: int = 10000):
        super().__init__(app)
        self.max_records = max_records
        
        # Thread-safe counters (using defaultdict for simplicity)
        self.endpoint_stats = defaultdict(lambda: {
            "call_count": 0,
            "total_response_time": 0.0,
            "total_response_size": 0,
            "last_called": None,
            "error_count": 0,
            "recent_calls": deque(maxlen=100)  # Keep last 100 calls per endpoint
        })
        
        # Overall API stats
        self.total_requests = 0
        self.start_time = time.time()
    
    async def dispatch(self, request: Request, call_next):
        """Track API calls without impacting performance"""
        start_time = time.time()
        endpoint_key = f"{request.method} {request.url.path}"
        
        # Call the actual endpoint
        response = await call_next(request)
        
        # Calculate metrics
        response_time = time.time() - start_time
        response_size = int(response.headers.get("content-length", 0))
        
        # Update stats (async-safe)
        try:
            self._update_stats(endpoint_key, response_time, response_size, response.status_code)
        except Exception as e:
            # Never let analytics break the actual API
            logger.warning(f"Analytics update failed: {e}")
        
        return response
    
    def _update_stats(self, endpoint: str, response_time: float, response_size: int, status_code: int):
        """Update endpoint statistics"""
        stats = self.endpoint_stats[endpoint]
        
        # Basic counters
        stats["call_count"] += 1
        stats["total_response_time"] += response_time
        stats["total_response_size"] += response_size
        stats["last_called"] = datetime.utcnow().isoformat()
        
        if status_code >= 400:
            stats["error_count"] += 1
        
        # Recent calls for trend analysis
        stats["recent_calls"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "response_time": response_time,
            "status_code": status_code,
            "response_size": response_size
        })
        
        # Global counter
        self.total_requests += 1
    
    def get_analytics_summary(self) -> Dict[str, Any]:
        """Get comprehensive analytics summary"""
        now = time.time()
        uptime_hours = (now - self.start_time) / 3600
        
        # Calculate endpoint analytics
        endpoint_analytics = {}
        for endpoint, stats in self.endpoint_stats.items():
            avg_response_time = stats["total_response_time"] / max(stats["call_count"], 1)
            avg_response_size = stats["total_response_size"] / max(stats["call_count"], 1)
            error_rate = (stats["error_count"] / max(stats["call_count"], 1)) * 100
            
            endpoint_analytics[endpoint] = {
                "call_count": stats["call_count"],
                "avg_response_time_ms": round(avg_response_time * 1000, 2),
                "avg_response_size_kb": round(avg_response_size / 1024, 2),
                "error_rate_percent": round(error_rate, 2),
                "last_called": stats["last_called"],
                "calls_per_hour": round(stats["call_count"] / max(uptime_hours, 0.1), 2)
            }
        
        # Identify unused endpoints (not called in last hour)
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        unused_endpoints = []
        rarely_used_endpoints = []
        
        for endpoint, stats in self.endpoint_stats.items():
            if stats["last_called"]:
                last_call = datetime.fromisoformat(stats["last_called"])
                if last_call < one_hour_ago:
                    if stats["call_count"] < 5:  # Very rarely used
                        rarely_used_endpoints.append(endpoint)
                    elif last_call < datetime.utcnow() - timedelta(days=1):
                        unused_endpoints.append(endpoint)
        
        # Top endpoints by usage
        sorted_endpoints = sorted(
            self.endpoint_stats.items(), 
            key=lambda x: x[1]["call_count"], 
            reverse=True
        )
        top_endpoints = [
            {"endpoint": k, "calls": v["call_count"]} 
            for k, v in sorted_endpoints[:10]
        ]
        
        return {
            "summary": {
                "total_requests": self.total_requests,
                "unique_endpoints_hit": len(self.endpoint_stats),
                "uptime_hours": round(uptime_hours, 2),
                "requests_per_hour": round(self.total_requests / max(uptime_hours, 0.1), 2)
            },
            "endpoint_analytics": endpoint_analytics,
            "usage_insights": {
                "top_10_endpoints": top_endpoints,
                "unused_endpoints": unused_endpoints,
                "rarely_used_endpoints": rarely_used_endpoints
            },
            "performance_insights": {
                "slowest_endpoints": [
                    {
                        "endpoint": k, 
                        "avg_response_time_ms": round((v["total_response_time"] / max(v["call_count"], 1)) * 1000, 2)
                    }
                    for k, v in sorted(
                        self.endpoint_stats.items(), 
                        key=lambda x: x[1]["total_response_time"] / max(x[1]["call_count"], 1), 
                        reverse=True
                    )[:5]
                ],
                "largest_responses": [
                    {
                        "endpoint": k,
                        "avg_size_kb": round((v["total_response_size"] / max(v["call_count"], 1)) / 1024, 2)
                    }
                    for k, v in sorted(
                        self.endpoint_stats.items(),
                        key=lambda x: x[1]["total_response_size"] / max(x[1]["call_count"], 1),
                        reverse=True
                    )[:5]
                ]
            },
            "generated_at": datetime.utcnow().isoformat()
        }

# Global analytics instance
_analytics_middleware = None

def get_analytics_middleware() -> APIAnalyticsMiddleware:
    """Get the global analytics middleware instance"""
    global _analytics_middleware
    if _analytics_middleware is None:
        # Create a default instance if not initialized
        _analytics_middleware = APIAnalyticsMiddleware(None)
    return _analytics_middleware

def set_analytics_middleware(middleware: APIAnalyticsMiddleware):
    """Set the global analytics middleware instance"""
    global _analytics_middleware
    _analytics_middleware = middleware
