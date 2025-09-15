"""Production-Grade Rate Limiting System
=====================================

Features:
- Dynamic rate limits based on endpoint types
- IP-based tracking with ALB support
- Circuit breaker for system protection
- Redis-like sliding window algorithm
- Comprehensive logging and metrics
- Environment-based configuration
- Graceful degradation under load
"""
import os
import time
import logging
import asyncio
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from collections import defaultdict, deque
from datetime import datetime, timedelta
from app.config.rate_limiter import config

logger = logging.getLogger(__name__)

@dataclass
class RateLimit:
    """Rate limit configuration"""
    requests_per_hour: int
    concurrent_limit: int
    burst_allowance: int = 5  # Allow burst of requests
    priority: int = 1  # Higher priority = more lenient

class ProductionRateLimiter:
    """
    Production-grade rate limiter with:
    - Sliding window algorithm
    - Circuit breaker pattern
    - IP reputation tracking
    - Dynamic scaling based on system load
    """
    
    def __init__(self):
        # Load configuration
        self.config = config
        self.is_production = self.config.IS_PRODUCTION
        self.debug_mode = self.config.DEBUG_MODE
        
        # Core tracking structures
        self.ip_requests: Dict[str, deque] = defaultdict(deque)
        self.ip_concurrent: Dict[str, int] = defaultdict(int)
        self.ip_reputation: Dict[str, float] = defaultdict(lambda: 1.0)  # 1.0 = good, 0.1 = bad
        
        # System-wide limits
        self.global_concurrent = 0
        self.max_global_concurrent = self.config.MAX_GLOBAL_CONCURRENT
        
        # Circuit breaker state
        self.circuit_breaker_trips = 0
        self.last_circuit_trip = 0
        self.circuit_recovery_time = self.config.CIRCUIT_BREAKER_RECOVERY_TIME
        
        # Rate limit configurations by endpoint type
        self.rate_limits = self._load_rate_limits()
        
        # Performance monitoring
        self.request_count = 0
        self.rejection_count = 0
        self.last_cleanup = time.time()
        
        # Validate configuration
        validation = self.config.validate_config()
        if not validation["is_valid"]:
            logger.error(f"❌ Rate limiter configuration issues: {validation['issues']}")
        if validation["warnings"]:
            logger.warning(f"⚠️ Rate limiter configuration warnings: {validation['warnings']}")
        
        logger.info(f"🛡️ Production Rate Limiter initialized - Environment: {validation['environment']} - Max Global: {self.max_global_concurrent}")
    
    def _load_rate_limits(self) -> Dict[str, RateLimit]:
        """Load rate limits from configuration"""
        rate_configs = self.config.get_rate_limits()
        
        rate_limits = {}
        for endpoint, config_data in rate_configs.items():
            rate_limits[endpoint] = RateLimit(
                requests_per_hour=config_data["requests_per_hour"],
                concurrent_limit=config_data["concurrent_limit"],
                burst_allowance=config_data["burst_allowance"],
                priority=config_data["priority"]
            )
        
        return rate_limits
    
    def get_client_ip(self, request: Request) -> str:
        """Extract real client IP considering ALB/proxy headers"""
        # Priority order for IP detection
        ip_headers = [
            "X-Forwarded-For",
            "X-Real-IP", 
            "X-Client-IP",
            "CF-Connecting-IP"  # Cloudflare support
        ]
        
        for header in ip_headers:
            ip_value = request.headers.get(header)
            if ip_value:
                # Handle comma-separated IPs (take the first one)
                client_ip = ip_value.split(",")[0].strip()
                if self._is_valid_ip(client_ip):
                    return client_ip
        
        # Fallback to FastAPI's client IP
        return getattr(request.client, 'host', 'unknown') if request.client else 'unknown'
    
    def _is_valid_ip(self, ip: str) -> bool:
        """Basic IP validation"""
        if not ip or ip == "unknown":
            return False
        parts = ip.split(".")
        if len(parts) != 4:
            return False
        try:
            return all(0 <= int(part) <= 255 for part in parts)
        except ValueError:
            return False
    
    def _classify_endpoint(self, path: str, method: str) -> str:
        """Classify endpoint based on path and method"""
        path_lower = path.lower()
        
        # Health checks (highest priority)
        if any(x in path_lower for x in ["/health", "/status", "/ping"]):
            return "health"
        
        # Authentication endpoints
        if any(x in path_lower for x in ["/auth", "/login", "/logout", "/token"]):
            return "auth"
        
        # Admin endpoints
        if "/admin" in path_lower:
            return "admin"
        
        # File uploads
        if method == "POST" and any(x in path_lower for x in ["/upload", "/file"]):
            return "file_upload"
        
        # Job applications (most critical to protect)
        if "/apply" in path_lower and method == "POST":
            return "job_application"
        
        # Job viewing
        if "/jobs/" in path_lower and method == "GET":
            return "job_view"
        
        # Static assets
        if any(x in path_lower for x in ["/static", "/assets", "/favicon", "/_next"]):
            return "static"
        
        return "general"
    
    def _cleanup_old_requests(self, client_ip: str, window_seconds: int = 3600):
        """Remove requests older than the window"""
        now = time.time()
        cutoff = now - window_seconds
        
        client_requests = self.ip_requests[client_ip]
        while client_requests and client_requests[0] < cutoff:
            client_requests.popleft()
    
    def _update_ip_reputation(self, client_ip: str, behavior: str):
        """Update IP reputation based on behavior"""
        current_reputation = self.ip_reputation[client_ip]
        
        if behavior == "good":
            # Slowly improve reputation
            self.ip_reputation[client_ip] = min(1.0, current_reputation + self.config.REPUTATION_DECAY_RATE)
        elif behavior == "bad":
            # Quickly degrade reputation
            self.ip_reputation[client_ip] = max(self.config.MIN_REPUTATION, current_reputation - self.config.REPUTATION_PENALTY_RATE)
        elif behavior == "suspicious":
            # Moderate degradation
            self.ip_reputation[client_ip] = max(self.config.MIN_REPUTATION * 3, current_reputation - (self.config.REPUTATION_PENALTY_RATE / 2))
    
    def _is_circuit_breaker_open(self) -> bool:
        """Check if circuit breaker is open (system under extreme load)"""
        now = time.time()
        
        # If we've had too many trips recently, open the circuit
        if self.circuit_breaker_trips > self.config.CIRCUIT_BREAKER_THRESHOLD and (now - self.last_circuit_trip) < self.circuit_recovery_time:
            return True
        
        # Reset circuit breaker after recovery time
        if (now - self.last_circuit_trip) > self.circuit_recovery_time:
            self.circuit_breaker_trips = 0
        
        return False
    
    def _trigger_circuit_breaker(self):
        """Trigger circuit breaker due to system overload"""
        self.circuit_breaker_trips += 1
        self.last_circuit_trip = time.time()
        logger.warning(f"🔥 Circuit breaker triggered! Trip #{self.circuit_breaker_trips}")
    
    def is_rate_limited(self, client_ip: str, endpoint: str) -> Tuple[bool, str, int]:
        """
        Check if request should be rate limited
        Returns: (is_limited, reason, retry_after_seconds)
        """
        now = time.time()
        
        # Periodic cleanup to prevent memory bloat
        if now - self.last_cleanup > 300:  # Every 5 minutes
            self._periodic_cleanup()
            self.last_cleanup = now
        
        # Circuit breaker check
        if self._is_circuit_breaker_open():
            return True, "System temporarily unavailable due to high load", 300
        
        # Get rate limit configuration
        rate_limit = self.rate_limits.get(endpoint, self.rate_limits["general"])
        
        # Clean old requests for this IP
        self._cleanup_old_requests(client_ip)
        
        # Apply reputation-based adjustments
        reputation = self.ip_reputation[client_ip]
        adjusted_limit = int(rate_limit.requests_per_hour * reputation)
        adjusted_concurrent = max(1, int(rate_limit.concurrent_limit * reputation))
        
        # Check hourly request limit
        client_requests = self.ip_requests[client_ip]
        if len(client_requests) >= adjusted_limit:
            self._update_ip_reputation(client_ip, "bad")
            return True, f"Hourly limit exceeded: {adjusted_limit} requests/hour", 3600
        
        # Check concurrent request limit
        current_concurrent = self.ip_concurrent[client_ip]
        if current_concurrent >= adjusted_concurrent:
            self._update_ip_reputation(client_ip, "suspicious")
            return True, f"Too many concurrent requests: {adjusted_concurrent} max", 60
        
        # Check global concurrent limit for resource-intensive operations
        if endpoint in ["job_application", "file_upload"]:
            if self.global_concurrent >= self.max_global_concurrent:
                # This might trigger circuit breaker if happening frequently
                if self.global_concurrent > self.max_global_concurrent * 1.5:
                    self._trigger_circuit_breaker()
                return True, f"System busy: {self.max_global_concurrent} operations in progress", 120
        
        # Allow the request
        self._update_ip_reputation(client_ip, "good")
        return False, "", 0
    
    def record_request(self, client_ip: str, endpoint: str):
        """Record a new request"""
        now = time.time()
        
        # Track request timing
        self.ip_requests[client_ip].append(now)
        
        # Track concurrent requests
        self.ip_concurrent[client_ip] += 1
        
        # Track global concurrent for resource-intensive operations
        if endpoint in ["job_application", "file_upload"]:
            self.global_concurrent += 1
            logger.info(f"🔄 Started {endpoint} from {client_ip}. Global concurrent: {self.global_concurrent}/{self.max_global_concurrent}")
        
        # Update metrics
        self.request_count += 1
    
    def finish_request(self, client_ip: str, endpoint: str):
        """Mark request as finished"""
        # Update concurrent counters
        self.ip_concurrent[client_ip] = max(0, self.ip_concurrent[client_ip] - 1)
        
        if endpoint in ["job_application", "file_upload"]:
            self.global_concurrent = max(0, self.global_concurrent - 1)
            logger.info(f"✅ Finished {endpoint} from {client_ip}. Global concurrent: {self.global_concurrent}/{self.max_global_concurrent}")
    
    def _periodic_cleanup(self):
        """Periodic cleanup to prevent memory bloat"""
        now = time.time()
        
        # Clean up old request records
        for client_ip in list(self.ip_requests.keys()):
            self._cleanup_old_requests(client_ip)
            
            # Remove empty deques
            if not self.ip_requests[client_ip]:
                del self.ip_requests[client_ip]
        
        # Clean up reputation for inactive IPs
        active_ips = set(self.ip_requests.keys())
        for ip in list(self.ip_reputation.keys()):
            if ip not in active_ips:
                del self.ip_reputation[ip]
        
        # Reset concurrent counters that might be stuck
        for ip in list(self.ip_concurrent.keys()):
            if self.ip_concurrent[ip] == 0:
                del self.ip_concurrent[ip]
        
        logger.info(f"🧹 Cleanup complete. Tracking {len(self.ip_requests)} active IPs")
    
    def get_stats(self) -> Dict:
        """Get rate limiter statistics for monitoring"""
        return {
            "total_requests": self.request_count,
            "total_rejections": self.rejection_count,
            "active_ips": len(self.ip_requests),
            "global_concurrent": self.global_concurrent,
            "max_global_concurrent": self.max_global_concurrent,
            "circuit_breaker_trips": self.circuit_breaker_trips,
            "average_ip_reputation": sum(self.ip_reputation.values()) / max(1, len(self.ip_reputation))
        }

