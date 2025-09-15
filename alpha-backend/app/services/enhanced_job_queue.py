"""
Enterprise-Grade Job Queue System for Viral Traffic
==================================================

Features:
- Auto-scaling worker pool (1-50 workers based on load)
- Priority queue system (urgent vs normal applications)
- Intelligent load balancing
- Memory management and cleanup
- Circuit breaker integration
- Graceful degradation under extreme load
- Real-time monitoring and metrics
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import psutil
import os

logger = logging.getLogger(__name__)

class JobPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4

class JobStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class JobMetrics:
    """Job processing metrics"""
    total_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    average_processing_time: float = 0.0
    current_queue_size: int = 0
    active_workers: int = 0
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0

@dataclass
class ApplicationJob:
    """Job application processing job"""
    job_id: str
    application_data: Dict[str, Any]
    priority: JobPriority
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    status: JobStatus = JobStatus.QUEUED
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

class EnterpriseJobQueue:
    """Enterprise-grade job queue with auto-scaling and load balancing"""
    
    def __init__(self, min_workers: int = 2, max_workers: int = 50):
        # Queue configuration
        self.min_workers = min_workers
        self.max_workers = max_workers
        self.current_workers = min_workers
        
        # Priority queues
        self.queues = {
            JobPriority.URGENT: asyncio.Queue(),
            JobPriority.HIGH: asyncio.Queue(),
            JobPriority.NORMAL: asyncio.Queue(),
            JobPriority.LOW: asyncio.Queue(),
        }
        
        # Job tracking
        self.jobs: Dict[str, ApplicationJob] = {}
        self.worker_tasks: List[asyncio.Task] = []
        self.worker_metrics: Dict[str, Dict] = {}
        
        # System monitoring
        self.metrics = JobMetrics()
        self.last_scale_check = time.time()
        self.scale_check_interval = 30  # Check every 30 seconds
        
        # Circuit breaker state
        self.circuit_breaker_open = False
        self.circuit_breaker_failures = 0
        self.circuit_breaker_last_failure = 0
        self.circuit_breaker_threshold = 10  # 10 failures in 5 minutes
        self.circuit_breaker_timeout = 300  # 5 minutes
        
        # Performance thresholds
        self.memory_threshold_mb = 4096  # 4GB memory limit (increased for development)
        self.cpu_threshold_percent = 90  # 90% CPU threshold
        self.queue_size_threshold = 1000  # Scale up if queue > 1000
        
        # Start initial workers
        self._start_workers()
        
        logger.info(f"🚀 Enterprise Job Queue initialized - Workers: {self.current_workers}/{self.max_workers}")
    
    def _start_workers(self):
        """Start initial worker pool"""
        for i in range(self.current_workers):
            worker_id = f"worker-{i}"
            task = asyncio.create_task(self._worker(worker_id))
            self.worker_tasks.append(task)
            self.worker_metrics[worker_id] = {
                "jobs_processed": 0,
                "last_job_time": 0,
                "active": True,
                "started_at": time.time()
            }
    
    async def _worker(self, worker_id: str):
        """Enhanced worker with intelligent job processing"""
        logger.info(f"👷 Worker {worker_id} started")
        
        while True:
            try:
                # Check if circuit breaker is open
                if self._is_circuit_breaker_open():
                    logger.warning(f"⚡ Worker {worker_id} paused - Circuit breaker open")
                    await asyncio.sleep(5)
                    continue
                
                # Get job from priority queues (highest priority first)
                job = await self._get_next_job()
                if not job:
                    await asyncio.sleep(0.1)  # Brief pause if no jobs
                    continue
                
                # Process the job
                await self._process_job(worker_id, job)
                
            except asyncio.CancelledError:
                logger.info(f"🛑 Worker {worker_id} cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Worker {worker_id} error: {str(e)}")
                self._handle_worker_error(worker_id, str(e))
                await asyncio.sleep(1)  # Brief pause on error
    
    async def _get_next_job(self) -> Optional[ApplicationJob]:
        """Get next job from priority queues"""
        # Check queues in priority order
        for priority in [JobPriority.URGENT, JobPriority.HIGH, JobPriority.NORMAL, JobPriority.LOW]:
            queue = self.queues[priority]
            if not queue.empty():
                try:
                    job = await asyncio.wait_for(queue.get(), timeout=0.1)
                    return job
                except asyncio.TimeoutError:
                    continue
        return None
    
    async def _process_job(self, worker_id: str, job: ApplicationJob):
        """Process a single job application"""
        job.status = JobStatus.PROCESSING
        job.started_at = time.time()
        
        try:
            logger.info(f"🔄 Worker {worker_id} processing job {job.job_id}")
            
            # Import here to avoid circular imports
            from app.services.careers_service import process_job_application_async
            
            # Process the application
            result = await process_job_application_async(job.application_data)
            
            # Mark as completed
            job.status = JobStatus.COMPLETED
            job.completed_at = time.time()
            job.result = result
            
            # Update metrics
            self.metrics.completed_jobs += 1
            self.worker_metrics[worker_id]["jobs_processed"] += 1
            self.worker_metrics[worker_id]["last_job_time"] = time.time()
            
            # Update average processing time
            processing_time = job.completed_at - job.started_at
            self._update_average_processing_time(processing_time)
            
            logger.info(f"✅ Worker {worker_id} completed job {job.job_id} in {processing_time:.2f}s")
            
        except Exception as e:
            # Handle job failure
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.completed_at = time.time()
            
            self.metrics.failed_jobs += 1
            self._handle_job_failure(job, str(e))
            
            logger.error(f"❌ Worker {worker_id} failed job {job.job_id}: {str(e)}")
    
    def _update_average_processing_time(self, processing_time: float):
        """Update average processing time with exponential moving average"""
        if self.metrics.average_processing_time == 0:
            self.metrics.average_processing_time = processing_time
        else:
            # Use exponential moving average (alpha = 0.1)
            self.metrics.average_processing_time = (0.9 * self.metrics.average_processing_time + 
                                                  0.1 * processing_time)
    
    def _handle_job_failure(self, job: ApplicationJob, error: str):
        """Handle job failure with retry logic"""
        job.retry_count += 1
        
        if job.retry_count <= job.max_retries:
            # Retry with lower priority
            retry_priority = JobPriority.LOW if job.priority != JobPriority.LOW else JobPriority.LOW
            job.priority = retry_priority
            job.status = JobStatus.QUEUED
            job.error = None
            
            # Re-queue the job
            asyncio.create_task(self.queues[retry_priority].put(job))
            logger.info(f"🔄 Retrying job {job.job_id} (attempt {job.retry_count}/{job.max_retries})")
        else:
            # Max retries exceeded
            self.circuit_breaker_failures += 1
            self.circuit_breaker_last_failure = time.time()
            logger.error(f"💀 Job {job.job_id} failed permanently after {job.retry_count} attempts")
    
    def _handle_worker_error(self, worker_id: str, error: str):
        """Handle worker-level errors"""
        self.worker_metrics[worker_id]["active"] = False
        self.circuit_breaker_failures += 1
        self.circuit_breaker_last_failure = time.time()
    
    def _is_circuit_breaker_open(self) -> bool:
        """Check if circuit breaker should be open"""
        now = time.time()
        
        # Reset failures if timeout has passed
        if now - self.circuit_breaker_last_failure > self.circuit_breaker_timeout:
            self.circuit_breaker_failures = 0
            self.circuit_breaker_open = False
        
        # Open circuit breaker if too many failures
        if self.circuit_breaker_failures >= self.circuit_breaker_threshold:
            if not self.circuit_breaker_open:
                logger.critical(f"🔥 CIRCUIT BREAKER OPENED - {self.circuit_breaker_failures} failures")
                self.circuit_breaker_open = True
            return True
        
        return False
    
    async def submit_application(self, application_data: Dict[str, Any], priority: JobPriority = JobPriority.NORMAL) -> str:
        """Submit a job application for processing"""
        
        # Check if system is overloaded
        if self._is_system_overloaded():
            raise Exception("System temporarily overloaded. Please try again in a few minutes.")
        
        # Create job
        job_id = str(uuid.uuid4())
        job = ApplicationJob(
            job_id=job_id,
            application_data=application_data,
            priority=priority
        )
        
        # Store job
        self.jobs[job_id] = job
        
        # Add to appropriate queue
        await self.queues[priority].put(job)
        
        # Update metrics
        self.metrics.total_jobs += 1
        self.metrics.current_queue_size = sum(q.qsize() for q in self.queues.values())
        
        # Trigger auto-scaling check
        await self._check_auto_scaling()
        
        logger.info(f"📥 Job {job_id} queued with priority {priority.name}")
        return job_id
    
    def _is_system_overloaded(self) -> bool:
        """Check if system is critically overloaded"""
        # Check memory usage
        memory_mb = psutil.virtual_memory().used / 1024 / 1024
        if memory_mb > self.memory_threshold_mb:
            logger.warning(f"⚠️ High memory usage: {memory_mb:.1f}MB")
            return True
        
        # Check CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        if cpu_percent > self.cpu_threshold_percent:
            logger.warning(f"⚠️ High CPU usage: {cpu_percent:.1f}%")
            return True
        
        # Check queue sizes
        total_queue_size = sum(q.qsize() for q in self.queues.values())
        if total_queue_size > self.queue_size_threshold * 2:  # 2x threshold = critical
            logger.warning(f"⚠️ Critical queue size: {total_queue_size}")
            return True
        
        return False
    
    async def _check_auto_scaling(self):
        """Check if we need to scale workers up or down"""
        now = time.time()
        
        # Only check every interval
        if now - self.last_scale_check < self.scale_check_interval:
            return
        
        self.last_scale_check = now
        
        # Get current metrics
        total_queue_size = sum(q.qsize() for q in self.queues.values())
        memory_mb = psutil.virtual_memory().used / 1024 / 1024
        cpu_percent = psutil.cpu_percent()
        
        # Update metrics
        self.metrics.current_queue_size = total_queue_size
        self.metrics.memory_usage_mb = memory_mb
        self.metrics.cpu_usage_percent = cpu_percent
        self.metrics.active_workers = len([w for w in self.worker_metrics.values() if w["active"]])
        
        # Scale up conditions
        should_scale_up = (
            total_queue_size > self.queue_size_threshold and
            self.current_workers < self.max_workers and
            memory_mb < self.memory_threshold_mb * 0.8 and  # Don't scale if near memory limit
            cpu_percent < self.cpu_threshold_percent * 0.8   # Don't scale if near CPU limit
        )
        
        # Scale down conditions  
        should_scale_down = (
            total_queue_size < 10 and  # Very few jobs
            self.current_workers > self.min_workers and
            self.metrics.average_processing_time < 30  # Jobs processing quickly
        )
        
        if should_scale_up:
            await self._scale_up()
        elif should_scale_down:
            await self._scale_down()
    
    async def _scale_up(self):
        """Add more workers"""
        new_workers = min(5, self.max_workers - self.current_workers)  # Add up to 5 at a time
        
        for i in range(new_workers):
            worker_id = f"worker-{self.current_workers + i}"
            task = asyncio.create_task(self._worker(worker_id))
            self.worker_tasks.append(task)
            self.worker_metrics[worker_id] = {
                "jobs_processed": 0,
                "last_job_time": 0,
                "active": True,
                "started_at": time.time()
            }
        
        self.current_workers += new_workers
        logger.info(f"📈 Scaled UP: {new_workers} workers added. Total: {self.current_workers}/{self.max_workers}")
    
    async def _scale_down(self):
        """Remove excess workers"""
        workers_to_remove = min(2, self.current_workers - self.min_workers)  # Remove up to 2 at a time
        
        # Cancel the most recent workers
        for _ in range(workers_to_remove):
            if self.worker_tasks:
                task = self.worker_tasks.pop()
                task.cancel()
                self.current_workers -= 1
        
        logger.info(f"📉 Scaled DOWN: {workers_to_remove} workers removed. Total: {self.current_workers}/{self.max_workers}")
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific job"""
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "priority": job.priority.name,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "result": job.result,
            "error": job.error,
            "retry_count": job.retry_count,
            "processing_time": (job.completed_at - job.started_at) if job.started_at and job.completed_at else None
        }
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics"""
        return {
            "queue_metrics": {
                "total_jobs": self.metrics.total_jobs,
                "completed_jobs": self.metrics.completed_jobs,
                "failed_jobs": self.metrics.failed_jobs,
                "success_rate": (self.metrics.completed_jobs / max(1, self.metrics.total_jobs)) * 100,
                "current_queue_size": self.metrics.current_queue_size,
                "queue_sizes_by_priority": {
                    priority.name: queue.qsize() for priority, queue in self.queues.items()
                }
            },
            "worker_metrics": {
                "active_workers": self.metrics.active_workers,
                "total_workers": self.current_workers,
                "max_workers": self.max_workers,
                "worker_utilization": (self.metrics.active_workers / max(1, self.current_workers)) * 100
            },
            "performance_metrics": {
                "average_processing_time": self.metrics.average_processing_time,
                "memory_usage_mb": self.metrics.memory_usage_mb,
                "cpu_usage_percent": self.metrics.cpu_usage_percent,
                "memory_utilization": (self.metrics.memory_usage_mb / self.memory_threshold_mb) * 100
            },
            "circuit_breaker": {
                "is_open": self.circuit_breaker_open,
                "failures": self.circuit_breaker_failures,
                "last_failure": self.circuit_breaker_last_failure
            }
        }
    
    async def graceful_shutdown(self):
        """Gracefully shutdown the job queue"""
        logger.info("🛑 Starting graceful shutdown of job queue...")
        
        # Cancel all workers
        for task in self.worker_tasks:
            task.cancel()
        
        # Wait for workers to finish current jobs
        if self.worker_tasks:
            await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        
        logger.info("✅ Job queue shutdown complete")

# Global job queue instance
job_queue_instance: Optional[EnterpriseJobQueue] = None

async def get_enterprise_job_queue() -> EnterpriseJobQueue:
    """Get or create the global job queue instance"""
    global job_queue_instance
    
    if job_queue_instance is None:
        # Get configuration from environment
        min_workers = int(os.getenv("MIN_QUEUE_WORKERS", "2"))
        max_workers = int(os.getenv("MAX_QUEUE_WORKERS", "50"))
        
        job_queue_instance = EnterpriseJobQueue(min_workers=min_workers, max_workers=max_workers)
        
        logger.info(f"🚀 Enterprise Job Queue created - Workers: {min_workers}-{max_workers}")
    
    return job_queue_instance
