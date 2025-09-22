#!/usr/bin/env python3
"""
System resource monitoring script to ensure safe deployment.
This script monitors system resources before and during deployment.
"""

import psutil
import time
import subprocess
import json
from datetime import datetime

def get_system_info():
    """Get current system resource usage."""
    return {
        "timestamp": datetime.now().isoformat(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory": {
            "total": psutil.virtual_memory().total / (1024**3),  # GB
            "available": psutil.virtual_memory().available / (1024**3),  # GB
            "used": psutil.virtual_memory().used / (1024**3),  # GB
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": psutil.disk_usage('/').total / (1024**3),  # GB
            "used": psutil.disk_usage('/').used / (1024**3),  # GB
            "free": psutil.disk_usage('/').free / (1024**3),  # GB
            "percent": psutil.disk_usage('/').percent
        }
    }

def check_docker_resources():
    """Check Docker container resource usage."""
    try:
        result = subprocess.run(['docker', 'stats', '--no-stream', '--format', 'json'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            containers = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        container = json.loads(line)
                        containers.append(container)
                    except json.JSONDecodeError:
                        continue
            return containers
        else:
            return []
    except Exception as e:
        print(f"Error checking Docker resources: {e}")
        return []

def is_system_safe():
    """Check if system resources are safe for deployment."""
    info = get_system_info()
    
    # Safety thresholds
    cpu_threshold = 80  # %
    memory_threshold = 85  # %
    disk_threshold = 90  # %
    
    warnings = []
    
    if info["cpu_percent"] > cpu_threshold:
        warnings.append(f"High CPU usage: {info['cpu_percent']:.1f}%")
    
    if info["memory"]["percent"] > memory_threshold:
        warnings.append(f"High memory usage: {info['memory']['percent']:.1f}%")
    
    if info["disk"]["percent"] > disk_threshold:
        warnings.append(f"High disk usage: {info['disk']['percent']:.1f}%")
    
    return len(warnings) == 0, warnings, info

def monitor_deployment():
    """Monitor system during deployment."""
    print("🔍 System Resource Monitor")
    print("=" * 50)
    
    # Initial check
    safe, warnings, info = is_system_safe()
    
    print(f"📊 Initial System Status:")
    print(f"   CPU: {info['cpu_percent']:.1f}%")
    print(f"   Memory: {info['memory']['percent']:.1f}% ({info['memory']['used']:.1f}GB / {info['memory']['total']:.1f}GB)")
    print(f"   Disk: {info['disk']['percent']:.1f}% ({info['disk']['used']:.1f}GB / {info['disk']['total']:.1f}GB)")
    
    if not safe:
        print(f"\n⚠️  WARNINGS:")
        for warning in warnings:
            print(f"   • {warning}")
        print(f"\n❌ System is NOT safe for deployment!")
        return False
    else:
        print(f"\n✅ System is safe for deployment!")
    
    # Monitor Docker containers
    print(f"\n🐳 Docker Container Status:")
    containers = check_docker_resources()
    if containers:
        for container in containers:
            name = container.get('Name', 'Unknown')
            cpu = container.get('CPUPerc', '0%').replace('%', '')
            memory = container.get('MemUsage', '0B / 0B')
            print(f"   • {name}: CPU {cpu}%, Memory {memory}")
    else:
        print("   No running containers")
    
    return True

def main():
    """Main monitoring function."""
    print("🚀 Pre-Deployment System Check")
    print("=" * 50)
    
    safe = monitor_deployment()
    
    if safe:
        print(f"\n✅ RECOMMENDATION: Safe to proceed with deployment")
        print(f"💡 SUGGESTED: Use docker-compose.safe.yml for conservative resource allocation")
    else:
        print(f"\n❌ RECOMMENDATION: DO NOT deploy - system resources are too high")
        print(f"💡 SUGGESTED: Free up resources or wait for lower usage")
    
    print(f"\n📋 Next Steps:")
    print(f"   1. If safe: docker-compose -f docker-compose.safe.yml up -d")
    print(f"   2. Monitor with: docker stats")
    print(f"   3. Check logs: docker-compose logs -f")
    print(f"   4. If issues: docker-compose down")

if __name__ == "__main__":
    main()
