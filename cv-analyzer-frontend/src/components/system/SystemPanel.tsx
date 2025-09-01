'use client';
import React, { useState } from 'react';
import {
  Server,
  Database,
  Activity,
  Zap,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message?: string;
  metrics?: {
    [key: string]: any;
  };
}

export default function SystemPanel() {
  const { 
    systemHealth, 
    systemStats, 
    databaseView,
    loadSystemHealth, 
    loadSystemStats, 
    loadDatabaseView 
  } = useAppStore();
  
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceDetails, setServiceDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };
  
  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };
  
  // Handle service details click
  const handleServiceClick = async (serviceName: string) => {
    if (selectedService === serviceName) {
      setSelectedService(null);
      setServiceDetails(null);
      return;
    }
    
    setSelectedService(serviceName);
    setLoadingDetails(true);
    
    try {
      // Simulate fetching service details
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock service details based on service name
      const mockDetails = {
        qdrant: {
          version: '1.7.4',
          collections: 3,
          total_points: systemStats?.stats?.database_stats?.total_documents || 0,
          memory_usage: '1.2 GB',
          disk_usage: '2.5 GB',
          uptime: '15d 4h 32m',
          config: {
            host: 'localhost',
            port: 6333,
            grpc_port: 6334,
          }
        },
        embedding: {
          model: 'all-mpnet-base-v2',
          dimension: 768,
          provider: 'sentence-transformers',
          device: 'cpu',
          cache_size: 1000,
          avg_request_time: '120ms'
        },
        cache: {
          provider: 'Redis',
          version: '7.0.5',
          memory_usage: '512 MB',
          hit_rate: '94.2%',
          keyspace_hits: 15420,
          keyspace_misses: 952
        }
      };
      
      setServiceDetails(mockDetails[serviceName as keyof typeof mockDetails]);
    } catch (error) {
      console.error('Failed to fetch service details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // Handle clear database
  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      await api.clearDatabase(true);
      // Refresh data
      await loadSystemStats();
      await loadDatabaseView();
      setShowClearDialog(false);
    } catch (error: any) {
      console.error('Failed to clear database:', error);
    } finally {
      setIsClearing(false);
    }
  };
  
  // Service health status
  const services: ServiceStatus[] = [
    {
      name: 'Qdrant',
      status: systemHealth?.services?.qdrant?.status === 'ok' ? 'healthy' : 'error',
      message: systemHealth?.services?.qdrant?.message || 'Vector database service',
      metrics: {
        collections: systemHealth?.services?.qdrant?.collections_count || 0,
        points: systemHealth?.services?.qdrant?.points_count || 0
      }
    },
    {
      name: 'Embedding',
      status: systemHealth?.services?.embedding?.status === 'ok' ? 'healthy' : 'error',
      message: systemHealth?.services?.embedding?.message || 'Embedding generation service',
      metrics: {
        model: systemStats?.stats?.system_info?.embedding_model || 'unknown',
        dimension: systemStats?.stats?.system_info?.embedding_dimension || 0
      }
    },
    {
      name: 'Cache',
      status: systemHealth?.services?.cache?.status === 'ok' ? 'healthy' : 'error',
      message: systemHealth?.services?.cache?.message || 'Cache service',
      metrics: {
        provider: 'Redis',
        keys: systemStats?.stats?.cache_stats?.total_keys || 0
      }
    }
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
          <p className="text-gray-600 mt-1">Monitor system health and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              loadSystemHealth();
              loadSystemStats();
              loadDatabaseView();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Overall System Status */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">System Health</h3>
              <p className="text-sm text-gray-600">Overall system status and last check</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(systemHealth?.status || 'unknown')}
                <span className="text-lg font-semibold capitalize">
                  {systemHealth?.status || 'Unknown'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Last checked: {systemHealth?.timestamp ? formatDate(systemHealth.timestamp) : 'Never'}
              </div>
            </div>
            <Badge className={getStatusColor(systemHealth?.status || 'unknown')}>
              {systemHealth?.status === 'healthy' ? 'All Systems Operational' : 'Issues Detected'}
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Services Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((service) => (
          <Card 
            key={service.name}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedService === service.name ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleServiceClick(service.name)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Server className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{service.name}</h4>
                    <p className="text-sm text-gray-600">{service.message}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(service.status)}>
                  {service.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {service.metrics && (
                <div className="space-y-2">
                  {Object.entries(service.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Service Details */}
      {selectedService && serviceDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-600" />
              <span>{selectedService} Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                <span>Loading details...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(serviceDetails).map(([key, value]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 capitalize mb-1">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-mono">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Database Statistics</h3>
              <p className="text-sm text-gray-600">Document storage and processing metrics</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {systemStats?.stats?.database_stats?.total_documents || 0}
              </div>
              <div className="text-sm text-blue-700">Total Documents</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {systemStats?.stats?.database_stats?.total_cvs || 0}
              </div>
              <div className="text-sm text-green-700">CVs</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {systemStats?.stats?.database_stats?.total_jds || 0}
              </div>
              <div className="text-sm text-purple-700">Job Descriptions</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {systemStats?.stats?.cv_analytics?.avg_skills_per_cv?.toFixed(1) || 0}
              </div>
              <div className="text-sm text-yellow-700">Avg Skills per CV</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Cpu className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">System Information</h3>
              <p className="text-sm text-gray-600">Environment and configuration details</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Embedding Model</div>
                <div className="text-sm font-mono">
                  {systemStats?.stats?.system_info?.embedding_model || 'Unknown'}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Vector Dimensions</div>
                <div className="text-sm font-mono">
                  {systemStats?.stats?.system_info?.embedding_dimension || 0}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Similarity Metric</div>
                <div className="text-sm font-mono">
                  {systemStats?.stats?.system_info?.similarity_metric || 'Unknown'}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Qdrant Host</div>
                <div className="text-sm font-mono">
                  {systemHealth?.environment?.qdrant_host || 'Unknown'}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Qdrant Port</div>
                <div className="text-sm font-mono">
                  {systemHealth?.environment?.qdrant_port || 'Unknown'}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">OpenAI Key</div>
                <div className="text-sm font-mono">
                  {systemHealth?.environment?.openai_key_configured ? 'Configured' : 'Not Configured'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Database Management */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-md">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Database Management</h3>
              <p className="text-sm text-neutral-500 font-normal">Clear all stored documents</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete all CVs and job descriptions from the database. This action cannot be undone.
              </AlertDescription>
            </Alert>
            
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="error"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Confirm Database Clear
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p>Are you sure you want to permanently delete all CVs and job descriptions?</p>
                  <p className="text-sm text-gray-500">This action cannot be undone.</p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="error"
                      onClick={handleClearDatabase}
                      disabled={isClearing}
                    >
                      {isClearing ? 'Clearing...' : 'Clear All Data'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}