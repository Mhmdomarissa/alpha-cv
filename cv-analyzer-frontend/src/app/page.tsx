'use client';
import { useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore, readPersistedMainTab } from '@/stores/appStore';
import AppLayoutNew from '@/components/layout/AppLayoutNew';
import ErrorBanner from '@/components/common/ErrorBanner';
import { LoadingPage } from '@/components/ui/loading';
import Protected from '@/components/layout/Protected';

const DashboardPage = dynamic(() => import('@/components/dashboard/DashboardPage'), { loading: () => <LoadingPage title="Loading..." subtitle="Dashboard" /> });
const UploadPageNew = dynamic(() => import('@/components/upload/UploadPageNew'), { loading: () => <LoadingPage title="Loading..." subtitle="Upload" /> });
const DatabasePageNew = dynamic(() => import('@/components/database/DatabasePageNew'), { loading: () => <LoadingPage title="Loading..." subtitle="Database" /> });
const MatchingPageNew = dynamic(() => import('@/components/results/MatchingPageNew'), { loading: () => <LoadingPage title="Loading..." subtitle="Matching" /> });
const SystemPanel = dynamic(() => import('@/components/system/SystemPanel'), { loading: () => <LoadingPage title="Loading..." subtitle="System" /> });
const ReportGenerator = dynamic(() => import('@/components/reports/ReportGenerator'), { loading: () => <LoadingPage title="Loading..." subtitle="Reports" /> });
const CareersPage = dynamic(() => import('@/components/careers').then(m => ({ default: m.CareersPage })), { loading: () => <LoadingPage title="Loading..." subtitle="Careers" /> });
const PerformancePage = dynamic(() => import('@/components/performance/PerformancePage'), { loading: () => <LoadingPage title="Loading..." subtitle="Performance" /> });
const EmailPage = dynamic(() => import('@/components/email/EmailPage'), { loading: () => <LoadingPage title="Loading..." subtitle="Email" /> });

export default function HomePage() {
  const { currentTab, systemHealth, loadSystemHealth, loadingStates, setCurrentTab } = useAppStore();

  useLayoutEffect(() => {
    const tab = readPersistedMainTab();
    if (tab) setCurrentTab(tab);
  }, [setCurrentTab]);

  useEffect(() => {
    // Load system health on app startup
    if (!systemHealth) {
      loadSystemHealth();
    }
  }, [systemHealth, loadSystemHealth]);

  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'upload':
        return <UploadPageNew />;
      case 'database':
        return <DatabasePageNew />;
      case 'match':
        return <MatchingPageNew />;
      case 'careers':
        return <CareersPage />;
      case 'email':
        return <EmailPage />;
      case 'reports':
        return <ReportGenerator />;
      case 'system':
        return <SystemPanel />;
      case 'performance':
        return <PerformancePage />;
      default:
        return <LoadingPage title="Loading..." subtitle="Preparing your workspace" />;
    }
  };

  return (
    <Protected>
      <AppLayoutNew>
        <div className="space-y-6">
          {/* Global Error Messages */}
          <div className="space-y-2">
            {Object.entries(loadingStates).map(([operation, state]) => (
              state.error && (
                <ErrorBanner
                  key={operation}
                  error={state.error}
                  operation={operation}
                />
              )
            ))}
          </div>
          {/* Dynamic Tab Content */}
          <div>
            {renderTabContent()}
          </div>
        </div>
      </AppLayoutNew>
    </Protected>
  );
}