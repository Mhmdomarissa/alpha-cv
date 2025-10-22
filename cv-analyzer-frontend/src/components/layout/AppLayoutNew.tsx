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
  User,
  Briefcase,
  Activity,
  Mail
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

const getNavigationTabs = (userRole?: 'admin' | 'user'): TabItem[] => {
  const baseTabs: TabItem[] = [
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

  // Add performance tab only for admin users
  if (userRole === 'admin') {
    console.log('DEBUG: Adding performance tab for admin user');
    baseTabs.push({
      id: 'performance',
      label: 'Performance',
      icon: Activity,
      description: 'System monitoring & metrics',
    });
  }

  // Add careers tab for all authenticated users (HR and admin)
  console.log('DEBUG getNavigationTabs - userRole:', userRole, 'type:', typeof userRole);
  if (userRole) {
    console.log('DEBUG: Adding careers tab for user role:', userRole);
    baseTabs.push({
      id: 'careers',
      label: 'Careers',
      icon: Briefcase,
      description: 'Manage job postings',
    });
  } else {
    console.log('DEBUG: No userRole provided, careers tab not added');
  }

  // Add email tab for all authenticated users
  if (userRole) {
    baseTabs.push({
      id: 'email',
      label: 'Email',
      icon: Mail,
      description: 'Email CV processing',
    });
  }

  return baseTabs;
};

export default function AppLayoutNew({ children }: AppLayoutProps) {
  const router = useRouter();
  const { currentTab, setCurrentTab, systemHealth, cvs, jds, matchResult } = useAppStore();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // FORCE DEBUG OUTPUT
  console.log('🔍 NAVIGATION DEBUG - User object:', user);
  console.log('🔍 NAVIGATION DEBUG - User role:', user?.role);
  console.log('🔍 NAVIGATION DEBUG - Calling getNavigationTabs with:', user?.role);
  const navigationTabs = getNavigationTabs(user?.role);
  console.log('🔍 NAVIGATION DEBUG - Result tabs:', navigationTabs.map(t => t.id));

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
      case 'performance':
        return 'System monitoring';
      case 'careers':
        return 'Job postings & applications';
      case 'email':
        return 'Process email CVs';
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
      case 'performance':
        return true; // Always available for monitoring
      case 'careers':
        return true; // Always available for admin users
      case 'email':
        return true; // Always available for authenticated users
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/40">
      {/* Top Navigation Bar - Modern SaaS Design */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-white/30 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand - Enhanced */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 group">
                <div className="w-8 h-8 rounded-lg group-hover:scale-105 transition-all duration-300 shadow-md">
                  <svg 
                    width="32" 
                    height="32" 
                    viewBox="0 0 200 200" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g transform="translate(0,200) scale(0.1,-0.1)" fill="#00529b">
                      <path d="M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m925 779 c-153 -31 -275 -94 -275 -142 0 -11 -20 -62 -44 -111 -25 -50 -50 -118 -57 -151 -11 -53 -10 -65 6 -99 26 -54 21 -90 -21 -159 -27 -46 -37 -74 -38 -107 l-1 -45 53 -3 52 -3 0 -38 c0 -23 6 -44 15 -51 11 -9 13 -16 5 -24 -16 -16 -12 -44 9 -56 17 -9 19 -18 14 -85 -5 -63 -3 -75 11 -81 31 -12 5 -24 -52 -24 -37 0 -66 6 -81 16 -22 16 -23 22 -18 91 5 66 4 74 -15 84 -16 9 -19 17 -14 44 4 19 2 36 -4 40 -5 3 -10 21 -10 40 0 36 -13 46 -53 38 -69 -13 -74 46 -12 163 25 46 45 91 45 98 0 7 -9 34 -20 58 -17 40 -18 53 -9 104 5 33 30 100 55 150 24 49 44 100 44 111 0 22 42 63 89 87 82 42 230 74 346 74 l70 0 -90 -19z m55 -1181 c27 -29 38 -73 45 -188 5 -72 4 -99 -7 -111 -14 -18 -119 -91 -123 -87 -2 2 2 27 8 56 9 43 8 64 -6 116 -9 36 -17 79 -17 98 -1 40 -25 111 -40 116 -5 2 -10 8 -10 13 0 5 29 9 65 9 53 0 68 -4 85 -22z"/>
                    </g>
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-blue-800 to-blue-600 bg-clip-text text-transparent">
                    Alpha CV
                  </h1>
                </div>
              </div>
            </div>

            {/* Navigation Tabs - Modern SaaS Style */}
            <nav className="hidden md:flex items-center space-x-1 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 border border-white/30 shadow-lg">
              {(() => {
                console.log('DEBUG: Current user:', user);
                console.log('DEBUG: User role:', user?.role);
                const tabs = getNavigationTabs(user?.role);
                console.log('DEBUG: Generated tabs:', tabs.map(t => t.id));
                return tabs;
              })().map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentTab(tab.id as any)}
                    className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
                      isActive 
                        ? 'shadow-lg' 
                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/90'
                    }`}
                    style={isActive ? {
                      background: 'rgba(0, 82, 155, 0.8)',
                      boxShadow: '0 4px 16px rgba(0, 82, 155, 0.3)',
                      color: '#ffffff'
                    } : {}}
                  >
                    <IconComponent className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'scale-110 text-white' : 'group-hover:scale-105'}`} />
                    <span className="font-medium text-sm" style={isActive ? { color: '#ffffff' } : {}}>{tab.label}</span>
                    {isCompleted && (
                      <div className={`w-2 h-2 rounded-full transition-all duration-200 ${isActive ? 'bg-white/80' : 'bg-green-500'}`} />
                    )}
                    {isActive && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User Info & Actions - Enhanced */}
            <div className="flex items-center space-x-4">
              {user && (
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/30 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">
                        {user.username}
                      </span>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: user.role === 'admin' ? '#fef2f2' : '#eff6ff',
                          color: user.role === 'admin' ? '#dc2626' : '#2563eb'
                        }}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-3 py-2 rounded-xl transition-all duration-200 text-slate-600 hover:text-slate-800 hover:bg-white/80 backdrop-blur-sm border border-transparent hover:border-white/30"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              )}

              
              {/* Mobile Menu Button - Enhanced */}
              <button
                className="md:hidden p-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 shadow-sm text-slate-600 hover:text-slate-800 hover:bg-white/90 transition-all duration-200"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Enhanced */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-white/30 shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <nav className="space-y-2">
              {getNavigationTabs(user?.role).map((tab) => {
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
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group ${
                      isActive 
                        ? 'shadow-lg' 
                        : 'bg-white/80 backdrop-blur-sm border border-white/30 text-slate-600 hover:bg-white/90 hover:text-slate-800'
                    }`}
                    style={isActive ? {
                      background: 'rgba(0, 82, 155, 0.8)',
                      boxShadow: '0 4px 16px rgba(0, 82, 155, 0.3)',
                      color: '#ffffff'
                    } : {}}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-white' : 'group-hover:scale-105'}`} />
                      <div className="text-left">
                        <div className="font-medium" style={isActive ? { color: '#ffffff' } : {}}>{tab.label}</div>
                        <div className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-500'}`} style={isActive ? { color: 'rgba(255, 255, 255, 0.8)' } : {}}>
                          {getTabStats(tab.id)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isCompleted && (
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/80' : 'bg-green-500'}`} />
                      )}
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}


      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
