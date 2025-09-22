"""
Smart Load Balancer - Category-Aware Request Routing
Optimizes performance by routing requests based on category and load
"""
import asyncio
import logging
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json

logger = logging.getLogger(__name__)

class RequestType(Enum):
    CV_UPLOAD = "cv_upload"
    JD_UPLOAD = "jd_upload"
    MATCHING = "matching"
    CATEGORY_QUERY = "category_query"
    HEALTH_CHECK = "health_check"

class CategoryType(Enum):
    SOFTWARE_ENGINEERING = "Software Engineering"
    AI_ML_ENGINEERING = "AI/ML Engineering"
    SECURITY_ENGINEERING = "Security Engineering"
    CLOUD_DEVOPS_ENGINEERING = "Cloud/DevOps Engineering"
    DATA_SCIENCE = "Data Science"
    GENERAL = "General"

@dataclass
class LoadMetrics:
    cpu_usage: float
    memory_usage: float
    active_connections: int
    queue_size: int
    response_time_avg: float
    error_rate: float
    last_updated: float

@dataclass
class CategoryMetrics:
    category: CategoryType
    request_count: int
    avg_processing_time: float
    success_rate: float
    queue_size: int
    last_updated: float

class SmartLoadBalancer:
    """
    Intelligent load balancer that routes requests based on:
    1. Category type (Software, AI/ML, Security, etc.)
    2. Current system load
    3. Historical performance metrics
    4. Queue sizes
    """
    
    def __init__(self):
        self.category_weights = {
            CategoryType.SOFTWARE_ENGINEERING: 1.0,
            CategoryType.AI_ML_ENGINEERING: 1.2,  # Higher weight for AI/ML (GPU intensive)
            CategoryType.SECURITY_ENGINEERING: 1.1,
            CategoryType.CLOUD_DEVOPS_ENGINEERING: 1.0,
            CategoryType.DATA_SCIENCE: 1.3,  # Higher weight for Data Science (GPU intensive)
            CategoryType.GENERAL: 0.8
        }
        
        self.request_weights = {
            RequestType.CV_UPLOAD: 2.0,  # Most resource intensive
            RequestType.JD_UPLOAD: 1.5,
            RequestType.MATCHING: 1.0,
            RequestType.CATEGORY_QUERY: 0.3,
            RequestType.HEALTH_CHECK: 0.1
        }
        
        self.load_metrics = LoadMetrics(
            cpu_usage=0.0,
            memory_usage=0.0,
            active_connections=0,
            queue_size=0,
            response_time_avg=0.0,
            error_rate=0.0,
            last_updated=time.time()
        )
        
        self.category_metrics = {
            category: CategoryMetrics(
                category=category,
                request_count=0,
                avg_processing_time=0.0,
                success_rate=1.0,
                queue_size=0,
                last_updated=time.time()
            )
            for category in CategoryType
        }
        
        self.max_concurrent_requests = 10
        self.max_queue_size = 50
        self.health_check_interval = 30  # seconds
        
        logger.info("🎯 SmartLoadBalancer initialized with category-aware routing")

    async def route_request(
        self, 
        request_type: RequestType, 
        category: Optional[CategoryType] = None,
        request_data: Optional[Dict] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Route request based on current load and category.
        Returns: (should_process, routing_decision, metrics)
        """
        try:
            # Update metrics
            await self._update_metrics()
            
            # Check system health
            if not self._is_system_healthy():
                return False, "system_overloaded", self._get_current_metrics()
            
            # Calculate request priority
            priority = self._calculate_priority(request_type, category)
            
            # Check if we can handle this request
            if not self._can_handle_request(priority):
                return False, "queue_full", self._get_current_metrics()
            
            # Determine routing strategy
            routing_decision = self._determine_routing_strategy(request_type, category)
            
            # Update category metrics
            if category:
                self._update_category_metrics(category, request_type)
            
            logger.info(f"🎯 Request routed: {request_type.value} -> {routing_decision}")
            return True, routing_decision, self._get_current_metrics()
            
        except Exception as e:
            logger.error(f"❌ Load balancing error: {e}")
            return False, "error", {"error": str(e)}

    def _calculate_priority(self, request_type: RequestType, category: Optional[CategoryType]) -> float:
        """Calculate request priority based on type and category."""
        base_priority = self.request_weights.get(request_type, 1.0)
        category_multiplier = self.category_weights.get(category, 1.0) if category else 1.0
        
        # Adjust based on current load
        load_factor = 1.0 + (self.load_metrics.cpu_usage * 0.5) + (self.load_metrics.memory_usage * 0.3)
        
        return base_priority * category_multiplier * load_factor

    def _can_handle_request(self, priority: float) -> bool:
        """Check if system can handle the request."""
        # Check concurrent request limit
        if self.load_metrics.active_connections >= self.max_concurrent_requests:
            return False
        
        # Check queue size
        if self.load_metrics.queue_size >= self.max_queue_size:
            return False
        
        # Check system resources
        if self.load_metrics.cpu_usage > 0.9 or self.load_metrics.memory_usage > 0.9:
            return False
        
        # Check error rate
        if self.load_metrics.error_rate > 0.1:  # 10% error rate threshold
            return False
        
        return True

    def _determine_routing_strategy(self, request_type: RequestType, category: Optional[CategoryType]) -> str:
        """Determine the best routing strategy for the request."""
        if request_type == RequestType.CV_UPLOAD:
            if category in [CategoryType.AI_ML_ENGINEERING, CategoryType.DATA_SCIENCE]:
                return "gpu_optimized_processing"
            else:
                return "standard_processing"
        
        elif request_type == RequestType.MATCHING:
            if category:
                return f"category_specific_matching_{category.value.lower().replace('/', '_')}"
            else:
                return "general_matching"
        
        elif request_type == RequestType.CATEGORY_QUERY:
            return "cached_category_lookup"
        
        else:
            return "standard_processing"

    def _is_system_healthy(self) -> bool:
        """Check if system is healthy enough to process requests."""
        return (
            self.load_metrics.cpu_usage < 0.95 and
            self.load_metrics.memory_usage < 0.95 and
            self.load_metrics.error_rate < 0.15 and
            self.load_metrics.response_time_avg < 5.0  # 5 seconds max response time
        )

    async def _update_metrics(self):
        """Update system metrics (simulated - in production, get from monitoring)."""
        # In production, this would fetch real metrics from system monitoring
        current_time = time.time()
        
        # Simulate metric updates
        self.load_metrics.cpu_usage = min(0.8, self.load_metrics.cpu_usage + 0.01)
        self.load_metrics.memory_usage = min(0.85, self.load_metrics.memory_usage + 0.005)
        self.load_metrics.active_connections = min(8, self.load_metrics.active_connections + 1)
        self.load_metrics.last_updated = current_time

    def _update_category_metrics(self, category: CategoryType, request_type: RequestType):
        """Update metrics for specific category."""
        metrics = self.category_metrics[category]
        metrics.request_count += 1
        metrics.last_updated = time.time()
        
        # Update processing time based on request type
        if request_type == RequestType.CV_UPLOAD:
            metrics.avg_processing_time = (metrics.avg_processing_time + 2.5) / 2
        elif request_type == RequestType.MATCHING:
            metrics.avg_processing_time = (metrics.avg_processing_time + 1.0) / 2
        else:
            metrics.avg_processing_time = (metrics.avg_processing_time + 0.5) / 2

    def _get_current_metrics(self) -> Dict:
        """Get current system metrics."""
        return {
            "load_metrics": {
                "cpu_usage": self.load_metrics.cpu_usage,
                "memory_usage": self.load_metrics.memory_usage,
                "active_connections": self.load_metrics.active_connections,
                "queue_size": self.load_metrics.queue_size,
                "response_time_avg": self.load_metrics.response_time_avg,
                "error_rate": self.load_metrics.error_rate
            },
            "category_metrics": {
                category.value: {
                    "request_count": metrics.request_count,
                    "avg_processing_time": metrics.avg_processing_time,
                    "success_rate": metrics.success_rate,
                    "queue_size": metrics.queue_size
                }
                for category, metrics in self.category_metrics.items()
            },
            "timestamp": time.time()
        }

    async def get_system_status(self) -> Dict:
        """Get comprehensive system status."""
        await self._update_metrics()
        
        return {
            "status": "healthy" if self._is_system_healthy() else "degraded",
            "metrics": self._get_current_metrics(),
            "recommendations": self._get_recommendations()
        }

    def _get_recommendations(self) -> List[str]:
        """Get system optimization recommendations."""
        recommendations = []
        
        if self.load_metrics.cpu_usage > 0.8:
            recommendations.append("High CPU usage detected. Consider reducing concurrent requests.")
        
        if self.load_metrics.memory_usage > 0.8:
            recommendations.append("High memory usage detected. Consider clearing caches.")
        
        if self.load_metrics.error_rate > 0.05:
            recommendations.append("Elevated error rate detected. Check system logs.")
        
        if self.load_metrics.response_time_avg > 3.0:
            recommendations.append("Slow response times detected. Consider optimizing queries.")
        
        return recommendations

# Global instance
_smart_load_balancer: Optional[SmartLoadBalancer] = None

def get_smart_load_balancer() -> SmartLoadBalancer:
    """Get global SmartLoadBalancer instance."""
    global _smart_load_balancer
    if _smart_load_balancer is None:
        _smart_load_balancer = SmartLoadBalancer()
    return _smart_load_balancer
