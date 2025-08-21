'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiMethods } from '@/lib/api';
import toast from 'react-hot-toast';

const TestApiButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    health?: { status?: string };
    systemStatus?: { status?: string };
    jds?: { jds?: unknown[] };
    cvs?: { cvs?: unknown[] };
  } | null>(null);

  const testAPIs = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Testing Backend APIs...');
      
      // Test health
      const health = await apiMethods.getHealth();
      console.log('✅ Health:', health);

      // Test system status
      const systemStatus = await apiMethods.getSystemStatus();
      console.log('✅ System Status:', systemStatus);

      // Test list JDs
      const jds = await fetch('/api/jobs/list-jds').then(res => res.json());
      console.log('✅ Job Descriptions:', jds);

      // Test list CVs
      const cvs = await fetch('/api/jobs/list-cvs').then(res => res.json());
      console.log('✅ CVs:', cvs);

      setResults({
        health,
        systemStatus,
        jds,
        cvs
      });

      toast.success('All API tests passed! Check console for details.');
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      toast.error('API test failed. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={testAPIs}
        disabled={isLoading}
        variant="primary"
        size="sm"
        className="shadow-lg"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            Testing APIs...
          </>
        ) : (
          'Test Backend APIs'
        )}
      </Button>
      
      {results && (
        <div className="mt-2 p-3 bg-white border rounded-lg shadow-lg max-w-sm text-xs">
          <div className="font-semibold text-green-600 mb-2">✅ API Tests Passed</div>
          <div>Health: {results.health?.status}</div>
          <div>System: {results.systemStatus?.status}</div>
          <div>JDs: {results.jds?.jds?.length || 0}</div>
          <div>CVs: {results.cvs?.cvs?.length || 0}</div>
        </div>
      )}
    </div>
  );
};

export default TestApiButton;