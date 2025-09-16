"""
Rate Limiter Configuration
=========================

Production-ready configuration for the rate limiting system
"""
import os
from typing import Dict, Any

class RateLimiterConfig:
    """Centralized configuration for rate limiting"""
    
    # Environment settings
    IS_PRODUCTION = os.getenv("NODE_ENV", "development") == "production"
    DEBUG_MODE = os.getenv("RATE_LIMIT_DEBUG", "false").lower() == "true"
    
    # INCREASED GLOBAL LIMITS for heavy usage
    MAX_GLOBAL_CONCURRENT = int(os.getenv("MAX_GLOBAL_CONCURRENT", "100"))  # Was 30
    CIRCUIT_BREAKER_THRESHOLD = int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", "10"))  # Was 5
    CIRCUIT_BREAKER_RECOVERY_TIME = int(os.getenv("CIRCUIT_BREAKER_RECOVERY_TIME", "120"))  # Faster recovery
    
    # Cleanup and maintenance
    CLEANUP_INTERVAL = int(os.getenv("CLEANUP_INTERVAL", "300"))  # 5 minutes
    MEMORY_CLEANUP_THRESHOLD = int(os.getenv("MEMORY_CLEANUP_THRESHOLD", "10000"))  # Clean when tracking 10k+ IPs
    
    # More forgiving reputation system
    REPUTATION_DECAY_RATE = float(os.getenv("REPUTATION_DECAY_RATE", "0.05"))  # Faster improvement
    REPUTATION_PENALTY_RATE = float(os.getenv("REPUTATION_PENALTY_RATE", "0.02"))  # Slower degradation  
    MIN_REPUTATION = float(os.getenv("MIN_REPUTATION", "0.5"))  # Higher minimum
    
    # Performance monitoring
    ENABLE_METRICS = os.getenv("ENABLE_RATE_LIMIT_METRICS", "true").lower() == "true"
    METRICS_RETENTION_HOURS = int(os.getenv("METRICS_RETENTION_HOURS", "24"))
    
    # Proxy and security settings
    TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "true").lower() == "true"
    ALLOWED_PROXY_IPS = os.getenv("ALLOWED_PROXY_IPS", "172.31.0.0/16,10.0.0.0/8").split(",")
    
    # Application-specific settings
    ENABLE_APPLICATION_QUEUE = os.getenv("ENABLE_APPLICATION_QUEUE", "true").lower() == "true"
    MAX_CONCURRENT_APPLICATIONS = int(os.getenv("MAX_CONCURRENT_APPLICATIONS", "5"))
    APPLICATION_TIMEOUT_SECONDS = int(os.getenv("APPLICATION_TIMEOUT_SECONDS", "300"))
    
    @classmethod
    def get_rate_limits(cls) -> Dict[str, Dict[str, Any]]:
        """Get rate limit configurations - GENEROUS VERSION for heavy usage"""
        # More generous base multiplier
        base_multiplier = 5 if not cls.IS_PRODUCTION else 3  # 5x dev, 3x prod
        
        return {
            "health": {
                "requests_per_hour": 5000 * base_multiplier,
                "concurrent_limit": 50,
                "burst_allowance": 100,
                "priority": 10,
                "description": "Health check endpoints"
            },
            "auth": {
                "requests_per_hour": 200 * base_multiplier,
                "concurrent_limit": 20,
                "burst_allowance": 10,
                "priority": 8,
                "description": "Authentication endpoints"
            },
            "admin": {
                "requests_per_hour": 1000 * base_multiplier,
                "concurrent_limit": 25,
                "burst_allowance": 20,
                "priority": 7,
                "description": "Admin panel endpoints"
            },
            "job_view": {
                "requests_per_hour": 1000 * base_multiplier,  # 🔥 HEAVY BROWSING
                "concurrent_limit": 25,
                "burst_allowance": 30,
                "priority": 6,
                "description": "Job listing and viewing"
            },
            "job_application": {
                "requests_per_hour": 500 * base_multiplier,  # 🔥 MANY APPLICATIONS
                "concurrent_limit": 15,
                "burst_allowance": 10,
                "priority": 5,
                "description": "Job applications - heavy usage ready"
            },
            "file_upload": {
                "requests_per_hour": 800 * base_multiplier,  # 🔥 BULK UPLOADS
                "concurrent_limit": 20,
                "burst_allowance": 15,
                "priority": 4,
                "description": "File upload endpoints - bulk friendly"
            },
            "general": {
                "requests_per_hour": 600 * base_multiplier,  # 🔥 INTENSIVE USE
                "concurrent_limit": 20,
                "burst_allowance": 25,
                "priority": 3,
                "description": "General API endpoints - power user ready"
            },
            "static": {
                "requests_per_hour": 2000 * base_multiplier,
                "concurrent_limit": 100,
                "burst_allowance": 200,
                "priority": 1,
                "description": "Static assets"
            }
        }
    
    @classmethod
    def get_alert_thresholds(cls) -> Dict[str, Any]:
        """Get alerting thresholds for monitoring"""
        return {
            "high_rejection_rate": 0.1,  # Alert if > 10% requests are rejected
            "circuit_breaker_trips": 3,  # Alert after 3 circuit breaker trips
            "global_concurrent_warning": cls.MAX_GLOBAL_CONCURRENT * 0.8,  # Warn at 80% capacity
            "memory_usage_warning": cls.MEMORY_CLEANUP_THRESHOLD * 0.8,  # Warn at 80% of cleanup threshold
            "low_reputation_threshold": 0.3,  # Alert if many IPs have low reputation
        }
    
    @classmethod
    def validate_config(cls) -> Dict[str, Any]:
        """Validate configuration and return any issues"""
        issues = []
        warnings = []
        
        # Check critical settings
        if cls.MAX_GLOBAL_CONCURRENT < 5:
            issues.append("MAX_GLOBAL_CONCURRENT too low, minimum recommended: 5")
        
        if cls.CIRCUIT_BREAKER_RECOVERY_TIME < 60:
            warnings.append("CIRCUIT_BREAKER_RECOVERY_TIME is quite short, consider 300+ seconds")
        
        # Check rate limits make sense
        rate_limits = cls.get_rate_limits()
        if rate_limits["job_application"]["requests_per_hour"] > 50:
            warnings.append("Job application rate limit might be too high for production")
        
        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "environment": "production" if cls.IS_PRODUCTION else "development"
        }

# Global configuration instance
config = RateLimiterConfig()
