'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  Thermometer,
  Zap,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Database,
  Container
} from 'lucide-react';
import { api } from '@/lib/api';

interface SystemStats {
  cpu: {
    percent: number;
    count: number;
    frequency: {
      current: number;
      min: number;
      max: number;
    };
    load_average: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
  };
  memory: {
    total: number;
    available: number;
    used: number;
    percent: number;
    swap: {
      total: number;
      used: number;
      free: number;
      percent: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
    io: {
      read_count: number;
      write_count: number;
      read_bytes: number;
      write_bytes: number;
    };
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
  };
}

interface GPUStats {
  index: number;
  name: string;
  gpu_utilization: number;
  memory_utilization: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  temperature: number;
  power_draw: number;
}

interface DockerStats {
  container: string;
  cpu_percent: string;
  memory_usage: string;
  memory_percent: string;
  network_io: string;
  block_io: string;
  pids: string;
}

interface PerformanceData {
  timestamp: number;
  system: SystemStats;
  gpu: GPUStats[];
  docker: DockerStats[];
  application: any;
  status: string;
}

const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  const fetchPerformanceData = async () => {
    try {
      setError(null);
      const data = await api.getSystemPerformance();
      setPerformanceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
      console.error('Performance data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchPerformanceData, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatFrequency = (hz: number): string => {
    if (hz >= 1000000000) return (hz / 1000000000).toFixed(2) + ' GHz';
    if (hz >= 1000000) return (hz / 1000000).toFixed(2) + ' MHz';
    return hz.toFixed(0) + ' Hz';
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }): string => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return <XCircle className="w-4 h-4 text-red-600" />;
    if (value >= thresholds.warning) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  if (loading && !performanceData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin mr-2" />
        <span>Loading performance data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Performance Data</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={fetchPerformanceData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!performanceData) return null;

  const { system, gpu, docker } = performanceData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Performance</h1>
          <p className="text-gray-600">Real-time monitoring of system resources and performance</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Auto Refresh:</label>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>
          <Button onClick={fetchPerformanceData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-2xl font-bold">{system.cpu.percent.toFixed(1)}%</p>
              </div>
              <Cpu className="w-8 h-8 text-blue-600" />
            </div>
            <Progress value={system.cpu.percent} className="mt-2" />
            <div className="flex items-center mt-2">
              {getStatusIcon(system.cpu.percent, { warning: 80, critical: 90 })}
              <span className={`text-sm ml-1 ${getStatusColor(system.cpu.percent, { warning: 80, critical: 90 })}`}>
                {system.cpu.count} cores
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                <p className="text-2xl font-bold">{system.memory.percent.toFixed(1)}%</p>
              </div>
              <MemoryStick className="w-8 h-8 text-green-600" />
            </div>
            <Progress value={system.memory.percent} className="mt-2" />
            <div className="flex items-center mt-2">
              {getStatusIcon(system.memory.percent, { warning: 80, critical: 90 })}
              <span className={`text-sm ml-1 ${getStatusColor(system.memory.percent, { warning: 80, critical: 90 })}`}>
                {formatBytes(system.memory.used)} / {formatBytes(system.memory.total)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disk Usage</p>
                <p className="text-2xl font-bold">{system.disk.percent.toFixed(1)}%</p>
              </div>
              <HardDrive className="w-8 h-8 text-purple-600" />
            </div>
            <Progress value={system.disk.percent} className="mt-2" />
            <div className="flex items-center mt-2">
              {getStatusIcon(system.disk.percent, { warning: 80, critical: 90 })}
              <span className={`text-sm ml-1 ${getStatusColor(system.disk.percent, { warning: 80, critical: 90 })}`}>
                {formatBytes(system.disk.used)} / {formatBytes(system.disk.total)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">GPU Usage</p>
                <p className="text-2xl font-bold">{gpu.length > 0 ? gpu[0].gpu_utilization.toFixed(1) : 0}%</p>
              </div>
              <Zap className="w-8 h-8 text-orange-600" />
            </div>
            <Progress value={gpu.length > 0 ? gpu[0].gpu_utilization : 0} className="mt-2" />
            <div className="flex items-center mt-2">
              {gpu.length > 0 ? getStatusIcon(gpu[0].gpu_utilization, { warning: 80, critical: 90 }) : <XCircle className="w-4 h-4 text-gray-400" />}
              <span className={`text-sm ml-1 ${gpu.length > 0 ? getStatusColor(gpu[0].gpu_utilization, { warning: 80, critical: 90 }) : 'text-gray-400'}`}>
                {gpu.length} GPU{gpu.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="gpu">GPU</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="w-5 h-5 mr-2" />
                  CPU Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>{system.cpu.percent.toFixed(1)}%</span>
                  </div>
                  <Progress value={system.cpu.percent} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Cores:</span>
                    <span className="ml-2 font-medium">{system.cpu.count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Frequency:</span>
                    <span className="ml-2 font-medium">{formatFrequency(system.cpu.frequency.current)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Load Average</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-medium">{system.cpu.load_average['1min'].toFixed(2)}</div>
                      <div className="text-gray-600">1 min</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{system.cpu.load_average['5min'].toFixed(2)}</div>
                      <div className="text-gray-600">5 min</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{system.cpu.load_average['15min'].toFixed(2)}</div>
                      <div className="text-gray-600">15 min</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MemoryStick className="w-5 h-5 mr-2" />
                  Memory Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>RAM Usage</span>
                    <span>{system.memory.percent.toFixed(1)}%</span>
                  </div>
                  <Progress value={system.memory.percent} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Used:</span>
                    <span className="ml-2 font-medium">{formatBytes(system.memory.used)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Available:</span>
                    <span className="ml-2 font-medium">{formatBytes(system.memory.available)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <span className="ml-2 font-medium">{formatBytes(system.memory.total)}</span>
                  </div>
                </div>
                {system.memory.swap.total > 0 && (
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Swap Usage</span>
                      <span>{system.memory.swap.percent.toFixed(1)}%</span>
                    </div>
                    <Progress value={system.memory.swap.percent} className="mt-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gpu" className="space-y-4">
          {gpu.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {gpu.map((gpuInfo, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Zap className="w-5 h-5 mr-2" />
                      GPU {gpuInfo.index}: {gpuInfo.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>GPU Utilization</span>
                        <span>{gpuInfo.gpu_utilization.toFixed(1)}%</span>
                      </div>
                      <Progress value={gpuInfo.gpu_utilization} className="mt-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Memory Utilization</span>
                        <span>{gpuInfo.memory_utilization.toFixed(1)}%</span>
                      </div>
                      <Progress value={gpuInfo.memory_utilization} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Memory Used:</span>
                        <span className="ml-2 font-medium">{gpuInfo.memory_used.toFixed(1)} MB</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Memory Total:</span>
                        <span className="ml-2 font-medium">{gpuInfo.memory_total.toFixed(1)} MB</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <span className="ml-2 font-medium">{gpuInfo.temperature.toFixed(1)}°C</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Power:</span>
                        <span className="ml-2 font-medium">{gpuInfo.power_draw.toFixed(1)}W</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No GPU Detected</h3>
                <p className="text-gray-500">No NVIDIA GPU found or nvidia-smi is not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="docker" className="space-y-4">
          {docker.length > 0 ? (
            <div className="space-y-4">
              {docker.map((container, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">{container.container}</h3>
                      <Badge variant="outline">{container.pids} PIDs</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">CPU</div>
                        <div className="font-medium">{container.cpu_percent}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Memory</div>
                        <div className="font-medium">{container.memory_usage}</div>
                        <div className="text-xs text-gray-500">{container.memory_percent}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Network I/O</div>
                        <div className="font-medium text-xs">{container.network_io}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Container className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Docker Containers</h3>
                <p className="text-gray-500">No running Docker containers found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="w-5 h-5 mr-2" />
                Network Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Data Transfer</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bytes Sent:</span>
                      <span className="font-medium">{formatBytes(system.network.bytes_sent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bytes Received:</span>
                      <span className="font-medium">{formatBytes(system.network.bytes_recv)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Packets</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packets Sent:</span>
                      <span className="font-medium">{system.network.packets_sent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Packets Received:</span>
                      <span className="font-medium">{system.network.packets_recv.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceDashboard;
