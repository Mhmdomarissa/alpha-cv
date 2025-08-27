'use client';

import { useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Badge } from '@/components/ui/badge';

export default function HealthBadge() {
  const { systemHealth, loadSystemHealth, loadingStates } = useAppStore();

  useEffect(() => {
    // Load health status on mount
    if (!systemHealth) {
      loadSystemHealth();
    }

    // Set up periodic health checks every 30 seconds
    const interval = setInterval(() => {
      loadSystemHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [systemHealth, loadSystemHealth]);

  const isLoading = loadingStates.health.isLoading;
  const hasError = loadingStates.health.error;

  if (isLoading && !systemHealth) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (hasError) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  if (!systemHealth) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Unknown
      </Badge>
    );
  }

  const getStatusIcon = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return <CheckCircle className="h-3 w-3" />;
      case 'degraded':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <XCircle className="h-3 w-3" />;
    }
  };

  const getStatusVariant = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return 'success' as const;
      case 'degraded':
        return 'warning' as const;
      default:
        return 'destructive' as const;
    }
  };

  const getStatusText = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return 'Healthy';
      case 'degraded':
        return 'Degraded';
      default:
        return 'Unhealthy';
    }
  };

  return (
    <Badge variant={getStatusVariant()} className="flex items-center gap-1">
      {getStatusIcon()}
      {getStatusText()}
    </Badge>
  );
}
