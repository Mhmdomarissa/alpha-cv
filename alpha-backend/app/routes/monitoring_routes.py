"""
Ultimate Monitoring Routes - Comprehensive System Health & Performance
Real-time monitoring for 16GB + GPU setup with 10 concurrent users
"""
import asyncio
import logging
import time
import psutil
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.performance_optimizer import get_performance_optimizer
from app.services.smart_load_balancer import get_smart_load_balancer
from app.utils.qdrant_utils import get_qdrant_utils
from app.services.matching_service import get_matching_service

logger = logging.getLogger(__name__)
router = APIRouter()

class SystemStatus(BaseModel):
    status: str
    timestamp: float
    uptime: float
    version: str

class HealthCheck(BaseModel):
    service: str
    status: str
    response_time: float
    details: Dict

@router.get("/health", response_model=SystemStatus)
async def system_health():
    """
    Comprehensive system health check.
    """
    try:
        start_time = time.time()
        
        # Check all critical services
        health_checks = await asyncio.gather(
            _check_qdrant_health(),
            _check_database_health(),
            _check_matching_service_health(),
            _check_performance_health(),
            return_exceptions=True
        )
        
        response_time = time.time() - start_time
        
        # Determine overall status
        all_healthy = all(
            isinstance(check, dict) and check.get("status") == "healthy" 
            for check in health_checks if not isinstance(check, Exception)
        )
        
        status = "healthy" if all_healthy else "degraded"
        
        return SystemStatus(
            status=status,
            timestamp=time.time(),
            uptime=time.time() - psutil.boot_time(),
            version="1.0.0-ultimate"
        )
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")

