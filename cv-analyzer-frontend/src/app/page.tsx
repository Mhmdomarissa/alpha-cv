'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import AppLayoutNew from '@/components/layout/AppLayoutNew';
import DashboardPage from '@/components/dashboard/DashboardPage';
import UploadPageNew from '@/components/upload/UploadPageNew';
import DatabasePageNew from '@/components/database/DatabasePageNew';
import MatchingPageNew from '@/components/results/MatchingPageNew';
import SystemPanel from '@/components/system/SystemPanel';
import ReportGenerator from '@/components/reports/ReportGenerator';
import { CareersPage } from '@/components/careers';
import PerformancePage from '@/components/performance/PerformancePage';
import ErrorBanner from '@/components/common/ErrorBanner';
import { LoadingPage } from '@/components/ui/loading';
import Protected from '@/components/layout/Protected';

export default function HomePage() {
  const { currentTab, systemHealth, loadSystemHealth, loadingStates } = useAppStore();

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
          <div className="animate-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </AppLayoutNew>
    </Protected>
  );
}