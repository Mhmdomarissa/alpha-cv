'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { apiMethods } from '@/lib/api';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface TestResult {
  status: 'success' | 'error';
  data?: unknown;
  error?: unknown;
}

const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const { uploadedFiles, isAnalyzing, cvs, jobDescriptions } = useAppStore();

  const runTests = async () => {
    console.log('🧪 Running comprehensive tests...');
    const results: Record<string, TestResult> = {};

    try {
      // Test 1: Backend Health
      console.log('🏥 Testing backend health...');
      const health = await apiMethods.getHealth();
      results.backendHealth = { status: 'success', data: health };
      console.log('✅ Backend health OK');
    } catch (error) {
      results.backendHealth = { status: 'error', error: error };
      console.log('❌ Backend health failed:', error);
    }

    try {
      // Test 2: System Status
      console.log('⚙️ Testing system status...');
      const status = await apiMethods.getSystemStatus();
      results.systemStatus = { status: 'success', data: status };
      console.log('✅ System status OK');
    } catch (error) {
      results.systemStatus = { status: 'error', error: error };
      console.log('❌ System status failed:', error);
    }

    try {
      // Test 3: List CVs
      console.log('📄 Testing CV listing...');
      const cvResponse = await apiMethods.listCVs();
      results.listCVs = { status: 'success', data: cvResponse };
      console.log('✅ CV listing OK');
    } catch (error) {
      results.listCVs = { status: 'error', error: error };
      console.log('❌ CV listing failed:', error);
    }

    try {
      // Test 4: List JDs
      console.log('📋 Testing JD listing...');
      const jdResponse = await apiMethods.listJDs();
      results.listJDs = { status: 'success', data: jdResponse };
      console.log('✅ JD listing OK');
    } catch (error) {
      results.listJDs = { status: 'error', error: error };
      console.log('❌ JD listing failed:', error);
    }

    setTestResults(results);
    console.log('🧪 All tests completed:', results);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
        >
          🧪 Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Debug Panel
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="sm"
            >
              ✕
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <div><strong>Uploaded Files:</strong> {uploadedFiles.length}</div>
            <div><strong>Is Analyzing:</strong> {isAnalyzing ? 'Yes' : 'No'}</div>
            <div><strong>CVs in Store:</strong> {cvs.length}</div>
            <div><strong>JDs in Store:</strong> {jobDescriptions.length}</div>
          </div>

          <Button onClick={runTests} size="sm" className="w-full">
            Run API Tests
          </Button>

          {Object.keys(testResults).length > 0 && (
            <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(testResults).map(([test, result]) => (
                <div key={test} className="border rounded p-2">
                  <div className="font-medium">
                    {test}: {result.status === 'success' ? '✅' : '❌'}
                  </div>
                  {result.status === 'error' && (
                    <div className="text-sm text-red-600">
                      {(result.error as Error)?.message || 'Unknown error'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPanel;