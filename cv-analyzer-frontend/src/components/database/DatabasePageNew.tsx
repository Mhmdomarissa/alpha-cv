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
  Briefcase,
  Settings,
  Network,
  Phone,
  Calendar,
  Award,
  Star,
  MapPin,
  GraduationCap,
  Zap,
  TrendingUp,
  FileCheck,
  MessageSquare,
  Pencil,
  Save,
  ChevronLeft,
  ChevronRight,
  Menu,
  Filter
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  category?: string;
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
  'Cloud & Infrastructure Engineering': <Cloud className="w-5 h-5" />,
  'Software & Application Development': <Code className="w-5 h-5" />,
  'Data & Analytics': <BarChart3 className="w-5 h-5" />,
  'Cybersecurity & Governance': <Shield className="w-5 h-5" />,
  'Project & Program Management': <Users className="w-5 h-5" />,
  'Business Applications & Functional Consulting': <Briefcase className="w-5 h-5" />,
  'IT Operations & Support': <Settings className="w-5 h-5" />,
  'Networking & Systems': <Network className="w-5 h-5" />,
  'Specialized Technical Roles': <Brain className="w-5 h-5" />,
  'Non IT': <FileText className="w-5 h-5" />,
  'General': <FolderIcon className="w-5 h-5" />
};

