'use client';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Users,
  Trash2,
  RefreshCw,
  Eye,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Target,
  Play,
  ChevronDown,
  Search,
  Database,
  AlertTriangle,
  Folder,
  FolderOpen,
  Code,
  Brain,
  Shield,
  Cloud,
  BarChart3,
  FolderIcon,
  Activity,
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Award,
  Star,
  MapPin,
  GraduationCap,
  Zap,
  TrendingUp,
  FileCheck,
  Settings
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import MatchingProgressBar from '@/components/ui/MatchingProgressBar';

/* ----------------------------- Types ---------------------------- */
interface CVData {
  id: string;
  cv?: any;
  candidate?: any;
  structured_info?: any;
  text_info?: any;
  embeddings_info?: any;
  processing_metadata?: any;
  upload_date?: string;
  filename?: string;
}

interface JDData {
  id: string;
  jd?: any;
  job_requirements?: any;
  structured_info?: any;
  text_info?: any;
  embeddings_info?: any;
  processing_metadata?: any;
  upload_date?: string;
  filename?: string;
}

interface ContactInfo {
  email?: string;
  phone?: string;
}

/* ----------------------------- Small utilities ---------------------------- */
const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : undefined;
};

const firstNumber = (...vals: unknown[]): number => {
  for (const v of vals) {
    const n = toNum(v);
    if (n !== undefined) return n;
  }
  return 0;
};

