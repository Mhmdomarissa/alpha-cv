'use client';

import { useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';
import Layout from '@/components/Layout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load heavy components for better performance
const UploadPage = lazy(() => import('@/components/UploadPage'));
const DatabasePage = lazy(() => import('@/components/DatabasePage'));
const ResultsPage = lazy(() => import('@/components/ResultsPage'));

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (renamed from cacheTime)
    },
  },
});

const AppContent = memo(function AppContent() {
  const { 
    currentTab, 
    setSystemStatus, 
    isLoading, 
    setLoading 
  } = useAppStore();

  const initializeApp = useCallback(async () => {
    console.log('🚀 Starting app initialization...');
    setLoading(true);
    
    try {
      // Initialize with minimal mock data for demo
      // TODO: Replace with actual API call when backend is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setSystemStatus({
        status: 'operational',
        timestamp: new Date().toISOString(),
        system_stats: {
          cpu_usage: 0,
          memory_usage: 0,
          disk_usage: 0,
          total_cvs: 0,
          total_jds: 0,
          processed_cvs: 0,
          processed_jds: 0,
        },
        services: {
          qdrant: {
            status: 'healthy',
            collections: 0,
            total_vectors: 0,
          },
          openai: {
            status: 'operational',
            model: 'gpt-4',
          },
        },
        performance: {
          average_response_time: 0,
          requests_per_minute: 0,
        },
      });
      
      console.log('✅ App initialization completed');
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      setSystemStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        system_stats: { cpu_usage: 0, memory_usage: 0, disk_usage: 0, total_cvs: 0, total_jds: 0, processed_cvs: 0, processed_jds: 0 },
        services: { qdrant: { status: 'error', collections: 0, total_vectors: 0 }, openai: { status: 'error', model: 'gpt-4' } },
        performance: { average_response_time: 0, requests_per_minute: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSystemStatus]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <LoadingSpinner size="xl" text="Initializing application..." />
        </div>
      </Layout>
    );
  }

  const renderCurrentTab = () => {
    const LoadingFallback = ({ message = 'Loading...' }: { message?: string }) => (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text={message} />
      </div>
    );

    switch (currentTab) {
      case 'upload':
        return (
          <Suspense fallback={<LoadingFallback message="Loading upload interface..." />}>
            <ErrorBoundary>
              <UploadPage />
            </ErrorBoundary>
          </Suspense>
        );
      case 'database':
        return (
          <Suspense fallback={<LoadingFallback message="Loading database view..." />}>
            <ErrorBoundary>
              <DatabasePage />
            </ErrorBoundary>
          </Suspense>
        );
      case 'results':
        return (
          <Suspense fallback={<LoadingFallback message="Loading results..." />}>
            <ErrorBoundary>
              <ResultsPage />
            </ErrorBoundary>
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      {renderCurrentTab()}
    </Layout>
  );
});

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            fontSize: '14px',
            padding: '12px 16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}