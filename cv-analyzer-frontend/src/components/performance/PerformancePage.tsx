'use client';

import React from 'react';
import PerformanceDashboard from './PerformanceDashboard';

const PerformancePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Performance</h1>
        <p className="text-gray-600">Real-time monitoring of system resources and performance metrics</p>
      </div>
      
      <PerformanceDashboard />
    </div>
  );
};

export default PerformancePage;
