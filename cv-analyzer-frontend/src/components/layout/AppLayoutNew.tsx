'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Users,
  FileText,
  Clock,
  Zap,
  LogOut,
  User,
  Briefcase,
  Activity,
  Mail,
  Settings,
  Shield,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import MatchingProgressBar from '@/components/ui/MatchingProgressBar';

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

function roleBadgeClasses(role?: string) {
  if (role === 'admin') return 'bg-red-50 text-red-700';
  if (role === 'manager') return 'bg-violet-50 text-violet-700';
  if (role === 'evp') return 'bg-violet-50 text-violet-700';
  if (role === 'recruiter') return 'bg-teal-50 text-teal-700';
  return 'bg-blue-50 text-blue-700';
}

const getNavigationTabs = (userRole?: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp'): TabItem[] => {
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

  // Add careers tab for all authenticated users (HR and admin)
  if (userRole) {
    baseTabs.push({
      id: 'careers',
      label: 'Careers',
      icon: Briefcase,
      description: 'Manage job postings',
    });
  }

  // Candidate Tracker entry (server-side feature flag still enforced by API).
  if (userRole && ['admin', 'user', 'recruiter', 'manager', 'evp'].includes(userRole)) {
    baseTabs.push({
      id: 'tracker',
      label: 'Tracker',
      icon: Users,
      description: 'Candidate tracker',
    });
  }

  // Performance and Email are under "Advanced" dropdown (admin only) - not added to baseTabs here
  return baseTabs;
};

/** Tabs under Advanced: admin-only */
const getAdvancedTabs = (userRole?: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp'): TabItem[] => {
  if (userRole === 'admin') {
    return [
      { id: 'admin', label: 'Admin', icon: Shield, description: 'User management & database tools' },
      { id: 'performance', label: 'Performance', icon: Activity, description: 'System monitoring & metrics' },
      { id: 'email', label: 'Email', icon: Mail, description: 'Email CV processing' },
    ];
  }
  return [];
};

