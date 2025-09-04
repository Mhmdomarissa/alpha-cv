'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Home,
  Upload, 
  Database, 
  Target, 
  BarChart3,
  CheckCircle,
  Menu,
  X,
  ChevronRight,
  Users,
  FileText,
  Clock,
  Zap,
  LogOut,
  User
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

interface AppLayoutProps {
  children: ReactNode;
}

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

const navigationTabs: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    description: 'Overview and quick actions',
  },
  {
    id: 'upload',
    label: 'Upload',
    icon: Upload,
    description: 'Upload documents',
  },
  {
    id: 'database',
    label: 'Database',
    icon: Database,
    description: 'Manage documents',
  },
  {
    id: 'match',
    label: 'Match',
    icon: Target,
    description: 'AI matching results',
  },
];

export default function AppLayoutNew({ children }: AppLayoutProps) {
  const router = useRouter();
  const { currentTab, setCurrentTab, systemHealth, cvs, jds, matchResult } = useAppStore();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getTabStats = (tabId: string) => {
    switch (tabId) {
      case 'dashboard':
        return `${cvs.length + jds.length} documents`;
      case 'upload':
        return 'Ready to upload';
      case 'database':
        return `${cvs.length} CVs, ${jds.length} JDs`;
      case 'match':
        return matchResult ? `${matchResult.candidates.length} matches` : 'No matches yet';
      default:
        return '';
    }
  };

  const getProgress = (tabId: string) => {
    switch (tabId) {
      case 'dashboard':
        return true;
      case 'upload':
        return cvs.length > 0 || jds.length > 0;
      case 'database':
        return cvs.length > 0 && jds.length > 0;
      case 'match':
        return !!matchResult;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
      {/* Top Navigation Bar */}
      <header className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="heading-sm" style={{ color: 'var(--gray-900)' }}>Alpha CV</h1>
                  <p className="text-xs" style={{ color: 'var(--gray-500)' }}>AI-Powered Matching</p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs - Desktop */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigationTabs.map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id as any)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 group"
                    style={{
                      backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                      color: isActive ? 'var(--primary-600)' : 'var(--gray-600)',
                      border: isActive ? '1px solid var(--primary-200)' : '1px solid transparent',
                    }}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="font-medium text-sm">{tab.label}</span>
                    {isCompleted && (
                      <CheckCircle className="w-3 h-3" style={{ color: 'var(--green-500)' }} />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              {user && (
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4" style={{ color: 'var(--gray-500)' }} />
                    <span className="text-sm" style={{ color: 'var(--gray-700)' }}>
                      {user.username}
                    </span>
                    <span 
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ 
                        backgroundColor: user.role === 'admin' ? 'var(--red-100)' : 'var(--blue-100)',
                        color: user.role === 'admin' ? 'var(--red-800)' : 'var(--blue-800)'
                      }}
                    >
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 px-3 py-1 rounded-lg transition-colors"
                    style={{ 
                      color: 'var(--gray-600)',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}

              {/* System Status */}
              <div className="hidden sm:flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: systemHealth?.status === 'healthy' ? 'var(--green-500)' : 'var(--yellow-500)' 
                  }}
                />
                <span className="text-sm" style={{ color: 'var(--gray-600)' }}>
                  {systemHealth?.status === 'healthy' ? 'System Online' : 'Checking...'}
                </span>
              </div>
              
              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 rounded-lg"
                style={{ color: 'var(--gray-600)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
          <div className="container mx-auto px-4 py-4">
            <nav className="space-y-2">
              {navigationTabs.map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setCurrentTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                      color: isActive ? 'var(--primary-600)' : 'var(--gray-600)',
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs" style={{ color: 'var(--gray-500)' }}>
                          {getTabStats(tab.id)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isCompleted && (
                        <CheckCircle className="w-4 h-4" style={{ color: 'var(--green-500)' }} />
                      )}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Workflow Steps Indicator */}
      <div className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: cvs.length > 0 || jds.length > 0 ? 'var(--green-500)' : 'var(--gray-300)',
                  color: cvs.length > 0 || jds.length > 0 ? 'white' : 'var(--gray-600)',
                }}
              >
                1
              </div>
              <span 
                className="text-sm font-medium"
                style={{ 
                  color: cvs.length > 0 || jds.length > 0 ? 'var(--green-600)' : 'var(--gray-500)' 
                }}
              >
                Upload Files
              </span>
            </div>

            <ChevronRight className="w-4 h-4" style={{ color: 'var(--gray-400)' }} />

            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: cvs.length > 0 && jds.length > 0 ? 'var(--green-500)' : 'var(--gray-300)',
                  color: cvs.length > 0 && jds.length > 0 ? 'white' : 'var(--gray-600)',
                }}
              >
                2
              </div>
              <span 
                className="text-sm font-medium"
                style={{ 
                  color: cvs.length > 0 && jds.length > 0 ? 'var(--green-600)' : 'var(--gray-500)' 
                }}
              >
                Review Data
              </span>
            </div>

            <ChevronRight className="w-4 h-4" style={{ color: 'var(--gray-400)' }} />

            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: matchResult ? 'var(--green-500)' : 'var(--gray-300)',
                  color: matchResult ? 'white' : 'var(--gray-600)',
                }}
              >
                3
              </div>
              <span 
                className="text-sm font-medium"
                style={{ 
                  color: matchResult ? 'var(--green-600)' : 'var(--gray-500)' 
                }}
              >
                Run Match
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
