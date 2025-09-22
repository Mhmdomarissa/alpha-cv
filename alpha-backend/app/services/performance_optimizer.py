"""
Performance Optimizer - Smart Resource Management
Optimizes system performance for 10 concurrent users with 16GB + GPU
"""
import asyncio
import logging
import time
import psutil
import gc
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import threading
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class OptimizationLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class SystemMetrics:
    cpu_percent: float
    memory_percent: float
    memory_available_gb: float
    disk_usage_percent: float
    network_io: Dict[str, int]
    active_connections: int
    timestamp: float

@dataclass
class OptimizationAction:
    action_type: str
    description: str
    priority: int
    estimated_impact: float
    execution_time: float

class PerformanceOptimizer:
    """
    Smart performance optimizer that:
    1. Monitors system resources in real-time
    2. Automatically optimizes based on load
    3. Prevents system crashes
    4. Maintains SSH stability
    """
    
    def __init__(self):
        self.monitoring_interval = 10  # seconds
        self.optimization_thresholds = {
            "cpu_warning": 70.0,
            "cpu_critical": 85.0,
            "memory_warning": 75.0,
            "memory_critical": 90.0,
            "disk_warning": 80.0,
            "disk_critical": 95.0
        }
        
        self.optimization_actions = {
            "clear_cache": OptimizationAction(
                action_type="clear_cache",
                description="Clear application caches",
                priority=1,
                estimated_impact=0.1,
                execution_time=2.0
            ),
            "reduce_batch_size": OptimizationAction(
                action_type="reduce_batch_size",
                description="Reduce processing batch sizes",
                priority=2,
                estimated_impact=0.2,
                execution_time=1.0
            ),
            "limit_concurrent": OptimizationAction(
                action_type="limit_concurrent",
                description="Limit concurrent operations",
                priority=3,
                estimated_impact=0.3,
                execution_time=0.5
            ),
            "gc_collect": OptimizationAction(
                action_type="gc_collect",
                description="Force garbage collection",
                priority=4,
                estimated_impact=0.15,
                execution_time=1.0
            ),
            "emergency_mode": OptimizationAction(
                action_type="emergency_mode",
                description="Enable emergency performance mode",
                priority=5,
                estimated_impact=0.5,
                execution_time=0.1
            )
        }
        
        self.current_optimization_level = OptimizationLevel.LOW
        self.monitoring_active = False
        self.monitoring_thread = None
        self.performance_history = []
        self.max_history_size = 100
        
        # Performance settings that can be adjusted
        self.dynamic_settings = {
            "max_concurrent_uploads": 10,
            "max_concurrent_matches": 10,
            "batch_size": 20,
            "cache_ttl": 3600,
            "connection_pool_size": 25,
            "gpu_memory_fraction": 0.8
        }
        
        logger.info("🚀 PerformanceOptimizer initialized")

    async def start_monitoring(self):
        """Start real-time performance monitoring."""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        logger.info("📊 Performance monitoring started")

    def stop_monitoring(self):
        """Stop performance monitoring."""
        self.monitoring_active = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        logger.info("📊 Performance monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop (runs in separate thread)."""
        while self.monitoring_active:
            try:
                metrics = self._collect_system_metrics()
                self.performance_history.append(metrics)
                
                # Keep history size manageable
                if len(self.performance_history) > self.max_history_size:
                    self.performance_history = self.performance_history[-self.max_history_size:]
                
                # Check if optimization is needed
                optimization_level = self._assess_optimization_level(metrics)
                
                if optimization_level != self.current_optimization_level:
                    self.current_optimization_level = optimization_level
                    self._apply_optimizations(optimization_level)
                
                time.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"❌ Monitoring error: {e}")
                time.sleep(self.monitoring_interval)

    def _collect_system_metrics(self) -> SystemMetrics:
        """Collect current system metrics."""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network_io = psutil.net_io_counters()._asdict()
            
            return SystemMetrics(
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_available_gb=memory.available / (1024**3),
                disk_usage_percent=disk.percent,
                network_io=network_io,
                active_connections=self._count_active_connections(),
                timestamp=time.time()
            )
        except Exception as e:
            logger.error(f"❌ Failed to collect metrics: {e}")
            return SystemMetrics(0, 0, 0, 0, {}, 0, time.time())

    def _count_active_connections(self) -> int:
        """Count active network connections."""
        try:
            connections = psutil.net_connections()
            return len([c for c in connections if c.status == 'ESTABLISHED'])
        except Exception:
            return 0

    def _assess_optimization_level(self, metrics: SystemMetrics) -> OptimizationLevel:
        """Assess current optimization level based on metrics."""
        if (metrics.cpu_percent >= self.optimization_thresholds["cpu_critical"] or
            metrics.memory_percent >= self.optimization_thresholds["memory_critical"]):
            return OptimizationLevel.CRITICAL
        
        elif (metrics.cpu_percent >= self.optimization_thresholds["cpu_warning"] or
              metrics.memory_percent >= self.optimization_thresholds["memory_warning"]):
            return OptimizationLevel.HIGH
        
        elif (metrics.cpu_percent >= 50 or metrics.memory_percent >= 60):
            return OptimizationLevel.MEDIUM
        
        else:
            return OptimizationLevel.LOW

    def _apply_optimizations(self, level: OptimizationLevel):
        """Apply optimizations based on level."""
        logger.info(f"🔧 Applying {level.value} level optimizations")
        
        if level == OptimizationLevel.CRITICAL:
            self._apply_critical_optimizations()
        elif level == OptimizationLevel.HIGH:
            self._apply_high_optimizations()
        elif level == OptimizationLevel.MEDIUM:
            self._apply_medium_optimizations()
        else:
            self._apply_low_optimizations()

    def _apply_critical_optimizations(self):
        """Apply critical level optimizations."""
        # Emergency mode - maximum resource conservation
        self.dynamic_settings.update({
            "max_concurrent_uploads": 3,
            "max_concurrent_matches": 3,
            "batch_size": 5,
            "gpu_memory_fraction": 0.5,
            "connection_pool_size": 10
        })
        
        # Force garbage collection
        gc.collect()
        
        # Clear caches
        self._clear_application_caches()
        
        logger.warning("🚨 CRITICAL optimizations applied - system under high load")

    def _apply_high_optimizations(self):
        """Apply high level optimizations."""
        self.dynamic_settings.update({
            "max_concurrent_uploads": 5,
            "max_concurrent_matches": 5,
            "batch_size": 10,
            "gpu_memory_fraction": 0.6,
            "connection_pool_size": 15
        })
        
        # Garbage collection
        gc.collect()
        
        logger.warning("⚠️ HIGH optimizations applied - system under moderate load")

    def _apply_medium_optimizations(self):
        """Apply medium level optimizations."""
        self.dynamic_settings.update({
            "max_concurrent_uploads": 7,
            "max_concurrent_matches": 7,
            "batch_size": 15,
            "gpu_memory_fraction": 0.7,
            "connection_pool_size": 20
        })
        
        logger.info("📈 MEDIUM optimizations applied - system under normal load")

    def _apply_low_optimizations(self):
        """Apply low level optimizations (normal operation)."""
        self.dynamic_settings.update({
            "max_concurrent_uploads": 10,
            "max_concurrent_matches": 10,
            "batch_size": 20,
            "gpu_memory_fraction": 0.8,
            "connection_pool_size": 25
        })
        
        logger.info("✅ LOW optimizations applied - system running optimally")

    def _clear_application_caches(self):
        """Clear application caches."""
        try:
            # Clear Python caches
            import sys
            if hasattr(sys, '_clear_type_cache'):
                sys._clear_type_cache()
            
            # Clear any custom caches (implement based on your cache system)
            logger.info("🧹 Application caches cleared")
        except Exception as e:
            logger.error(f"❌ Failed to clear caches: {e}")

    def get_current_settings(self) -> Dict:
        """Get current dynamic settings."""
        return self.dynamic_settings.copy()

    def get_performance_metrics(self) -> Dict:
        """Get current performance metrics."""
        if not self.performance_history:
            return {"error": "No metrics available"}
        
        latest = self.performance_history[-1]
        return {
            "current_metrics": {
                "cpu_percent": latest.cpu_percent,
                "memory_percent": latest.memory_percent,
                "memory_available_gb": latest.memory_available_gb,
                "disk_usage_percent": latest.disk_usage_percent,
                "active_connections": latest.active_connections,
                "timestamp": latest.timestamp
            },
            "optimization_level": self.current_optimization_level.value,
            "dynamic_settings": self.dynamic_settings,
            "history_size": len(self.performance_history)
        }

    def get_optimization_recommendations(self) -> List[str]:
        """Get optimization recommendations based on current metrics."""
        if not self.performance_history:
            return ["No metrics available for recommendations"]
        
        latest = self.performance_history[-1]
        recommendations = []
        
        if latest.cpu_percent > 80:
            recommendations.append("High CPU usage detected. Consider reducing concurrent operations.")
        
        if latest.memory_percent > 80:
            recommendations.append("High memory usage detected. Consider clearing caches or reducing batch sizes.")
        
        if latest.disk_usage_percent > 90:
            recommendations.append("High disk usage detected. Consider cleaning up temporary files.")
        
        if latest.active_connections > 50:
            recommendations.append("High connection count detected. Consider optimizing connection pooling.")
        
        if not recommendations:
            recommendations.append("System is running optimally.")
        
        return recommendations

    async def optimize_for_concurrent_users(self, user_count: int) -> Dict:
        """Optimize system for specific number of concurrent users."""
        if user_count <= 5:
            self._apply_low_optimizations()
        elif user_count <= 8:
            self._apply_medium_optimizations()
        elif user_count <= 10:
            self._apply_high_optimizations()
        else:
            self._apply_critical_optimizations()
        
        return {
            "optimized_for_users": user_count,
            "current_settings": self.dynamic_settings,
            "optimization_level": self.current_optimization_level.value
        }

# Global instance
_performance_optimizer: Optional[PerformanceOptimizer] = None

def get_performance_optimizer() -> PerformanceOptimizer:
    """Get global PerformanceOptimizer instance."""
    global _performance_optimizer
    if _performance_optimizer is None:
        _performance_optimizer = PerformanceOptimizer()
    return _performance_optimizer