const len = (a: unknown): number | undefined => {
  return Array.isArray(a) ? a.length : undefined;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

const extractEmailFromText = (text: string): string => {
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return emailMatch ? emailMatch[0] : 'not provided';
};

const extractPhoneFromText = (text: string): string => {
  const phoneMatch = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : 'not provided';
};

const safeArrayMap = <T, R>(
  array: T[] | undefined | null,
  callback: (item: T, index: number) => R
): R[] => {
  return Array.isArray(array) ? array.map(callback) : [];
};

// Category icons mapping
const categoryIcons = {
  'Software Engineering': <Code className="w-5 h-5" />,
  'AI/ML Engineering': <Brain className="w-5 h-5" />,
  'Security Engineering': <Shield className="w-5 h-5" />,
  'Cloud/DevOps Engineering': <Cloud className="w-5 h-5" />,
  'Data Science': <BarChart3 className="w-5 h-5" />,
  'General': <FolderIcon className="w-5 h-5" />
};

// Category colors mapping
const categoryColors = {
  'Software Engineering': 'bg-blue-100 text-blue-600',
  'AI/ML Engineering': 'bg-purple-100 text-purple-600',
  'Security Engineering': 'bg-red-100 text-red-600',
  'Cloud/DevOps Engineering': 'bg-orange-100 text-orange-600',
  'Data Science': 'bg-green-100 text-green-600',
  'General': 'bg-gray-100 text-gray-600'
};

/** Robustly derive name/title/years + counts across shapes */
export const getCVBasics = (cv: CVData) => {
  const cvData = cv?.cv || cv;
  const candidate = cvData?.candidate || {};
  const structured = cvData?.structured_info || {};

  const name = candidate?.full_name ?? cvData?.full_name ?? 'Unknown';
  const title = candidate?.job_title ?? cvData?.job_title ?? 'Unknown';
  const years = candidate?.years_of_experience ?? cvData?.years_of_experience ?? '0';

  const skillsCount = firstNumber(
    candidate?.skills_count,
    cvData?.skills_count,
    structured?.skills_count,
    len(candidate?.skills),
    len(structured?.skills),
    len(structured?.skills_sentences),
    len(cvData?.skills)
  );

  const respCount = firstNumber(
    candidate?.responsibilities_count,
    cvData?.responsibilities_count,
    structured?.responsibilities_count,
    len(candidate?.responsibilities),
    len(structured?.responsibilities),
    len(structured?.responsibility_sentences),
    len(cvData?.responsibilities)
  );

  return { name, title, years, skillsCount, respCount };
};

const getJDBasics = (jd: JDData) => {
  const jdData = jd?.jd || jd;
  const src = jdData?.job_requirements || jdData?.structured_info || {};
  
  const title = src.job_title ?? jdData?.job_title ?? 'N/A';
  const years = src.years_of_experience ?? src.experience_years ?? jdData?.years_of_experience ?? '0';
  const skills = src.skills ?? jdData?.skills ?? [];
  const responsibilities = src.responsibilities ?? src.responsibility_sentences ?? jdData?.responsibilities ?? [];
  
  const skillsCount = src.skills_count ?? jdData?.skills_count ?? (Array.isArray(skills) ? skills.length : 0);
  const responsibilitiesCount = src.responsibilities_count ?? jdData?.responsibilities_count ?? (Array.isArray(responsibilities) ? responsibilities.length : 0);
  
  return { title, years, skills, responsibilities, skillsCount, responsibilitiesCount };
};

/* -------------------------------- Component ------------------------------- */
export default function DatabasePageNew() {
  const {
    cvs,
    jds,
    selectedCVs,
    selectedJD,
    loadingStates,
    loadCVs,
    loadJDs,
    selectCV,
    deselectCV,
    selectAllCVs,
    deselectAllCVs,
    selectJD,
    deleteCV,
    deleteJD,
    reprocessCV,
    reprocessJD,
    setCurrentTab,
    runMatch,
    matchingProgress,
  } = useAppStore();
  
  const { user } = useAuthStore();
  
  const [selectedCVForDetails, setSelectedCVForDetails] = useState<string | null>(null);
  const [selectedJDForDetails, setSelectedJDForDetails] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCVs, setFilteredCVs] = useState<CVData[]>([]);
  const [filteredJDs, setFilteredJDs] = useState<JDData[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Category-related state
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cvsInCategory, setCvsInCategory] = useState<CVData[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'all' | 'categories'>('all');
  
  useEffect(() => {
    loadCVs();
    loadJDs();
    loadCategories();
  }, [loadCVs, loadJDs]);

  // Load categories from API
  const loadCategories = async () => {
    try {
      const response = await api.getCategories();
      setCategories(response.categories || {});
      console.log('📊 Categories loaded:', response.categories);
    } catch (error) {
      console.error('❌ Failed to load categories:', error);
    }
  };

  // Load CVs for specific category
  const loadCVsForCategory = async (category: string) => {
    try {
      setCategoryLoading(true);
      setSelectedCategory(category);
      const response = await api.getCVsByCategory(category);
      setCvsInCategory(response.cvs || []);
      console.log(`📁 CVs loaded for ${category}:`, response.cvs);
    } catch (error) {
      console.error(`❌ Failed to load CVs for ${category}:`, error);
    } finally {
      setCategoryLoading(false);
    }
  };
  
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCVs(cvs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = cvs.filter(cv => {
        const basics = getCVBasics(cv);
        return (
          basics.name.toLowerCase().includes(query) ||
          cv.id.toLowerCase().includes(query) ||
          basics.title.toLowerCase().includes(query)
        );
      });
      setFilteredCVs(filtered);
    }
  }, [cvs, searchQuery]);
  
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredJDs(jds);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = jds.filter(jd => {
        const basics = getJDBasics(jd);
        return (
          jd.id.toLowerCase().includes(query) ||
          basics.title.toLowerCase().includes(query)
        );
      });
      setFilteredJDs(filtered);
    }
  }, [jds, searchQuery]);
  
  const isLoadingCVs = loadingStates.cvs.isLoading;
  const isLoadingJDs = loadingStates.jds.isLoading;
  const isDeleting = loadingStates.upload.isLoading;
  
  const handleDeleteCV = async (cvId: string) => {
    if (window.confirm('Are you sure you want to delete this CV?')) {
      await deleteCV(cvId);
    }
  };
  
  const handleDeleteJD = async (jdId: string) => {
    if (window.confirm('Are you sure you want to delete this job description?')) {
      await deleteJD(jdId);
    }
  };
  
  const handleReprocessCV = async (cvId: string) => {
    await reprocessCV(cvId);
  };
  
  const handleReprocessJD = async (jdId: string) => {
    await reprocessJD(jdId);
  };
  
  const canStartMatching = selectedCVs.length > 0 && selectedJD;
  
  const handleStartMatching = async () => {
    await runMatch();
    setCurrentTab('match');
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const clearSearch = () => {
    setSearchQuery('');
  };
  
  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        throw new Error('No authentication token found');
      }
      await api.clearDatabase(token, true);
      await loadCVs();
      await loadJDs();
      await loadCategories();
      setShowClearDialog(false);
    } catch (error: any) {
      console.error('Failed to clear database:', error);
    } finally {
      setIsClearing(false);
    }
  };

  // Category selection handlers
  const handleCategoryClick = (category: string) => {
    loadCVsForCategory(category);
    setCurrentView('categories');
  };

  const handleSelectAllInCategory = () => {
    if (selectedCategory) {
      const allCVIds = cvsInCategory.map(cv => cv.id);
      
      // If all are selected, deselect all
      const allSelected = allCVIds.every(id => selectedCVs.includes(id));
      if (allSelected) {
        // Deselect all CVs in this category
        allCVIds.forEach(id => {
          if (selectedCVs.includes(id)) {
            deselectCV(id);
          }
        });
      } else {
        // Select all CVs in this category
        allCVIds.forEach(id => {
          if (!selectedCVs.includes(id)) {
            selectCV(id);
          }
        });
      }
    }
  };

  const handleCVSelectionFromCategory = (cvId: string, checked: boolean) => {
    if (checked) {
      selectCV(cvId);
    } else {
      deselectCV(cvId);
    }
  };
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  
  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <MatchingProgressBar
        totalCVs={matchingProgress.totalCVs}
        processedCVs={matchingProgress.processedCVs}
        currentStage={matchingProgress.currentStage}
        estimatedTimeRemaining={matchingProgress.estimatedTimeRemaining}
        isVisible={matchingProgress.isVisible}
      />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg">Document Database</h1>
          <p className="text-lg mt-1" style={{ color: 'var(--gray-600)' }}>
            Manage your CVs and job descriptions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Button
              variant={currentView === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('all')}
            >
              <Database className="w-4 h-4 mr-2" />
              All CVs
            </Button>
            <Button
              variant={currentView === 'categories' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('categories')}
            >
              <Folder className="w-4 h-4 mr-2" />
              Categories
            </Button>
          </div>
          {isAdmin && (
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  aria-label="Clear all data from database"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Database
                </Button>
              </DialogTrigger>
              <DialogContent
                className="bg-rose-50 border border-rose-300 shadow-xl rounded-lg p-6 data-[state=open]:animate-in 
                           data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 
                           data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                    Confirm Database Clear
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-gray-800">
                    Are you sure you want to permanently delete all CVs and job descriptions?
                  </p>
                  <p className="text-sm text-rose-600 font-medium">This action cannot be undone.</p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="error"
                      onClick={handleClearDatabase}
                      disabled={isClearing}
                      className="bg-rose-600 hover:bg-rose-700"
                    >
                      {isClearing ? 'Clearing...' : 'Clear All Data'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant="outline"
            onClick={() => {
              loadCVs();
              loadJDs();
            }}
            disabled={isLoadingCVs || isLoadingJDs}
            aria-label="Refresh database content"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {canStartMatching && (
            <Button
              variant="primary"
              onClick={handleStartMatching}
              disabled={loadingStates.matching.isLoading}
              aria-label="Start matching selected CVs with job description"
            >
              <Play className="w-4 h-4 mr-2" />
              {loadingStates.matching.isLoading ? 'Matching...' : 'Match Selected'}
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total CVs</p>
              <p className="text-2xl font-bold text-gray-900">{cvs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Job Descriptions</p>
              <p className="text-2xl font-bold text-gray-900">{jds.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Ready to Match</p>
              <p className="text-2xl font-bold text-gray-900">{canStartMatching ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category View */}
      {currentView === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">CV Categories</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCategories}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Categories
            </Button>
          </div>
          
          {Object.keys(categories).length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories Found</h3>
              <p className="text-gray-500">Upload CVs to see them organized by category</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categories).map(([category, count]) => (
                <Card 
                  key={category}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleCategoryClick(category)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${(categoryColors as any)[category] || 'bg-gray-100 text-gray-600'}`}>
                        {(categoryIcons as any)[category] || <FolderIcon className="w-5 h-5" />}
                      </div>
                      <Badge variant="secondary">{count} CVs</Badge>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">{category}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryClick(category);
                        }}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Get all CVs in this category
                          const categoryCVs = cvs.filter(cv => {
                            const cvData = (cv as any)?.cv || cv;
                            const candidate = cvData?.candidate || {};
                            const structured = cvData?.structured_info || {};
                            const cvCategory = candidate?.category || structured?.category || 'General';
                            return cvCategory === category;
                          });
                          const categoryCVIds = categoryCVs.map(cv => cv.id);
                          
                          // Check if all CVs in this category are selected
                          const allSelected = categoryCVIds.every(id => selectedCVs.includes(id));
                          
                          if (allSelected) {
                            // Deselect all CVs in this category
                            categoryCVIds.forEach(id => {
                              if (selectedCVs.includes(id)) {
                                deselectCV(id);
                              }
                            });
                          } else {
                            // Select all CVs in this category
                            categoryCVIds.forEach(id => {
                              if (!selectedCVs.includes(id)) {
                                selectCV(id);
                              }
                            });
                          }
                        }}
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {(() => {
                          const categoryCVs = cvs.filter(cv => {
                            const cvData = (cv as any)?.cv || cv;
                            const candidate = cvData?.candidate || {};
                            const structured = cvData?.structured_info || {};
                            const cvCategory = candidate?.category || structured?.category || 'General';
                            return cvCategory === category;
                          });
                          const categoryCVIds = categoryCVs.map(cv => cv.id);
                          const allSelected = categoryCVIds.every(id => selectedCVs.includes(id));
                          return allSelected ? 'Deselect All' : 'Select All';
                        })()}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category CVs View */}
      {currentView === 'categories' && selectedCategory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory(null);
                  setCvsInCategory([]);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Back to Categories
              </Button>
              <h2 className="text-xl font-semibold">
                {selectedCategory} ({cvsInCategory.length} CVs)
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllInCategory}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {cvsInCategory.every(cv => selectedCVs.includes(cv.id)) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {categoryLoading ? (
            <Card className="p-8 text-center">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-4" />
              <p>Loading CVs for {selectedCategory}...</p>
            </Card>
          ) : cvsInCategory.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No CVs in this category</h3>
              <p className="text-gray-500">This category doesn't have any CVs yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {cvsInCategory.map((cv) => {
                const b = getCVBasics(cv);
                return (
                  <div
                    key={cv.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCVs.includes(cv.id)}
                        onChange={(e) => handleCVSelectionFromCategory(cv.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded"
                        aria-label={`Select CV for ${b.name}`}
                      />
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{b.name}</h4>
                        <p className="text-sm text-gray-500">
                          {b.title} • {b.years} years
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary">{b.skillsCount} skills</Badge>
                          <Badge variant="outline">{b.respCount} responsibilities</Badge>
                          <Badge variant="outline" className="text-xs">
                            {cv?.cv?.candidate?.category || cv?.cv?.structured_info?.category || 'General'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCVForDetails(cv.id)}
                            aria-label={`View details for ${b.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-lg shadow-xl">
                          <DialogHeader className="flex flex-row items-center justify-between">
                            <DialogTitle className="text-xl font-semibold">CV Details</DialogTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCVForDetails(null)}
                              className="h-6 w-6 rounded-full hover:bg-gray-100"
                              aria-label="Close CV details"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </DialogHeader>
                          <CVDetails cvId={cv.id} />
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReprocessCV(cv.id)} 
                        disabled={isDeleting}
                        aria-label={`Reprocess CV for ${b.name}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCV(cv.id)}
                        disabled={isDeleting}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Delete CV for ${b.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, ID, or job title..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search documents"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-500">
            Showing {filteredCVs.length} of {cvs.length} CVs and {filteredJDs.length} of {jds.length} Job Descriptions
          </div>
        )}
      </Card>
      
      {/* Document Tabs */}
      <Tabs defaultValue="cvs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cvs" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>CVs ({filteredCVs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="jds" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Job Descriptions ({filteredJDs.length})</span>
          </TabsTrigger>
        </TabsList>
        
        {/* CVs Tab */}
        <TabsContent value="cvs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Candidate CVs</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAllCVs} disabled={filteredCVs.length === 0}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllCVs} disabled={selectedCVs.length === 0}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCVs ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading CVs...</span>
                </div>
              ) : filteredCVs.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No CVs match your search' : 'No CVs uploaded'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery 
                      ? 'Try adjusting your search terms' 
                      : 'Upload CVs to get started with matching'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setCurrentTab('upload')}>Upload CVs</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCVs.map((cv) => {
                    const b = getCVBasics(cv);
                    return (
                      <div
                        key={cv.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedCVs.includes(cv.id)}
                            onChange={() => {
                              if (selectedCVs.includes(cv.id)) {
                                deselectCV(cv.id);
                              } else {
                                selectCV(cv.id);
                              }
                            }}
                            className="h-4 w-4 text-blue-600 rounded"
                            aria-label={`Select CV for ${b.name}`}
                          />
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{b.name}</h4>
                            <p className="text-sm text-gray-500">
                              {b.title} • {b.years} years
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary">{b.skillsCount} skills</Badge>
                              <Badge variant="outline">{b.respCount} responsibilities</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCVForDetails(cv.id)}
                                aria-label={`View details for ${b.name}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
                              <DialogHeader className="flex flex-row items-center justify-between">
                                <DialogTitle className="text-xl font-semibold">CV Details</DialogTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCVForDetails(null)}
                                  className="h-6 w-6 rounded-full hover:bg-gray-100"
                                  aria-label="Close CV details"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogHeader>
                              <CVDetails cvId={cv.id} />
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleReprocessCV(cv.id)} 
                            disabled={isDeleting}
                            aria-label={`Reprocess CV for ${b.name}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCV(cv.id)}
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-700"
                            aria-label={`Delete CV for ${b.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* JDs Tab */}
        <TabsContent value="jds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Descriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingJDs ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading Job Descriptions...</span>
                </div>
              ) : filteredJDs.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No Job Descriptions match your search' : 'No Job Descriptions uploaded'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery 
                      ? 'Try adjusting your search terms' 
                      : 'Upload job descriptions to get started with matching'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setCurrentTab('upload')}>Upload Job Descriptions</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredJDs.map((jd) => {
                    const b = getJDBasics(jd);
                    return (
                      <div
                        key={jd.id}
                        className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                          selectedJD === jd.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="selectedJD"
                            checked={selectedJD === jd.id}
                            onChange={() => selectJD(jd.id)}
                            className="h-4 w-4 text-blue-600"
                            aria-label={`Select job description: ${b.title}`}
                          />
                          <div className="p-2 bg-green-100 rounded-lg">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{b.title}</h4>
                            <p className="text-sm text-gray-500">{b.years} experience required</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary">{b.skillsCount} skills</Badge>
                              <Badge variant="outline">{b.responsibilitiesCount} responsibilities</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedJDForDetails(jd.id)}
                                aria-label={`View details for ${b.title}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
                              <DialogHeader className="flex flex-row items-center justify-between">
                                <DialogTitle className="text-xl font-semibold">Job Description Details</DialogTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedJDForDetails(null)}
                                  className="h-6 w-6 rounded-full hover:bg-gray-100"
                                  aria-label="Close job description details"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogHeader>
                              <JDDetails jdId={jd.id} />
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleReprocessJD(jd.id)} 
                            disabled={isDeleting}
                            aria-label={`Reprocess job description: ${b.title}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJD(jd.id)}
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-700"
                            aria-label={`Delete job description: ${b.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------- CV Details (modal) --------------------------- */
function CVDetails({ cvId }: { cvId: string }) {
  const [cv, setCV] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadCV = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getCVDetails(cvId);
        setCV(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load CV details');
      } finally {
        setLoading(false);
      }
    };
    loadCV();
  }, [cvId]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading CV details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading CV</h3>
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    );
  }
  
  if (!cv) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">CV Not Found</h3>
        <p className="text-gray-600">The requested CV could not be found.</p>
      </div>
    );
  }
  
  const b = getCVBasics(cv);
  
  // Extract contact information
  const getContactInfo = (cv: CVData): ContactInfo => {
    const cvData = cv?.cv || cv;
    const candidate = cvData?.candidate || {};
    const structured = cvData?.structured_info || {};
    
    const email = candidate?.contact_info?.email || 
                  structured?.contact_info?.email ||
                  cvData?.contact_info?.email;
    
    const phone = candidate?.contact_info?.phone || 
                  structured?.contact_info?.phone ||
                  cvData?.contact_info?.phone;
    
    const textPreview = cvData?.text_info?.extracted_text_preview || '';
    
    return {
      email: email || extractEmailFromText(textPreview),
      phone: phone || extractPhoneFromText(textPreview)
    };
  };
  
  // Get skills data
  const getSkillsData = (cv: CVData): string[] => {
    const cvData = cv?.cv || cv;
    const candidate = cvData?.candidate || {};
    const structured = cvData?.structured_info || {};
    
    return candidate?.skills ?? 
           structured?.skills ?? 
           structured?.skills_sentences ??
           cvData?.skills ?? 
           [];
  };
  
  // Get responsibilities data
  const getResponsibilitiesData = (cv: CVData): string[] => {
    const cvData = cv?.cv || cv;
    const candidate = cvData?.candidate || {};
    const structured = cvData?.structured_info || {};
    
    return candidate?.responsibilities ?? 
           structured?.responsibilities ?? 
           structured?.responsibility_sentences ??
           cvData?.responsibilities ?? 
           [];
  };
  
  const contactInfo = getContactInfo(cv);
  const skillsData = getSkillsData(cv);
  const responsibilitiesData = getResponsibilitiesData(cv);
  const category = cv?.cv?.candidate?.category || cv?.cv?.structured_info?.category || 'General';
  const categoryIcon = categoryIcons[category as keyof typeof categoryIcons] || categoryIcons['General'];
  const categoryColor = categoryColors[category as keyof typeof categoryColors] || categoryColors['General'];
  
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white rounded-full p-3 shadow-sm">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{b.name}</h2>
              <div className="flex items-center space-x-2 mb-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                <span className="text-lg font-semibold text-gray-700">{b.title}</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-600">{b.years} years experience</span>
                </div>
                <Badge className={`${categoryColor} border-0`}>
                  <div className="flex items-center space-x-1">
                    {categoryIcon}
                    <span>{category}</span>
                  </div>
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-1 text-sm text-gray-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Uploaded {formatDate(cv?.cv?.upload_date || cv?.upload_date)}</span>
            </div>
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <FileCheck className="w-4 h-4" />
              <span>CV #{cvId.slice(-8)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-green-100 rounded-full p-2">
            <Mail className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <Mail className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="font-semibold text-blue-600 break-all">{contactInfo.email || 'Not available'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <Phone className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Phone</p>
              <p className="font-semibold text-green-600">{contactInfo.phone || 'Not available'}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Skills Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="bg-purple-100 rounded-full p-2">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Technical Skills</h3>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            {skillsData.length} skills
          </Badge>
        </div>
        {skillsData.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {safeArrayMap(skillsData, (skill: string, i: number) => (
              <div key={i} className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 text-center hover:shadow-md transition-shadow">
                <span className="text-sm font-medium text-gray-800">{skill}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No skills information available</p>
          </div>
        )}
      </div>
      
      {/* Experience & Responsibilities */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="bg-orange-100 rounded-full p-2">
              <Briefcase className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Experience & Responsibilities</h3>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
            {responsibilitiesData.length} items
          </Badge>
        </div>
        {responsibilitiesData.length > 0 ? (
          <div className="space-y-4">
            {safeArrayMap(responsibilitiesData, (resp: string, i: number) => (
              <div key={i} className="flex items-start space-x-3 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg hover:shadow-sm transition-shadow">
                <div className="bg-orange-500 rounded-full p-1 mt-1">
                  <Star className="w-3 h-3 text-white" />
                </div>
                <p className="text-gray-700 leading-relaxed">{resp}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No responsibilities information available</p>
          </div>
        )}
      </div>
      
      {/* Document Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-blue-100 rounded-full p-2">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto border">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {cv?.cv?.text_info?.extracted_text_preview || cv?.text_info?.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>Document length: {cv?.cv?.text_info?.extracted_text_length || cv?.text_info?.extracted_text_length || 0} characters</span>
          <span>Filename: {cv?.cv?.processing_metadata?.filename || cv?.processing_metadata?.filename || cv?.cv?.filename || cv?.filename || 'N/A'}</span>
        </div>
      </div>
      
      {/* Technical Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-indigo-100 rounded-full p-2">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Processing</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Skills Embeddings</span>
              <Badge variant="outline" className="bg-white">{cv?.cv?.embeddings_info?.skills_embeddings || cv?.embeddings_info?.skills_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Responsibilities Embeddings</span>
              <Badge variant="outline" className="bg-white">{cv?.cv?.embeddings_info?.responsibilities_embeddings || cv?.embeddings_info?.responsibilities_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Model Used</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.processing_metadata?.model_used || cv?.processing_metadata?.model_used || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Processing Time</span>
              <span className="text-sm font-semibold text-gray-800">
                {cv?.cv?.processing_metadata?.processing_time || cv?.processing_metadata?.processing_time
                  ? `${((cv?.cv?.processing_metadata?.processing_time ?? cv?.processing_metadata?.processing_time) as number).toFixed(2)}s`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-green-100 rounded-full p-2">
              <Settings className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Title Embedding</span>
              <Badge variant={cv?.cv?.embeddings_info?.has_title_embedding || cv?.embeddings_info?.has_title_embedding ? "success" : "outline"}>
                {(cv?.cv?.embeddings_info?.has_title_embedding || cv?.embeddings_info?.has_title_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Experience Embedding</span>
              <Badge variant={cv?.cv?.embeddings_info?.has_experience_embedding || cv?.embeddings_info?.has_experience_embedding ? "success" : "outline"}>
                {(cv?.cv?.embeddings_info?.has_experience_embedding || cv?.embeddings_info?.has_experience_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Embedding Dimension</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.embeddings_info?.embedding_dimension || cv?.embeddings_info?.embedding_dimension || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Text Length</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.processing_metadata?.text_length || cv?.cv?.text_info?.extracted_text_length || cv?.processing_metadata?.text_length || cv?.text_info?.extracted_text_length || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- JD Details (modal) --------------------------- */
function JDDetails({ jdId }: { jdId: string }) {
  const [jd, setJD] = useState<JDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJSON, setShowJSON] = useState(false);
  
  useEffect(() => {
    const loadJD = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getJDDetails(jdId);
        setJD(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load JD details');
      } finally {
        setLoading(false);
      }
    };
    loadJD();
  }, [jdId]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading job description details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Job Description</h3>
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    );
  }
  
  if (!jd) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Description Not Found</h3>
        <p className="text-gray-600">The requested job description could not be found.</p>
      </div>
    );
  }
  
  const b = getJDBasics(jd);
  const category = jd?.jd?.job_requirements?.category || jd?.jd?.structured_info?.category || 'General';
  const categoryIcon = categoryIcons[category as keyof typeof categoryIcons] || categoryIcons['General'];
  const categoryColor = categoryColors[category as keyof typeof categoryColors] || categoryColors['General'];
  
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white rounded-full p-3 shadow-sm">
              <Briefcase className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{b.title}</h2>
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-lg font-semibold text-gray-700">{b.years} years experience required</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600">Job Description</span>
                </div>
                <Badge className={`${categoryColor} border-0`}>
                  <div className="flex items-center space-x-1">
                    {categoryIcon}
                    <span>{category}</span>
                  </div>
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-1 text-sm text-gray-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Uploaded {formatDate(jd?.jd?.upload_date || jd?.upload_date)}</span>
            </div>
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <FileCheck className="w-4 h-4" />
              <span>JD #{jdId.slice(-8)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Job Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-blue-100 rounded-full p-2">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Job Overview</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Position</p>
              <p className="font-semibold text-blue-600">{b.title}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Experience</p>
              <p className="font-semibold text-green-600">{b.years} years</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
            <FileText className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Document Type</p>
              <p className="font-semibold text-purple-600">{jd?.jd?.document_type || 'Job Description'}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Required Skills */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="bg-purple-100 rounded-full p-2">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Required Skills</h3>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            {b.skillsCount} skills
          </Badge>
        </div>
        {b.skillsCount > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {safeArrayMap(b.skills, (skill: string, i: number) => (
              <div key={i} className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 text-center hover:shadow-md transition-shadow">
                <span className="text-sm font-medium text-gray-800">{skill}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No skills information available</p>
          </div>
        )}
      </div>
      
      {/* Job Responsibilities */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="bg-orange-100 rounded-full p-2">
              <Briefcase className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Job Responsibilities</h3>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
            {b.responsibilitiesCount} items
          </Badge>
        </div>
        {b.responsibilitiesCount > 0 ? (
          <div className="space-y-4">
            {safeArrayMap(b.responsibilities, (resp: string, i: number) => (
              <div key={i} className="flex items-start space-x-3 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg hover:shadow-sm transition-shadow">
                <div className="bg-orange-500 rounded-full p-1 mt-1">
                  <Star className="w-3 h-3 text-white" />
                </div>
                <p className="text-gray-700 leading-relaxed">{resp}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No responsibilities information available</p>
          </div>
        )}
      </div>
      
      {/* Document Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-blue-100 rounded-full p-2">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto border">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {jd?.jd?.text_info?.extracted_text_preview || jd?.text_info?.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>Document length: {jd?.jd?.text_info?.extracted_text_length || jd?.text_info?.extracted_text_length || 0} characters</span>
          <span>Filename: {jd?.jd?.processing_metadata?.filename || jd?.processing_metadata?.filename || jd?.jd?.filename || jd?.filename || 'N/A'}</span>
        </div>
      </div>
      
      {/* Technical Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-indigo-100 rounded-full p-2">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Processing</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Skills Embeddings</span>
              <Badge variant="outline" className="bg-white">{jd?.jd?.embeddings_info?.skills_embeddings || jd?.embeddings_info?.skills_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Responsibilities Embeddings</span>
              <Badge variant="outline" className="bg-white">{jd?.jd?.embeddings_info?.responsibilities_embeddings || jd?.embeddings_info?.responsibilities_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Model Used</span>
              <span className="text-sm font-semibold text-gray-800">{jd?.jd?.processing_metadata?.model_used || jd?.processing_metadata?.model_used || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Processing Time</span>
              <span className="text-sm font-semibold text-gray-800">
                {jd?.jd?.processing_metadata?.processing_time || jd?.processing_metadata?.processing_time
                  ? `${((jd?.jd?.processing_metadata?.processing_time ?? jd?.processing_metadata?.processing_time) as number).toFixed(2)}s`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-green-100 rounded-full p-2">
              <Settings className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Title Embedding</span>
              <Badge variant={jd?.jd?.embeddings_info?.has_title_embedding || jd?.embeddings_info?.has_title_embedding ? "success" : "outline"}>
                {(jd?.jd?.embeddings_info?.has_title_embedding || jd?.embeddings_info?.has_title_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Experience Embedding</span>
              <Badge variant={jd?.jd?.embeddings_info?.has_experience_embedding || jd?.embeddings_info?.has_experience_embedding ? "success" : "outline"}>
                {(jd?.jd?.embeddings_info?.has_experience_embedding || jd?.embeddings_info?.has_experience_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Embedding Dimension</span>
              <span className="text-sm font-semibold text-gray-800">{jd?.jd?.embeddings_info?.embedding_dimension || jd?.embeddings_info?.embedding_dimension || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Text Length</span>
              <span className="text-sm font-semibold text-gray-800">{jd?.jd?.processing_metadata?.text_length || jd?.jd?.text_info?.extracted_text_length || jd?.processing_metadata?.text_length || jd?.text_info?.extracted_text_length || 0}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Optional: collapsible raw JSON for debugging */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <button
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 font-medium"
          onClick={() => setShowJSON((s) => !s)}
          aria-label={showJSON ? 'Hide raw JSON data' : 'Show raw JSON data'}
        >
          <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${showJSON ? 'rotate-180' : ''}`} />
          {showJSON ? 'Hide Raw Data' : 'Show Raw Data'}
        </button>
        {showJSON && (
          <div className="mt-4">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <pre className="text-xs text-gray-700 overflow-auto max-h-60">
                {JSON.stringify(jd, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Helpers -------------------------------- */
function Row({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-medium ${mono ? 'font-mono text-xs truncate max-w-[220px]' : ''}`}>
        {String(value ?? 'N/A')}
      </span>
    </div>
  );
}