export default function AppLayoutNew({ children }: AppLayoutProps) {
  const router = useRouter();
  const { currentTab, setCurrentTab, systemHealth, cvs, jds, matchResult, matchingProgress } = useAppStore();
  const { user, logout } = useAuthStore();
  const navInactiveClass = 'text-gray-700 hover:text-gray-900 hover:bg-gray-200/90';
  const navActiveClass = 'bg-[#00529b] text-white shadow-sm';
  const trackerInactiveClass =
    'text-[#0f766e] hover:text-[#115e59] hover:bg-[#ccfbf1] border border-[#99f6e4] bg-[#f0fdfa]';
  const trackerActiveClass =
    'bg-[#0f766e] text-white shadow-sm border border-[#0f766e]';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedMobileOpen, setAdvancedMobileOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);

  const navigationTabs = getNavigationTabs(user?.role);
  const advancedTabs = getAdvancedTabs(user?.role);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) setAdvancedOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      case 'tracker':
        return 'Candidate tracker';
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
      case 'tracker':
        return true;
      case 'email':
        return true; // Always available for admin users
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg shadow-sm">
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
                  <h1 className="text-xl font-bold text-gray-900">Alpha CV</h1>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-1 bg-gray-100 rounded-lg border border-gray-200 p-0.5">
              {navigationTabs.map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                const isTracker = tab.id === 'tracker';
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'tracker') {
                        router.push('/tracker');
                        return;
                      }
                      setCurrentTab(tab.id as any);
                    }}
                    className={`flex items-center space-x-2 rounded-md text-sm font-medium transition-colors px-3 py-2 ${
                      isTracker
                        ? (isActive ? trackerActiveClass : trackerInactiveClass)
                        : (isActive ? navActiveClass : navInactiveClass)
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {isTracker ? (
                      <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#99f6e4] text-[#115e59]'
                      }`}>
                        TRACKER
                      </span>
                    ) : null}
                    {isCompleted && (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/80' : 'bg-green-500'}`} />
                    )}
                  </button>
                );
              })}
              {advancedTabs.length > 0 && (
                <div className="relative" ref={advancedRef}>
                  <button
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    className={`flex items-center space-x-2 rounded-md text-sm font-medium transition-colors px-3 py-2 ${
                      currentTab === 'performance' || currentTab === 'email'
                        ? navActiveClass
                        : navInactiveClass
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Advanced</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {advancedOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
                      {advancedTabs.map((tab) => {
                        const isActive = currentTab === tab.id;
                        const IconComponent = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              if (tab.id === 'admin') {
                                router.push('/admin/users');
                                setAdvancedOpen(false);
                                return;
                              }
                              setCurrentTab(tab.id as any);
                              setAdvancedOpen(false);
                            }}
                            className={`w-full flex items-center space-x-2 px-4 py-2.5 text-left text-ui font-medium ${
                              isActive ? 'bg-[#00529b]/10 text-[#00529b]' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </nav>

            <div className="flex items-center space-x-2">
              {user && (
                <div className="hidden sm:flex items-center space-x-2">
                  <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200 space-x-2 px-2 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-[#00529b] flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">{user.username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadgeClasses(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors px-2.5 py-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
              <button
                className="md:hidden p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-sm max-h-[85vh] overflow-y-auto">
          <div className="container mx-auto px-4 py-4">
            {user && (
              <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#00529b] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{user.username}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${user.role === 'admin' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      {user.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
            <nav className="space-y-1">
              {navigationTabs.map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'tracker') {
                        router.push('/tracker');
                        setMobileMenuOpen(false);
                        return;
                      }
                      setCurrentTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg text-left font-medium transition-colors ${
                      isActive ? 'bg-[#00529b] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className="w-5 h-5" />
                      <div>
                        <div>{tab.label}</div>
                        <div className={`text-caption ${isActive ? 'text-white/90' : 'text-gray-500'}`}>{getTabStats(tab.id)}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isCompleted && <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/80' : 'bg-green-500'}`} />}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
              {advancedTabs.length > 0 && (
                <>
                  <button
                    onClick={() => setAdvancedMobileOpen(!advancedMobileOpen)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg text-left font-medium transition-colors ${
                      currentTab === 'performance' || currentTab === 'email' ? 'bg-[#00529b] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Settings className="w-5 h-5" />
                      <div>
                        <div>Advanced</div>
                        <div className={`text-caption ${currentTab === 'performance' || currentTab === 'email' ? 'text-white/90' : 'text-gray-500'}`}>
                          Performance, Email
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${advancedMobileOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {advancedMobileOpen && (
                    <div className="pl-4 space-y-0.5 border-l-2 border-gray-200 ml-4">
                      {advancedTabs.map((tab) => {
                        const isActive = currentTab === tab.id;
                        const IconComponent = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              if (tab.id === 'admin') {
                                router.push('/admin/users');
                                setMobileMenuOpen(false);
                                setAdvancedMobileOpen(false);
                                return;
                              }
                              setCurrentTab(tab.id as any);
                              setMobileMenuOpen(false);
                              setAdvancedMobileOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg text-left font-medium transition-colors ${
                              isActive ? 'bg-[#00529b] text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <IconComponent className="w-4 h-4" />
                              <span>{tab.label}</span>
                            </div>
                            {isActive && <ChevronRight className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Single matching overlay: visible on any tab when matching is in progress (Database or Careers) */}
      <MatchingProgressBar
        totalCVs={matchingProgress.totalCVs}
        processedCVs={matchingProgress.processedCVs}
        currentStage={matchingProgress.currentStage}
        estimatedTimeRemaining={matchingProgress.estimatedTimeRemaining}
        isVisible={matchingProgress.isVisible}
        currentBatch={matchingProgress.currentBatch}
        totalBatches={matchingProgress.totalBatches}
        phase={matchingProgress.phase}
      />
    </div>
  );
}
