'use client';

import { ReactNode, useState } from 'react';
import { 
  Upload, 
  Database, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  ChevronRight,
  Zap,
  Users,
  FileText,
  Target
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  disabled?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'upload',
    label: 'Upload & Process',
    icon: Upload,
    description: 'Upload CVs and job descriptions',
    badge: 'Start here',
  },
  {
    id: 'database',
    label: 'Document Database',
    icon: Database,
    description: 'Browse and manage uploaded documents',
  },
  {
    id: 'results',
    label: 'Matching Results',
    icon: BarChart3,
    description: 'View AI-powered matching insights',
  },
  {
    id: 'reports',
    label: 'Analytics & Reports',
    icon: FileText,
    description: 'Generate comprehensive reports and insights',
  },
  {
    id: 'system',
    label: 'System Status',
    icon: Settings,
    description: 'Monitor system health and settings',
  },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { currentTab, setCurrentTab, systemHealth, cvs, jds, matchResult } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getTabStats = (tabId: string) => {
    switch (tabId) {
      case 'upload':
        return `${cvs.length + jds.length} processed`;
      case 'database':
        return `${cvs.length} CVs, ${jds.length} JDs`;
      case 'results':
        return matchResult ? `${matchResult.candidates.length} matches` : 'No matches yet';
      case 'reports':
        return 'PDF Export Ready';
      case 'system':
        return systemHealth?.status === 'healthy' ? 'All systems operational' : 'Checking...';
      default:
        return '';
    }
  };

  const getTabProgress = (tabId: string) => {
    switch (tabId) {
      case 'upload':
        return cvs.length > 0 || jds.length > 0;
      case 'database':
        return cvs.length > 0 && jds.length > 0;
      case 'results':
        return !!matchResult;
      case 'reports':
        return true; // Always available
      case 'system':
        return systemHealth?.status === 'healthy';
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-primary-50/30">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-80 transform bg-white border-r border-neutral-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-heading-3 font-bold text-neutral-900">Alpha CV</h1>
                <p className="text-sm text-neutral-500">AI-Powered Matching</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6">
            <div className="space-y-2">
              {navigationItems.map((item, index) => {
                const isActive = currentTab === item.id;
                const isCompleted = getTabProgress(item.id);
                const Icon = item.icon;
                const stats = getTabStats(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id as any);
                      setSidebarOpen(false);
                    }}
                    disabled={item.disabled}
                    className={cn(
                      'w-full group relative flex items-center p-4 rounded-xl text-left transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                        : 'hover:bg-neutral-100 text-neutral-700',
                      item.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {/* Progress Indicator */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-gradient-to-b from-primary-500 to-accent-500 transform transition-transform duration-300 origin-top"
                      style={{ 
                        transform: `scaleY(${isCompleted ? 1 : 0})`,
                        opacity: isActive ? 0 : (isCompleted ? 1 : 0)
                      }} 
                    />

                    <div className="flex items-center space-x-4 flex-1">
                      <div className={cn(
                        'flex-shrink-0 p-2 rounded-lg transition-colors',
                        isActive 
                          ? 'bg-white/20' 
                          : 'bg-neutral-100 group-hover:bg-neutral-200'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          isActive ? 'text-white' : 'text-neutral-600'
                        )} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className={cn(
                            'font-medium truncate',
                            isActive ? 'text-white' : 'text-neutral-900'
                          )}>
                            {item.label}
                          </h3>
                          {item.badge && !isActive && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                              {item.badge}
                            </span>
                          )}
                          {isCompleted && !isActive && (
                            <div className="w-2 h-2 bg-accent-500 rounded-full" />
                          )}
                        </div>
                        <p className={cn(
                          'text-sm truncate mt-0.5',
                          isActive ? 'text-white/80' : 'text-neutral-500'
                        )}>
                          {item.description}
                        </p>
                        {stats && (
                          <p className={cn(
                            'text-xs mt-1 truncate',
                            isActive ? 'text-white/60' : 'text-neutral-400'
                          )}>
                            {stats}
                          </p>
                        )}
                      </div>

                      {isActive && (
                        <ChevronRight className="w-4 h-4 text-white/80" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-neutral-200">
            <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900">Quick Stats</p>
                <p className="text-xs text-neutral-500 truncate">
                  {cvs.length} CVs • {jds.length} JDs • {matchResult?.candidates.length || 0} matches
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-80">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                
                <div>
                  <h1 className="text-heading-2 font-bold text-neutral-900">
                    {navigationItems.find(item => item.id === currentTab)?.label}
                  </h1>
                  <p className="text-sm text-neutral-500">
                    {navigationItems.find(item => item.id === currentTab)?.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* System Health Indicator */}
                <div className="hidden sm:flex items-center space-x-2">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    systemHealth?.status === 'healthy' ? 'bg-accent-500' : 'bg-yellow-500'
                  )} />
                  <span className="text-sm text-neutral-600">
                    {systemHealth?.status === 'healthy' ? 'System Healthy' : 'Checking...'}
                  </span>
                </div>

                {/* User Avatar Placeholder */}
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
