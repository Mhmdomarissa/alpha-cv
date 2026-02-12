#!/bin/bash

# Disk Usage Monitoring Script
# This script checks disk usage and logs warnings when thresholds are exceeded

LOG_FILE="/home/ubuntu/disk-usage-monitor.log"
WARNING_THRESHOLD=80
CRITICAL_THRESHOLD=90

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check disk usage
check_disk_usage() {
    local mount_point=$1
    local usage=$(df -h "$mount_point" | awk 'NR==2 {print $5}' | sed 's/%//')
    local available=$(df -h "$mount_point" | awk 'NR==2 {print $4}')
    
    if [ "$usage" -ge "$CRITICAL_THRESHOLD" ]; then
        log_message "🚨 CRITICAL: $mount_point is ${usage}% full (Available: $available)"
        # Send notification or alert here if needed
    elif [ "$usage" -ge "$WARNING_THRESHOLD" ]; then
        log_message "⚠️  WARNING: $mount_point is ${usage}% full (Available: $available)"
    else
        log_message "✅ OK: $mount_point is ${usage}% full (Available: $available)"
    fi
}

# Main execution
log_message "=== Disk Usage Check Started ==="

# Check root filesystem
check_disk_usage "/"

# Check additional storage
check_disk_usage "/mnt/additional-storage"

# Check Docker volumes size
DOCKER_SIZE=$(sudo du -sh /var/lib/docker 2>/dev/null | awk '{print $1}')
log_message "📦 Docker data size: $DOCKER_SIZE"

# Check backups size
BACKUP_SIZE=$(sudo du -sh /mnt/additional-storage/backups 2>/dev/null | awk '{print $1}')
log_message "💾 Backups size: $BACKUP_SIZE"

log_message "=== Disk Usage Check Completed ==="
echo ""

