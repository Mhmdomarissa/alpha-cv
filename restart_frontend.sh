#!/bin/bash
# Auto-restart frontend every 30 minutes to kill malware processes
while true; do
  sleep 1800  # 30 minutes
  echo "$(date): Restarting frontend to clear malware processes..."
  docker restart ubuntu_frontend_1
done