// Category colors mapping
const categoryColors = {
  'Cloud & Infrastructure Engineering': 'bg-blue-100 text-blue-600',
  'Software & Application Development': 'bg-green-100 text-green-600',
  'Data & Analytics': 'bg-purple-100 text-purple-600',
  'Cybersecurity & Governance': 'bg-red-100 text-red-600',
  'Project & Program Management': 'bg-yellow-100 text-yellow-600',
  'Business Applications & Functional Consulting': 'bg-indigo-100 text-indigo-600',
  'IT Operations & Support': 'bg-orange-100 text-orange-600',
  'Networking & Systems': 'bg-cyan-100 text-cyan-600',
  'Specialized Technical Roles': 'bg-pink-100 text-pink-600',
  'Non IT': 'bg-gray-100 text-gray-600',
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

  const category = cv?.category ?? candidate?.category ?? cvData?.category ?? structured?.category ?? 'General';

  return { name, title, years, skillsCount, respCount, category };
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
    databaseActiveTab,
    loadingStates,
    loadCVs,
    loadJDs,
    selectCV,
    deselectCV,
    selectJD,
    deleteCV,
    deleteJD,
    reprocessCV,
    reprocessJD,
    setCurrentTab,
    setDatabaseActiveTab,
    runMatch,
    matchingProgress,
  } = useAppStore();
  
  const { user } = useAuthStore();
  
  const [selectedCVForDetails, setSelectedCVForDetails] = useState<string | null>(null);
  const [selectedJDForDetails, setSelectedJDForDetails] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesFilter, setNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [cvsWithNotes, setCvsWithNotes] = useState<Set<string>>(new Set());
  const [cvNotes, setCvNotes] = useState<Record<string, any[]>>({});
  const [editingNote, setEditingNote] = useState<{ cvId: string; noteIndex: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [filteredCVs, setFilteredCVs] = useState<CVData[]>([]);
  const [filteredJDs, setFilteredJDs] = useState<JDData[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
    loadCVsWithNotes();
  }, [loadCVs, loadJDs]);

  // Update category selection when CV selection changes
  useEffect(() => {
    updateCategorySelectionFromCVs();
  }, [selectedCVs, cvs]);

  // Load notes summary only once when component mounts
  useEffect(() => {
    const loadNotesSummary = async () => {
      if (cvs.length === 0) return;
      
      try {
        const ids = cvs.map(cv => cv.id).filter(Boolean);
        if (ids.length === 0) return;
        
        const res = await api.getNotesSummary(ids);
        const cvIdsWithNotes: string[] = [];
        
        (res.summaries || []).forEach((s: any) => {
          if (s.has_notes && s.notes_count > 0) {
            cvIdsWithNotes.push(s.cv_id);
          }
        });
        
        // Update the set of CVs with notes (for filtering and badges)
        setCvsWithNotes(new Set(cvIdsWithNotes));
      } catch (error) {
        console.warn('Failed to load notes summary for database page:', error);
      }
    };
    
    loadNotesSummary();
  }, [cvs]); // Only depend on the main cvs array, not filteredCVs

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
    let filtered = cvs;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cv => {
        const basics = getCVBasics(cv);
        return (
          basics.name.toLowerCase().includes(query) ||
          cv.id.toLowerCase().includes(query) ||
          basics.title.toLowerCase().includes(query)
        );
      });
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(cv => {
        const basics = getCVBasics(cv);
        return selectedCategories.includes(basics.category);
      });
    }

    // Apply notes filter
    if (notesFilter === 'with_notes') {
      filtered = filtered.filter(cv => cvsWithNotes.has(cv.id));
    } else if (notesFilter === 'without_notes') {
      filtered = filtered.filter(cv => !cvsWithNotes.has(cv.id));
    }

    setFilteredCVs(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [cvs, searchQuery, notesFilter, cvsWithNotes, selectedCategories]);
  
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

  // Pagination calculations - use correct data source based on view
  const currentCVs = currentView === 'categories' ? cvsInCategory : filteredCVs;
  const totalPages = Math.ceil(currentCVs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCVs = currentCVs.slice(startIndex, endIndex);

  const totalJDPages = Math.ceil(filteredJDs.length / itemsPerPage);
  const startJDIndex = (currentPage - 1) * itemsPerPage;
  const endJDIndex = startJDIndex + itemsPerPage;
  const paginatedJDs = filteredJDs.slice(startJDIndex, endJDIndex);
  
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

  // Load CVs with notes
  const loadCVsWithNotes = async () => {
    try {
      const response = await api.getAllCVsWithNotes();
      const cvIdsWithNotes = new Set(response.cvs_with_notes.map((cv: any) => cv.cv_id));
      setCvsWithNotes(cvIdsWithNotes);
      
      // Also load the actual notes for each CV
      const notesMap: Record<string, any[]> = {};
      response.cvs_with_notes.forEach((cv: any) => {
        notesMap[cv.cv_id] = cv.notes || [];
      });
      setCvNotes(notesMap);
    } catch (error) {
      console.error('Failed to load CVs with notes:', error);
    }
  };

  // Load notes for a specific CV
  const loadCVNotes = async (cvId: string) => {
    try {
      const response = await api.getCVNotes(cvId);
      setCvNotes(prev => ({
        ...prev,
        [cvId]: response.notes || []
      }));
    } catch (error) {
      console.error('Failed to load notes for CV:', error);
    }
  };

  // Handle note editing
  const handleEditNote = (cvId: string, noteIndex: number, currentNote: string) => {
    setEditingNote({ cvId, noteIndex });
    setNoteText(currentNote);
  };

  // Handle note saving
  const handleSaveNote = async (cvId: string) => {
    if (!noteText.trim() || !user?.username) return;

    setSavingNote(cvId);
    try {
      await api.addOrUpdateNote(cvId, noteText.trim(), user.username);
      await loadCVNotes(cvId);
      setEditingNote(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSavingNote(null);
    }
  };

  // Handle note deletion
  const handleDeleteNote = async (cvId: string, hrUser: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await api.deleteCVNote(cvId, hrUser);
      await loadCVNotes(cvId);
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  // Handle match selected using existing functions
  const handleMatchSelected = () => {
    if (selectedCVs.length > 0 && selectedJD) {
      // Use existing runMatch function
      runMatch();
      // Navigate to match tab after matching starts
      setCurrentTab('match');
    } else {
      alert('Please select at least one CV and one Job Description to match.');
    }
  };

  // Category selection functions
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const isCurrentlySelected = prev.includes(category);
      const newSelection = isCurrentlySelected 
        ? prev.filter(c => c !== category)
        : [...prev, category];
      
      // Get all CVs in this category
      const cvsInCategory = cvs.filter(cv => {
        const basics = getCVBasics(cv);
        return basics.category === category;
      });
      
      const cvIdsInCategory = cvsInCategory.map(cv => cv.id);
      
      if (isCurrentlySelected) {
        // Category is being deselected - deselect all CVs in this category
        cvIdsInCategory.forEach(cvId => {
          if (selectedCVs.includes(cvId)) {
            deselectCV(cvId);
          }
        });
      } else {
        // Category is being selected - select all CVs in this category
        cvIdsInCategory.forEach(cvId => {
          if (!selectedCVs.includes(cvId)) {
            selectCV(cvId);
          }
        });
      }
      
      // Always stay in 'all' view and let the filtering logic handle the display
      setCurrentView('all');
      setSelectedCategory(null);
      
      return newSelection;
    });
  };

  const selectAllCategories = () => {
    setSelectedCategories(Object.keys(categories));
    setCurrentView('all');
    setSelectedCategory(null);
    
    // Select all CVs from all categories
    cvs.forEach(cv => {
      if (!selectedCVs.includes(cv.id)) {
        selectCV(cv.id);
      }
    });
  };

  const deselectAllCategories = () => {
    setSelectedCategories([]);
    setCurrentView('all');
    setSelectedCategory(null);
    
    // Deselect all CVs
    selectedCVs.forEach(cvId => {
      deselectCV(cvId);
    });
  };

  // Function to update category selection based on CV selection
  const updateCategorySelectionFromCVs = () => {
    const selectedCategoriesFromCVs = new Set<string>();
    
    selectedCVs.forEach(cvId => {
      const cv = cvs.find(c => c.id === cvId);
      if (cv) {
        const basics = getCVBasics(cv);
        selectedCategoriesFromCVs.add(basics.category);
      }
    });
    
    // Update selected categories to match CV selection
    setSelectedCategories(Array.from(selectedCategoriesFromCVs));
  };

  // Sidebar component
  const Sidebar = () => (
    <div className={`bg-gradient-to-b from-white to-blue-50/30 border-r border-blue-200 shadow-xl transition-all duration-300 ${
      sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-80 opacity-100'
    }`}>
      <div className="p-6 space-y-6">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] text-white p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-md">
              <Filter className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-bold">Smart Filters</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(true)}
            className="h-7 w-7 p-0 text-white hover:bg-white/20"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Filter className="w-3 h-3 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">Filter by Categories</h4>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllCategories}
                className="h-6 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                title="Select All Categories"
              >
                All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllCategories}
                className="h-6 px-2 text-xs bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                title="Deselect All Categories"
              >
                None
              </Button>
            </div>
          </div>
          
          {/* Selection Summary */}
          {selectedCategories.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="text-xs text-blue-700 font-medium">
                {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
              </div>
            </div>
          )}
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {Object.entries(categories).map(([category, count]) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <div 
                  key={category} 
                  className={`flex items-center space-x-2 p-3 rounded-lg transition-all duration-200 cursor-pointer group ${
                    isSelected 
                      ? 'bg-blue-100 border border-blue-300 shadow-sm' 
                      : 'hover:bg-blue-50 border border-transparent hover:border-blue-200'
                  }`}
                  onClick={() => toggleCategory(category)}
                >
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={isSelected}
                    onChange={() => toggleCategory(category)}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-1"
                  />
                  <label 
                    htmlFor={`category-${category}`}
                    className="flex-1 text-sm font-medium cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`truncate ${isSelected ? 'text-blue-800 font-semibold' : 'text-gray-700'}`}>
                        {category}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isSelected 
                          ? 'bg-blue-200 text-blue-800' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {count}
                      </span>
                    </div>
                  </label>
                </div>
              );
            })}
            {Object.keys(categories).length === 0 && (
              <div className="text-center py-6">
                <div className="text-gray-400 mb-2">
                  <Filter className="w-6 h-6 mx-auto" />
                </div>
                <div className="text-xs text-gray-500">No categories available</div>
              </div>
            )}
          </div>
        </div>


        {/* Notes Filter */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-md">
              <MessageSquare className="w-3 h-3 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 text-sm">Notes Filter</h4>
          </div>
          
          <select
            value={notesFilter}
            onChange={(e) => setNotesFilter(e.target.value as 'all' | 'with_notes' | 'without_notes')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <option value="all">All Candidates</option>
            <option value="with_notes">With Notes</option>
            <option value="without_notes">Without Notes</option>
          </select>
        </div>

        {/* Selection Summary */}
        {(selectedCVs.length > 0 || selectedJD) && (
          <div className="space-y-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Target className="w-3 h-3 text-blue-600" />
              </div>
              <h4 className="font-semibold text-blue-900 text-sm">Selection Summary</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 p-1.5 bg-white/70 rounded-md">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-blue-800 font-medium">{selectedCVs.length} CVs selected</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 bg-white/70 rounded-md">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-blue-800 font-medium">{selectedJD ? '1 JD selected' : 'No JD selected'}</span>
              </div>
            </div>
            
            {selectedCVs.length > 0 && selectedJD && (
              <Button
                onClick={handleMatchSelected}
                className="w-full bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] hover:from-[rgba(0,82,155,0.8)] hover:to-[rgba(0,61,115,0.8)] text-white font-semibold py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
              >
                <Target className="w-4 h-4 mr-2" />
                Match Selected ({selectedCVs.length} CVs + 1 JD)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Pagination component
  const PaginationControls = ({ totalPages, currentPage, onPageChange, totalItems, itemsPerPage }: {
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  }) => {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-700">
          Showing {startItem} to {endItem} of {totalItems} items
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "primary" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
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
    <div className="space-y-8">
      {/* Progress Bar */}
      <MatchingProgressBar
        totalCVs={matchingProgress.totalCVs}
        processedCVs={matchingProgress.processedCVs}
        currentStage={matchingProgress.currentStage}
        estimatedTimeRemaining={matchingProgress.estimatedTimeRemaining}
        isVisible={matchingProgress.isVisible}
      />
      
      {/* Enhanced Header */}
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl group hover:scale-105 transition-all duration-300 shadow-2xl">
            <div 
              className="w-full h-full rounded-3xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
              style={{ 
                background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.8) 0%, rgba(0, 61, 115, 0.8) 100%)',
                boxShadow: '0 8px 32px rgba(0, 82, 155, 0.3)'
              }}
            >
              <Database className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
            Document Database
          </h1>
          <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            Manage and organize your CVs and job descriptions with intelligent insights
          </p>
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex justify-center md:justify-end">
          <div className="flex items-center space-x-3">
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
            className="px-4 py-2 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(isLoadingCVs || isLoadingJDs) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canStartMatching && (
            <Button
              variant="primary"
              onClick={handleStartMatching}
              disabled={loadingStates.matching.isLoading}
              aria-label="Start matching selected CVs with job description"
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 mr-2" />
              {loadingStates.matching.isLoading ? 'Matching...' : 'Match Selected'}
            </Button>
          )}
          </div>
        </div>
      </div>
      
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Users className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2 text-center">{cvs.length}</div>
          <p className="text-sm font-medium text-slate-600 mb-1 text-center">Total CVs</p>
          <p className="text-xs text-slate-500 text-center">Ready for matching</p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>
        
        <div className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
              }}
            >
              <FileText className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2 text-center">{jds.length}</div>
          <p className="text-sm font-medium text-slate-600 mb-1 text-center">Job Descriptions</p>
          <p className="text-xs text-slate-500 text-center">Available for matching</p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
        </div>
        
        <div className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Target className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2 text-center">{canStartMatching ? 'Yes' : 'No'}</div>
          <p className="text-sm font-medium text-slate-600 mb-1 text-center">Ready to Match</p>
          <p className="text-xs text-slate-500 text-center">Selected CVs & JD</p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by candidate name, skills, experience, or job title..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            Searching for: <span className="font-medium text-blue-600">"{searchQuery}"</span>
          </p>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={databaseActiveTab} onValueChange={(value) => setDatabaseActiveTab(value as "cvs" | "jds")} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/30 shadow-lg rounded-xl p-1 h-auto">
          <TabsTrigger 
            value="cvs" 
            className="flex items-center justify-start space-x-3 text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(0,82,155,0.7)] data-[state=active]:to-[rgba(0,61,115,0.7)] data-[state=active]:text-white transition-all duration-300 rounded-lg p-4 h-auto min-h-[60px] data-[state=inactive]:hover:bg-slate-700/50"
          >
            <Users className="w-5 h-5 text-white flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm text-white !text-white">Candidate Profiles</div>
              <div className="text-xs text-white opacity-75 !text-white">{filteredCVs.length} candidates</div>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="jds" 
            className="flex items-center justify-start space-x-3 text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(0,82,155,0.7)] data-[state=active]:to-[rgba(0,61,115,0.7)] data-[state=active]:text-white transition-all duration-300 rounded-lg p-4 h-auto min-h-[60px] data-[state=inactive]:hover:bg-slate-700/50"
          >
            <FileText className="w-5 h-5 text-white flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm text-white !text-white">Job Descriptions</div>
              <div className="text-xs text-white opacity-75 !text-white">{filteredJDs.length} positions</div>
            </div>
          </TabsTrigger>
        </TabsList>
        
        {/* CVs Tab */}
        <TabsContent value="cvs" className="space-y-4">
          <div className="flex gap-4">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main Content */}
            <div className="flex-1 transition-all duration-300">
              {/* Sidebar Toggle Button (when collapsed) */}
              {sidebarCollapsed && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSidebarCollapsed(false)}
                    className="bg-white shadow-lg"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    Show Filters
                  </Button>
                </div>
              )}
              
              {/* Main CV Listing - Only show when not in category view */}
              {currentView === 'all' && (
               <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-blue-50/10 to-indigo-50/20 rounded-xl">
             <CardHeader className="pb-4 bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] text-white rounded-t-xl">
               <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                   <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                     <Users className="w-5 h-5 text-white" />
                   </div>
                   <div>
                     <CardTitle className="text-xl font-bold text-white mb-1">Candidate Profiles</CardTitle>
                     <p className="text-white text-sm">Discover and manage your talent pool</p>
                   </div>
                 </div>
                 <div className="flex items-center space-x-3">
                   <div className="text-center bg-white/20 rounded-lg p-3 backdrop-blur-sm">
                     <div className="text-lg font-bold text-white">{selectedCVs.length}</div>
                     <div className="text-white text-xs">Selected</div>
                   </div>
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
                  {paginatedCVs.map((cv) => {
                    const b = getCVBasics(cv);
                    return (
                      <div
                        key={cv.id}
                        className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="flex items-start space-x-3">
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
                            className="h-4 w-4 text-blue-600 rounded mt-1"
                            aria-label={`Select CV for ${b.name}`}
                          />
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{b.name}</h4>
                            <p className="text-sm text-gray-500">
                              {b.title} • {b.years} years
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary">{b.skillsCount} skills</Badge>
                              <Badge variant="outline">{b.respCount} responsibilities</Badge>
                            </div>
                          </div>
                          
                          {/* Notes Section - Right Side */}
                          <div className="w-80 ml-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">
                                  Notes ({cvNotes[cv.id]?.length || 0})
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNote({ cvId: cv.id, noteIndex: -1 });
                                  setNoteText('');
                                }}
                                className="flex items-center gap-1 h-6 px-2 text-xs"
                              >
                                <Pencil className="w-3 h-3" />
                                Add
                              </Button>
                            </div>
                            
                            {/* Add/Edit Note Form */}
                            {editingNote?.cvId === cv.id && (
                              <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <textarea
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="Add note..."
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                  rows={2}
                                />
                                <div className="flex items-center gap-1 mt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSaveNote(cv.id)}
                                    disabled={savingNote === cv.id || !noteText.trim()}
                                    className="flex items-center gap-1 h-5 px-2 text-xs"
                                  >
                                    {savingNote === cv.id ? (
                                      <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                    Save
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingNote(null);
                                      setNoteText('');
                                    }}
                                    className="flex items-center gap-1 h-5 px-2 text-xs"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* Display Notes */}
                            {cvNotes[cv.id] && cvNotes[cv.id].length > 0 && (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {cvNotes[cv.id].map((note: any, noteIndex: number) => (
                                  <div key={noteIndex} className="p-2 rounded border border-gray-200 bg-gray-50">
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="text-xs font-medium text-gray-700">
                                        {note.hr_user}
                                        {note.hr_user === user?.username && (
                                          <span className="ml-1 text-xs bg-blue-200 text-blue-800 px-1 py-0.5 rounded">
                                            You
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="text-xs text-gray-500">
                                          {new Date(note.updated_at || note.created_at).toLocaleDateString()}
                                        </div>
                                        {/* Only show edit/delete buttons if user owns this note */}
                                        {note.hr_user === user?.username && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleEditNote(cv.id, noteIndex, note.note)}
                                              className="flex items-center gap-1 p-0.5 h-4 w-4"
                                              title="Edit your note"
                                            >
                                              <Pencil className="w-2 h-2" />
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleDeleteNote(cv.id, note.hr_user)}
                                              className="flex items-center gap-1 p-0.5 h-4 w-4 text-red-600 hover:text-red-700"
                                              title="Delete your note"
                                            >
                                              <X className="w-2 h-2" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-800 line-clamp-2">
                                      {note.note}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
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
                              <DialogHeader>
                                <DialogTitle className="text-xl font-semibold">CV Details</DialogTitle>
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
                  
                  {/* Pagination Controls for CVs */}
                  <PaginationControls
                    totalPages={totalPages}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    totalItems={currentCVs.length}
                    itemsPerPage={itemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
               )}
            </div>
          </div>
        </TabsContent>
        
        {/* JDs Tab */}
        <TabsContent value="jds" className="space-y-4">
          <div className="flex gap-4">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main Content */}
            <div className="flex-1 transition-all duration-300">
              {/* Sidebar Toggle Button (when collapsed) */}
              {sidebarCollapsed && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSidebarCollapsed(false)}
                    className="bg-white shadow-lg"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    Show Filters
                  </Button>
                </div>
              )}
              
               <Card className="shadow-lg border-0 bg-gradient-to-br from-white via-green-50/10 to-emerald-50/20 rounded-xl">
             <CardHeader className="pb-4 bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] text-white rounded-t-xl">
               <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                   <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                     <FileText className="w-5 h-5 text-white" />
                   </div>
                   <div>
                     <CardTitle className="text-xl font-bold text-white mb-1">Job Descriptions</CardTitle>
                     <p className="text-white text-sm">Define and manage position requirements</p>
                   </div>
                 </div>
                 <div className="flex items-center space-x-3">
                   <div className="text-center bg-white/20 rounded-lg p-3 backdrop-blur-sm">
                     <div className="text-lg font-bold text-white">{selectedJD ? '1' : '0'}</div>
                     <div className="text-white text-xs">Selected</div>
                   </div>
                 </div>
               </div>
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
                  {paginatedJDs.map((jd) => {
                    const b = getJDBasics(jd);
                    return (
                      <div
                        key={jd.id}
                        className={`group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                          selectedJD === jd.id ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
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
                              <DialogHeader>
                                <DialogTitle className="text-xl font-semibold">Job Description Details</DialogTitle>
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
                  
                  {/* Pagination Controls for JDs */}
                  <PaginationControls
                    totalPages={totalJDPages}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    totalItems={filteredJDs.length}
                    itemsPerPage={itemsPerPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------- CV Details (modal) --------------------------- */
function CVDetails({ cvId }: { cvId: string }) {
  const { user } = useAuthStore();
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
    <div className="space-y-8">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 backdrop-blur-sm rounded-2xl p-8 border border-blue-100/50 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div 
              className="bg-white rounded-full p-4 shadow-lg group-hover:shadow-xl transition-all duration-300"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
              }}
            >
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent mb-2">{b.name}</h2>
              <div className="flex items-center space-x-2 mb-3">
                <Briefcase className="w-5 h-5 text-slate-500" />
                <span className="text-xl font-semibold text-slate-700">{b.title}</span>
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

      {/* Enhanced Contact Information */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/30 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center space-x-2 mb-4">
          <div 
            className="bg-green-100 rounded-full p-3 shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Contact Information</h3>
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
      
      {/* Admin-only sections */}
      {user?.role === 'admin' && (
        <>
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
        </>
      )}
      
      {/* Admin-only Technical Information */}
      {user?.role === 'admin' && (
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
      )}
    </div>
  );
}

/* ---------------------------- JD Details (modal) --------------------------- */
function JDDetails({ jdId }: { jdId: string }) {
  const { user } = useAuthStore();
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
      
      {/* Admin-only sections */}
      {user?.role === 'admin' && (
        <>
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
        </>
      )}
      
      {/* Admin-only Technical Information */}
      {user?.role === 'admin' && (
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
      )}
      
      {/* Admin-only: collapsible raw JSON for debugging */}
      {user?.role === 'admin' && (
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
      )}
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