# Global rate limiter instance
rate_limiter = ProductionRateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    """Production-grade rate limiting middleware"""
    client_ip = rate_limiter.get_client_ip(request)
    path = request.url.path
    method = request.method
    
    # Classify the endpoint
    endpoint = rate_limiter._classify_endpoint(path, method)
    
    # Check if request should be rate limited
    is_limited, reason, retry_after = rate_limiter.is_rate_limited(client_ip, endpoint)
    
    if is_limited:
        rate_limiter.rejection_count += 1
        
        # Log rate limit hit
        logger.warning(f"🚫 Rate limited {client_ip} on {endpoint} ({path}): {reason}")
        
        # Return proper HTTP 429 response
        return JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": reason,
                "retry_after": retry_after,
                "endpoint_type": endpoint,
                "timestamp": datetime.utcnow().isoformat()
            },
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + retry_after)
            }
        )
    
    # Record the request
    rate_limiter.record_request(client_ip, endpoint)
    
    try:
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to successful responses
        if hasattr(response, 'headers'):
            response.headers["X-RateLimit-Limit"] = str(rate_limiter.rate_limits[endpoint].requests_per_hour)
            current_requests = len(rate_limiter.ip_requests[client_ip])
            remaining = max(0, rate_limiter.rate_limits[endpoint].requests_per_hour - current_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Error processing request from {client_ip}: {str(e)}")
        raise
    finally:
        # Always clean up request tracking
        rate_limiter.finish_request(client_ip, endpoint)

def get_rate_limiter():
    """Get the global rate limiter instance for monitoring/stats"""
    return rate_limiter