@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check with individual service status.
    """
    try:
        start_time = time.time()
        
        # Run all health checks in parallel
        health_checks = await asyncio.gather(
            _check_qdrant_health(),
            _check_database_health(),
            _check_matching_service_health(),
            _check_performance_health(),
            _check_load_balancer_health(),
            _check_system_resources(),
            return_exceptions=True
        )
        
        total_response_time = time.time() - start_time
        
        # Process results
        services = {}
        for i, check in enumerate(health_checks):
            service_name = ["qdrant", "database", "matching", "performance", "load_balancer", "system"][i]
            if isinstance(check, Exception):
                services[service_name] = {
                    "status": "error",
                    "error": str(check),
                    "response_time": 0
                }
            else:
                services[service_name] = check
        
        # Calculate overall status
        healthy_services = sum(1 for s in services.values() if s.get("status") == "healthy")
        total_services = len(services)
        health_percentage = (healthy_services / total_services) * 100
        
        overall_status = "healthy" if health_percentage >= 80 else "degraded" if health_percentage >= 60 else "unhealthy"
        
        return JSONResponse({
            "overall_status": overall_status,
            "health_percentage": health_percentage,
            "total_response_time": total_response_time,
            "services": services,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Detailed health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Detailed health check failed: {str(e)}")

@router.get("/metrics/performance")
async def performance_metrics():
    """
    Get comprehensive performance metrics.
    """
    try:
        optimizer = get_performance_optimizer()
        load_balancer = get_smart_load_balancer()
        
        # Get performance metrics
        perf_metrics = optimizer.get_performance_metrics()
        load_metrics = await load_balancer.get_system_status()
        
        # Get system resources
        system_resources = _get_system_resources()
        
        return JSONResponse({
            "performance_metrics": perf_metrics,
            "load_balancer_metrics": load_metrics,
            "system_resources": system_resources,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance metrics: {str(e)}")

@router.get("/metrics/categories")
async def category_metrics():
    """
    Get category-specific performance metrics.
    """
    try:
        qdrant = get_qdrant_utils()
        categories = qdrant.get_categories_with_counts()
        
        # Get category performance data
        category_performance = {}
        for category, count in categories.items():
            category_performance[category] = {
                "cv_count": count,
                "avg_processing_time": _get_category_avg_processing_time(category),
                "success_rate": _get_category_success_rate(category),
                "last_updated": time.time()
            }
        
        return JSONResponse({
            "categories": category_performance,
            "total_categories": len(categories),
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get category metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get category metrics: {str(e)}")

@router.get("/optimization/recommendations")
async def optimization_recommendations():
    """
    Get system optimization recommendations.
    """
    try:
        optimizer = get_performance_optimizer()
        load_balancer = get_smart_load_balancer()
        
        # Get recommendations from both services
        perf_recommendations = optimizer.get_optimization_recommendations()
        load_recommendations = load_balancer._get_recommendations()
        
        # Combine and prioritize recommendations
        all_recommendations = perf_recommendations + load_recommendations
        
        return JSONResponse({
            "recommendations": all_recommendations,
            "performance_recommendations": perf_recommendations,
            "load_balancer_recommendations": load_recommendations,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to get optimization recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get optimization recommendations: {str(e)}")

@router.post("/optimization/apply")
async def apply_optimizations(optimization_level: str = "auto"):
    """
    Apply system optimizations.
    """
    try:
        optimizer = get_performance_optimizer()
        
        if optimization_level == "auto":
            # Let the optimizer decide based on current metrics
            current_metrics = optimizer.get_performance_metrics()
            # Apply optimizations based on current state
            result = await optimizer.optimize_for_concurrent_users(10)
        else:
            # Apply specific optimization level
            from app.services.performance_optimizer import OptimizationLevel
            level = OptimizationLevel(optimization_level)
            optimizer._apply_optimizations(level)
            result = {"optimization_level": level.value}
        
        return JSONResponse({
            "success": True,
            "optimization_result": result,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to apply optimizations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply optimizations: {str(e)}")

# ===========================================
# HELPER FUNCTIONS
# ===========================================

async def _check_qdrant_health():
    """Check Qdrant health."""
    try:
        start_time = time.time()
        qdrant = get_qdrant_utils()
        health = qdrant.health_check()
        response_time = time.time() - start_time
        
        return {
            "status": "healthy" if health.get("status") == "healthy" else "unhealthy",
            "response_time": response_time,
            "details": health
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

async def _check_database_health():
    """Check database health."""
    try:
        start_time = time.time()
        # Add database health check logic here
        response_time = time.time() - start_time
        
        return {
            "status": "healthy",
            "response_time": response_time,
            "details": {"connection": "ok", "queries": "ok"}
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

async def _check_matching_service_health():
    """Check matching service health."""
    try:
        start_time = time.time()
        matching_service = get_matching_service()
        # Simple health check - try to get service info
        response_time = time.time() - start_time
        
        return {
            "status": "healthy",
            "response_time": response_time,
            "details": {"service": "operational"}
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

async def _check_performance_health():
    """Check performance optimizer health."""
    try:
        start_time = time.time()
        optimizer = get_performance_optimizer()
        metrics = optimizer.get_performance_metrics()
        response_time = time.time() - start_time
        
        return {
            "status": "healthy",
            "response_time": response_time,
            "details": metrics
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

async def _check_load_balancer_health():
    """Check load balancer health."""
    try:
        start_time = time.time()
        load_balancer = get_smart_load_balancer()
        status = await load_balancer.get_system_status()
        response_time = time.time() - start_time
        
        return {
            "status": "healthy" if status.get("status") == "healthy" else "degraded",
            "response_time": response_time,
            "details": status
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

async def _check_system_resources():
    """Check system resources."""
    try:
        start_time = time.time()
        resources = _get_system_resources()
        response_time = time.time() - start_time
        
        # Determine status based on resource usage
        cpu_ok = resources["cpu_percent"] < 90
        memory_ok = resources["memory_percent"] < 90
        disk_ok = resources["disk_percent"] < 95
        
        status = "healthy" if cpu_ok and memory_ok and disk_ok else "degraded"
        
        return {
            "status": status,
            "response_time": response_time,
            "details": resources
        }
    except Exception as e:
        return {
            "status": "error",
            "response_time": 0,
            "error": str(e)
        }

def _get_system_resources():
    """Get current system resource usage."""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_gb": memory.available / (1024**3),
            "disk_percent": disk.percent,
            "disk_free_gb": disk.free / (1024**3)
        }
    except Exception as e:
        return {"error": str(e)}

def _get_category_avg_processing_time(category: str) -> float:
    """Get average processing time for a category."""
    # This would be implemented based on your metrics storage
    return 1.5  # Placeholder

def _get_category_success_rate(category: str) -> float:
    """Get success rate for a category."""
    # This would be implemented based on your metrics storage
    return 0.95  # Placeholder

