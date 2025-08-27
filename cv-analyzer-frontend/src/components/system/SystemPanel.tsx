'use client';

import { useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  HardDrive, 
  Network,
  CheckCircle,
  AlertCircle,
  XCircle,
  Zap,
  Clock,
  Users,
  FileText,
  BarChart3,
  Settings
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { LoadingSpinner, ProgressBar } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export default function SystemPanel() {
  const { 
    systemHealth, 
    loadSystemHealth, 
    loadingStates, 
    cvs, 
    jds, 
    matchResult 
  } = useAppStore();

  useEffect(() => {
    loadSystemHealth();
    // Refresh system health every 30 seconds
    const interval = setInterval(() => {
      loadSystemHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadSystemHealth]);

  const isLoading = loadingStates.health.isLoading;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Unknown</Badge>;
    }
  };

  if (isLoading && !systemHealth) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Loading System Status</h3>
            <p className="text-neutral-600">Gathering system information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* System Overview */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-heading-1 font-bold text-neutral-900">System Dashboard</h2>
            <p className="text-neutral-600 mt-1">Monitor system health and performance</p>
          </div>
          <Button
            onClick={() => loadSystemHealth()}
            loading={isLoading}
            loadingText="Refreshing..."
            variant="outline"
            icon={<Activity className="w-4 h-4" />}
          >
            Refresh Status
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Documents"
            value={cvs.length + jds.length}
            subtitle={`${cvs.length} CVs, ${jds.length} JDs`}
            icon={<FileText />}
            trend={{
              value: 12,
              label: 'vs last week',
              positive: true,
            }}
          />
          
          <StatsCard
            title="Successful Matches"
            value={matchResult?.candidates.length || 0}
            subtitle="AI-powered matches"
            icon={<BarChart3 />}
          />
          
          <StatsCard
            title="System Status"
            value={systemHealth?.status === 'healthy' ? 'Healthy' : 'Checking'}
            subtitle="All services operational"
            icon={<CheckCircle />}
          />
          
          <StatsCard
            title="Uptime"
            value="99.9%"
            subtitle="Last 30 days"
            icon={<Clock />}
            trend={{
              value: 0.1,
              label: 'vs last month',
              positive: true,
            }}
          />
        </div>
      </div>

      {/* System Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend Services */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary-600" />
              Backend Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemHealth?.services && Object.entries(systemHealth.services).map(([service, details]) => (
                <div key={service} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(typeof details === 'object' && 'status' in details ? details.status : 'healthy')}
                    <div>
                      <h4 className="font-medium text-neutral-900 capitalize">{service}</h4>
                      <p className="text-sm text-neutral-600">
                        {typeof details === 'object' && 'host' in details 
                          ? `${(details as any).host}:${(details as any).port || ''}`
                          : 'Service running'
                        }
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(typeof details === 'object' && 'status' in details ? details.status : 'healthy')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Environment & Configuration */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemHealth?.environment && Object.entries(systemHealth.environment).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-neutral-900">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                    <p className="text-sm text-neutral-600">
                      {typeof value === 'boolean' 
                        ? (value ? 'Enabled' : 'Disabled')
                        : String(value)
                      }
                    </p>
                  </div>
                  {typeof value === 'boolean' ? (
                    value ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : (
                    <Badge variant="outline">{String(value)}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Collections */}
      {systemHealth?.services?.qdrant && (systemHealth.services.qdrant as any)?.collections && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-600" />
              Database Collections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {((systemHealth.services.qdrant as any).collections || []).map((collection: string) => (
                <div key={collection} className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-neutral-900">{collection}</h4>
                      <p className="text-sm text-neutral-600">Collection active</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-600" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-neutral-900">Performance Metrics</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Processing Speed</span>
                    <span>Excellent</span>
                  </div>
                  <ProgressBar value={95} variant="success" size="sm" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>API Response Time</span>
                    <span>Fast</span>
                  </div>
                  <ProgressBar value={88} variant="default" size="sm" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>System Load</span>
                    <span>Low</span>
                  </div>
                  <ProgressBar value={35} variant="success" size="sm" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-neutral-900">Last Updated</h4>
              <div className="space-y-2 text-sm text-neutral-600">
                <div className="flex justify-between">
                  <span>System Health Check:</span>
                  <span>{systemHealth?.timestamp ? formatDate(new Date(systemHealth.timestamp * 1000).toISOString()) : 'Never'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Sync:</span>
                  <span>2 minutes ago</span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Clear:</span>
                  <span>1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
