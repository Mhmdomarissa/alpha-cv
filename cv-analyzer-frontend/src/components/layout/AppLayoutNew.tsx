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
import FloatingNav from '@/components/ui/floating-nav';

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
  return 'bg-white text-neutral-900 border border-neutral-200 shadow-sm';
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
  const navInactiveClass = 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100';
  const navActiveClass = 'bg-gradient-primary text-white shadow-md border-0';
  /** Tracker is a separate module (route) — use violet so it reads differently from core app tabs (blue). */
  const trackerInactiveClass =
    'text-violet-700 hover:text-violet-900 hover:bg-violet-50 border border-transparent hover:border-violet-200/80';
  const trackerActiveClass = 'bg-violet-600 text-white shadow-md border-0';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedMobileOpen, setAdvancedMobileOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);

  const navigationTabs = getNavigationTabs(user?.role);
  const advancedTabs = getAdvancedTabs(user?.role);

  const floatingNavItems = [
    ...navigationTabs.map((tab) => {
      const IconComponent = tab.icon;
      return {
        id: tab.id,
        label: tab.label,
        icon: <IconComponent className="h-[22px] w-[22px]" />,
        onSelect: () => {
          if (tab.id === 'tracker') {
            router.push('/tracker');
            return;
          }
          setCurrentTab(tab.id as any);
        },
      };
    }),
    ...(advancedTabs.length > 0
      ? [
          {
            id: 'advanced',
            label: 'Advanced',
            icon: <Settings className="h-[22px] w-[22px]" />,
            onSelect: () => setMobileMenuOpen(true),
          },
        ]
      : []),
  ];

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
    <div className="min-h-screen bg-gray-50 relative">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center bg-white border border-gray-100">
                  <img
                    src="/alphadatalogo.svg"
                    alt="Alpha Data Logo"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Alpha <span className="text-blue-600">CV</span></h1>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-1 bg-gray-100/50 backdrop-blur-sm rounded-lg border border-gray-200/50 p-0.5">
              {navigationTabs.map((tab) => {
                const isActive = currentTab === tab.id;
                const isCompleted = getProgress(tab.id);
                const IconComponent = tab.icon;
                const isTracker = tab.id === 'tracker';

                const activeClass = 'bg-gradient-primary text-white shadow-lg border-0';
                const inactiveClass = 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all';
                const btnClass = isTracker
                  ? isActive
                    ? trackerActiveClass
                    : trackerInactiveClass
                  : isActive
                    ? activeClass
                    : inactiveClass;
                const iconMuted = isTracker ? (isActive ? 'text-white' : 'text-violet-600') : isActive ? 'text-white' : '';

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
                    className={`flex items-center space-x-2 rounded-md text-sm font-medium px-3 py-2 transition-all ${btnClass}`}
                  >
                    <IconComponent className={`w-4 h-4 ${iconMuted}`} />
                    <span>{tab.label}</span>
                    {isCompleted && !isTracker && (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-blue-500'}`} />
                    )}
                    {isCompleted && isTracker && (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-violet-500'}`} />
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
                              isActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
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
                    <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 leading-tight">{user.username}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 leading-tight">
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
                  <div className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{user.username}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit bg-neutral-100 text-neutral-900 border border-neutral-200`}>
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
                const isTracker = tab.id === 'tracker';
                const rowClass = isTracker
                  ? isActive
                    ? 'bg-violet-600 text-white'
                    : 'text-violet-900 bg-violet-50/80 border border-violet-200/70 hover:bg-violet-100'
                  : isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-blue-50';
                const iconClass = isTracker
                  ? isActive
                    ? 'text-white'
                    : 'text-violet-600'
                  : isActive
                    ? 'text-white'
                    : 'text-blue-600';
                const dotClass = isTracker
                  ? isActive
                    ? 'bg-white/80'
                    : 'bg-violet-500'
                  : isActive
                    ? 'bg-white/80'
                    : 'bg-green-500';

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
                    className={`w-full flex items-center justify-between p-4 rounded-lg text-left font-medium transition-colors ${rowClass}`}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`w-5 h-5 ${iconClass}`} />
                      <div>
                        <div className={isActive ? 'text-white' : isTracker ? 'text-violet-950' : 'text-gray-900'}>{tab.label}</div>
                        <div
                          className={`text-caption ${
                            isActive ? 'text-white/80' : isTracker ? 'text-violet-700/90' : 'text-gray-500'
                          }`}
                        >
                          {getTabStats(tab.id)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isCompleted && <div className={`w-2 h-2 rounded-full ${dotClass}`} />}
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-white' : isTracker ? 'text-violet-600' : ''}`} />
                    </div>
                  </button>
                );
              })}
              {advancedTabs.length > 0 && (
                <>
                  <button
                    onClick={() => setAdvancedMobileOpen(!advancedMobileOpen)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg text-left font-medium transition-colors ${
                      currentTab === 'performance' || currentTab === 'email' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
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
                              isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
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

      <div className="min-h-screen pt-4 pb-20 bg-gray-50/50">
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10 w-full">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Smooth mobile nav (UI-only; keeps same routes/tabs) */}
      <div className="md:hidden">
        <FloatingNav items={floatingNavItems} activeId={currentTab} />
      </div>

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
