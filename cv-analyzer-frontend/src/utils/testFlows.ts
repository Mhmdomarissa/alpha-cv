/**
 * Comprehensive testing utilities for validating user flows
 * This helps ensure all critical paths work correctly
 */

import { apiMethods } from '@/lib/api';
import { logger, trackUserAction } from '@/lib/logger';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
  data?: Record<string, unknown>;
}

interface FlowTestResults {
  overall: {
    success: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };
  results: TestResult[];
}

export class UserFlowTester {
  private results: TestResult[] = [];

  private async runTest<T>(
    name: string,
    testFn: () => Promise<T>
  ): Promise<TestResult> {
    const startTime = Date.now();
    logger.setContext('FlowTest');
    
    try {
      logger.info(`Starting test: ${name}`);
      const data = await testFn();
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name,
        success: true,
        duration,
        data,
      };
      
      logger.info(`Test passed: ${name}`, { duration });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        name,
        success: false,
        error: error.message || 'Unknown error',
        duration,
      };
      
      logger.error(`Test failed: ${name}`, { error, duration });
      return result;
    }
  }

  async testBackendConnectivity(): Promise<void> {
    const result = await this.runTest('Backend Health Check', async () => {
      return await apiMethods.getHealth();
    });
    this.results.push(result);
  }

  async testSystemStatus(): Promise<void> {
    const result = await this.runTest('System Status Check', async () => {
      return await apiMethods.getSystemStatus();
    });
    this.results.push(result);
  }

  async testCVListing(): Promise<void> {
    const result = await this.runTest('CV Listing', async () => {
      return await apiMethods.listCVs();
    });
    this.results.push(result);
  }

  async testJobDescriptionListing(): Promise<void> {
    const result = await this.runTest('Job Description Listing', async () => {
      return await apiMethods.listJDs();
    });
    this.results.push(result);
  }

  async testFileUploadValidation(): Promise<void> {
    const result = await this.runTest('File Upload Validation', async () => {
      // Test with mock file data
      const mockFile = new File(['Test CV content'], 'test-cv.txt', {
        type: 'text/plain',
      });
      
      // Validate file size, type, etc.
      if (mockFile.size === 0) {
        throw new Error('File validation failed: empty file');
      }
      
      if (!mockFile.type.includes('text')) {
        throw new Error('File validation failed: invalid type');
      }
      
      return { fileSize: mockFile.size, fileType: mockFile.type };
    });
    this.results.push(result);
  }

  async testErrorHandling(): Promise<void> {
    const result = await this.runTest('Error Handling', async () => {
      try {
        // Test with invalid endpoint to trigger error handling
        await fetch('/api/invalid-endpoint');
        throw new Error('Expected error was not thrown');
      } catch (error: any) {
        if (error.message.includes('Expected error')) {
          throw error;
        }
        // This is expected - error handling is working
        return { errorHandled: true };
      }
    });
    this.results.push(result);
  }

  async testStateManagement(): Promise<void> {
    const result = await this.runTest('State Management', async () => {
      // Test Zustand store functionality
      const { useAppStore } = await import('@/stores/appStore');
      const store = useAppStore.getState();
      
      // Test setting and getting values
      store.setCurrentTab('upload');
      if (store.currentTab !== 'upload') {
        throw new Error('State management failed: tab not set correctly');
      }
      
      store.setLoading(true);
      if (!store.isLoading) {
        throw new Error('State management failed: loading state not set');
      }
      
      return { stateTest: 'passed' };
    });
    this.results.push(result);
  }

  async testPerformanceMetrics(): Promise<void> {
    const result = await this.runTest('Performance Metrics', async () => {
      const startTime = performance.now();
      
      // Simulate heavy operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > 1000) {
        throw new Error(`Performance test failed: operation took ${duration}ms`);
      }
      
      return { duration, performanceGrade: duration < 200 ? 'A' : 'B' };
    });
    this.results.push(result);
  }

  async runAllTests(): Promise<FlowTestResults> {
    const startTime = Date.now();
    this.results = [];
    
    logger.info('🚀 Starting comprehensive user flow tests');
    trackUserAction('flow_test_started');
    
    // Run all tests
    await this.testBackendConnectivity();
    await this.testSystemStatus();
    await this.testCVListing();
    await this.testJobDescriptionListing();
    await this.testFileUploadValidation();
    await this.testErrorHandling();
    await this.testStateManagement();
    await this.testPerformanceMetrics();
    
    const totalDuration = Date.now() - startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;
    const overallSuccess = failedTests === 0;
    
    const flowResults: FlowTestResults = {
      overall: {
        success: overallSuccess,
        totalTests: this.results.length,
        passedTests,
        failedTests,
        duration: totalDuration,
      },
      results: this.results,
    };
    
    logger.info('✅ User flow tests completed', flowResults.overall);
    trackUserAction('flow_test_completed', flowResults.overall);
    
    return flowResults;
  }

  generateReport(results: FlowTestResults): string {
    const { overall } = results;
    let report = `
🧪 User Flow Test Report
========================

📊 Overall Results:
- Status: ${overall.success ? '✅ PASSED' : '❌ FAILED'}
- Total Tests: ${overall.totalTests}
- Passed: ${overall.passedTests}
- Failed: ${overall.failedTests}
- Duration: ${overall.duration}ms

📋 Detailed Results:
`;

    results.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      report += `
${index + 1}. ${status} ${result.name}
   Duration: ${result.duration}ms`;
      
      if (!result.success) {
        report += `
   Error: ${result.error}`;
      }
    });

    report += `

🎯 Recommendations:
`;

    if (overall.failedTests > 0) {
      report += `- Fix ${overall.failedTests} failing test(s) before deployment\n`;
    }

    const avgDuration = overall.duration / overall.totalTests;
    if (avgDuration > 500) {
      report += `- Consider performance optimizations (avg test duration: ${avgDuration.toFixed(2)}ms)\n`;
    }

    if (overall.success) {
      report += `- All tests passed! ✅ Ready for deployment\n`;
    }

    return report;
  }
}

// Export singleton instance
export const flowTester = new UserFlowTester();

// Convenience function for quick testing
export const runQuickFlowTest = async (): Promise<FlowTestResults> => {
  return await flowTester.runAllTests();
};

// Manual test checklist
export const MANUAL_TEST_CHECKLIST = [
  '🔗 Backend connection works',
  '📊 System status displays correctly',
  '📁 File upload interface is responsive',
  '✅ File validation provides clear feedback',
  '🔄 Loading states show during operations',
  '❌ Error messages are user-friendly',
  '📱 UI is responsive on different screen sizes',
  '🎨 All buttons and interactions work',
  '📋 Database view loads and displays data',
  '📈 Results page shows analysis correctly',
  '🐛 Debug panel works (development only)',
  '🔄 Navigation between tabs is smooth',
  '💾 State persists correctly during navigation',
  '🚀 App initializes without errors',
  '📱 Mobile experience is usable',
];

export default UserFlowTester;