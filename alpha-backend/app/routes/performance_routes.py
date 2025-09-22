# app/routes/performance_routes.py
import psutil
import time
import json
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import subprocess
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/performance", tags=["performance"])

def get_gpu_stats():
    """Get GPU statistics using nvidia-smi."""
    try:
        result = subprocess.run([
            'nvidia-smi', 
            '--query-gpu=index,name,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,power.draw',
            '--format=csv,noheader,nounits'
        ], capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            gpus = []
            for line in lines:
                if line.strip():
                    parts = [p.strip() for p in line.split(',')]
                    if len(parts) >= 9:
                        gpus.append({
                            "index": int(parts[0]),
                            "name": parts[1],
                            "gpu_utilization": float(parts[2]) if parts[2] != 'N/A' else 0,
                            "memory_utilization": float(parts[3]) if parts[3] != 'N/A' else 0,
                            "memory_total": float(parts[4]) if parts[4] != 'N/A' else 0,
                            "memory_used": float(parts[5]) if parts[5] != 'N/A' else 0,
                            "memory_free": float(parts[6]) if parts[6] != 'N/A' else 0,
                            "temperature": float(parts[7]) if parts[7] != 'N/A' else 0,
                            "power_draw": float(parts[8]) if parts[8] != 'N/A' else 0
                        })
            return gpus
        else:
            logger.warning(f"nvidia-smi failed: {result.stderr}")
            return []
    except Exception as e:
        logger.error(f"Failed to get GPU stats: {e}")
        return []

def get_docker_stats():
    """Get Docker container statistics."""
    try:
        result = subprocess.run([
            'docker', 'stats', '--no-stream', '--format', 
            'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            containers = []
            for line in lines:
                if line.strip():
                    parts = line.split('\t')
                    if len(parts) >= 7:
                        containers.append({
                            "container": parts[0],
                            "cpu_percent": parts[1].replace('%', ''),
                            "memory_usage": parts[2],
                            "memory_percent": parts[3].replace('%', ''),
                            "network_io": parts[4],
                            "block_io": parts[5],
                            "pids": parts[6]
                        })
            return containers
        else:
            logger.warning(f"docker stats failed: {result.stderr}")
            return []
    except Exception as e:
        logger.error(f"Failed to get Docker stats: {e}")
        return []

def get_system_stats():
    """Get comprehensive system statistics."""
    try:
        # CPU stats
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Memory stats
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # Disk stats
        disk = psutil.disk_usage('/')
        disk_io = psutil.disk_io_counters()
        
        # Network stats
        network = psutil.net_io_counters()
        
        # Load average
        load_avg = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
        
        return {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "frequency": {
                    "current": cpu_freq.current if cpu_freq else 0,
                    "min": cpu_freq.min if cpu_freq else 0,
                    "max": cpu_freq.max if cpu_freq else 0
                },
                "load_average": {
                    "1min": load_avg[0],
                    "5min": load_avg[1],
                    "15min": load_avg[2]
                }
            },
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "percent": memory.percent,
                "swap": {
                    "total": swap.total,
                    "used": swap.used,
                    "free": swap.free,
                    "percent": swap.percent
                }
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": (disk.used / disk.total) * 100,
                "io": {
                    "read_count": disk_io.read_count if disk_io else 0,
                    "write_count": disk_io.write_count if disk_io else 0,
                    "read_bytes": disk_io.read_bytes if disk_io else 0,
                    "write_bytes": disk_io.write_bytes if disk_io else 0
                }
            },
            "network": {
                "bytes_sent": network.bytes_sent,
                "bytes_recv": network.bytes_recv,
                "packets_sent": network.packets_sent,
                "packets_recv": network.packets_recv
            }
        }
    except Exception as e:
        logger.error(f"Failed to get system stats: {e}")
        return {}

def get_application_stats():
    """Get application-specific statistics."""
    try:
        # Get process stats for the current application
        current_process = psutil.Process()
        
        # Get all Python processes (likely our application)
        python_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'cmdline']):
            try:
                if 'python' in proc.info['name'].lower():
                    python_processes.append({
                        "pid": proc.info['pid'],
                        "name": proc.info['name'],
                        "cpu_percent": proc.cpu_percent(),
                        "memory_mb": proc.info['memory_info'].rss / 1024 / 1024 if proc.info['memory_info'] else 0,
                        "cmdline": ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return {
            "current_process": {
                "pid": current_process.pid,
                "cpu_percent": current_process.cpu_percent(),
                "memory_mb": current_process.memory_info().rss / 1024 / 1024,
                "num_threads": current_process.num_threads(),
                "create_time": current_process.create_time()
            },
            "python_processes": python_processes
        }
    except Exception as e:
        logger.error(f"Failed to get application stats: {e}")
        return {}

@router.get("/system")
async def get_system_performance():
    """Get comprehensive system performance metrics."""
    try:
        timestamp = time.time()
        
        system_stats = get_system_stats()
        gpu_stats = get_gpu_stats()
        docker_stats = get_docker_stats()
        app_stats = get_application_stats()
        
        return JSONResponse({
            "timestamp": timestamp,
            "system": system_stats,
            "gpu": gpu_stats,
            "docker": docker_stats,
            "application": app_stats,
            "status": "success"
        })
    except Exception as e:
        logger.error(f"Failed to get system performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system performance: {str(e)}")

@router.get("/gpu")
async def get_gpu_performance():
    """Get GPU performance metrics."""
    try:
        timestamp = time.time()
        gpu_stats = get_gpu_stats()
        
        return JSONResponse({
            "timestamp": timestamp,
            "gpu": gpu_stats,
            "status": "success"
        })
    except Exception as e:
        logger.error(f"Failed to get GPU performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get GPU performance: {str(e)}")

@router.get("/docker")
async def get_docker_performance():
    """Get Docker container performance metrics."""
    try:
        timestamp = time.time()
        docker_stats = get_docker_stats()
        
        return JSONResponse({
            "timestamp": timestamp,
            "docker": docker_stats,
            "status": "success"
        })
    except Exception as e:
        logger.error(f"Failed to get Docker performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Docker performance: {str(e)}")

@router.get("/summary")
async def get_performance_summary():
    """Get a summary of key performance metrics."""
    try:
        timestamp = time.time()
        
        system_stats = get_system_stats()
        gpu_stats = get_gpu_stats()
        docker_stats = get_docker_stats()
        
        # Calculate summary metrics
        summary = {
            "timestamp": timestamp,
            "cpu_usage": system_stats.get("cpu", {}).get("percent", 0),
            "memory_usage": system_stats.get("memory", {}).get("percent", 0),
            "disk_usage": system_stats.get("disk", {}).get("percent", 0),
            "gpu_count": len(gpu_stats),
            "gpu_usage": gpu_stats[0].get("gpu_utilization", 0) if gpu_stats else 0,
            "gpu_memory_usage": gpu_stats[0].get("memory_utilization", 0) if gpu_stats else 0,
            "container_count": len(docker_stats),
            "load_average": system_stats.get("cpu", {}).get("load_average", {}).get("1min", 0),
            "status": "healthy" if system_stats.get("cpu", {}).get("percent", 0) < 90 else "warning"
        }
        
        return JSONResponse(summary)
    except Exception as e:
        logger.error(f"Failed to get performance summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance summary: {str(e)}")

@router.get("/health")
async def get_performance_health():
    """Get performance health status."""
    try:
        timestamp = time.time()
        
        system_stats = get_system_stats()
        gpu_stats = get_gpu_stats()
        
        # Health checks
        cpu_usage = system_stats.get("cpu", {}).get("percent", 0)
        memory_usage = system_stats.get("memory", {}).get("percent", 0)
        disk_usage = system_stats.get("disk", {}).get("percent", 0)
        gpu_usage = gpu_stats[0].get("gpu_utilization", 0) if gpu_stats else 0
        gpu_temp = gpu_stats[0].get("temperature", 0) if gpu_stats else 0
        
        health_status = "healthy"
        warnings = []
        
        if cpu_usage > 90:
            health_status = "critical"
            warnings.append(f"High CPU usage: {cpu_usage:.1f}%")
        elif cpu_usage > 80:
            health_status = "warning"
            warnings.append(f"Elevated CPU usage: {cpu_usage:.1f}%")
            
        if memory_usage > 90:
            health_status = "critical"
            warnings.append(f"High memory usage: {memory_usage:.1f}%")
        elif memory_usage > 80:
            health_status = "warning"
            warnings.append(f"Elevated memory usage: {memory_usage:.1f}%")
            
        if disk_usage > 90:
            health_status = "critical"
            warnings.append(f"High disk usage: {disk_usage:.1f}%")
        elif disk_usage > 80:
            health_status = "warning"
            warnings.append(f"Elevated disk usage: {disk_usage:.1f}%")
            
        if gpu_temp > 85:
            health_status = "critical"
            warnings.append(f"High GPU temperature: {gpu_temp:.1f}°C")
        elif gpu_temp > 80:
            health_status = "warning"
            warnings.append(f"Elevated GPU temperature: {gpu_temp:.1f}°C")
        
        return JSONResponse({
            "timestamp": timestamp,
            "status": health_status,
            "warnings": warnings,
            "metrics": {
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "disk_usage": disk_usage,
                "gpu_usage": gpu_usage,
                "gpu_temperature": gpu_temp
            }
        })
    except Exception as e:
        logger.error(f"Failed to get performance health: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance health: {str(e)}")
