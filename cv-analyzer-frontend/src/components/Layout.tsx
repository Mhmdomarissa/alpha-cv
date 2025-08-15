'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  HomeIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import TestApiButton from './TestApiButton';
import DebugPanel from './DebugPanel';
import { isDevelopment } from '@/lib/config';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { currentTab, setCurrentTab, systemStatus, cvs, jobDescriptions } = useAppStore();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    // The AuthGuard will handle redirecting to login
  };

  const navigation = [
    {
      name: 'Home',
      icon: HomeIcon,
      tab: 'upload' as const,
      count: undefined,
    },
    {
      name: 'Database',
      icon: UserGroupIcon,
      tab: 'database' as const,
      count: cvs.length + jobDescriptions.length,
    },
    {
      name: 'Results',
      icon: ChartBarIcon,
      tab: 'results' as const,
      count: undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50">
      {/* Header */}
      <header className="bg-white shadow-soft border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                <DocumentTextIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-secondary-900">CV Analyzer</h1>
                <p className="text-xs text-secondary-600">AI-Powered Recruitment Platform</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-1">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant={currentTab === item.tab ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentTab(item.tab)}
                  className="relative"
                  leftIcon={<item.icon className="h-4 w-4" />}
                >
                  {item.name}
                  {item.count !== undefined && item.count > 0 && (
                    <Badge
                      variant={currentTab === item.tab ? 'secondary' : 'default'}
                      size="sm"
                      className="ml-2"
                    >
                      {item.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </nav>

            {/* User Menu and System Status */}
            <div className="flex items-center space-x-3">
              {/* System Status */}
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    systemStatus?.status === 'operational' ? 'bg-success-500' : 'bg-warning-500'
                  }`}
                />
                <span className="text-xs font-medium text-secondary-700">
                  {systemStatus?.status === 'operational' ? 'Online' : 'Limited'}
                </span>
              </div>
              
              {/* User Info */}
              {user && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-secondary-50 rounded-lg">
                    <UserIcon className="h-4 w-4 text-secondary-600" />
                    <span className="text-sm font-medium text-secondary-700">{user.username}</span>
                  </div>
                </div>
              )}
              
              {/* Settings */}
              <Button variant="ghost" size="icon" title="Settings">
                <CogIcon className="h-5 w-5" />
              </Button>
              
              {/* Logout */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                title="Sign out"
                className="text-secondary-600 hover:text-red-600 hover:bg-red-50"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* API Test Button */}
      <TestApiButton />

      {/* Footer */}
      <footer className="bg-white border-t border-secondary-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-secondary-600">
              © 2025 CV Analyzer Platform. Built with AI-powered matching technology.
            </div>
            <div className="flex items-center space-x-4 text-xs text-secondary-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>
                API: {systemStatus?.status === 'operational' ? 'Connected' : 'Disconnected'}
              </span>
              {systemStatus?.system_stats && (
                <>
                  <span>•</span>
                  <span>{systemStatus.system_stats.total_cvs} CVs</span>
                  <span>•</span>
                  <span>{systemStatus.system_stats.total_jds} Jobs</span>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>
      {isDevelopment && <DebugPanel />}
    </div>
  );
};

export default Layout;