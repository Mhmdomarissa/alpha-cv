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
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';

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
  } = useAppStore();
  
  const [selectedCVForDetails, setSelectedCVForDetails] = useState<string | null>(null);
  const [selectedJDForDetails, setSelectedJDForDetails] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCVs, setFilteredCVs] = useState<CVData[]>([]);
  const [filteredJDs, setFilteredJDs] = useState<JDData[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);
  
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
      await api.clearDatabase(true);
      await loadCVs();
      await loadJDs();
      setShowClearDialog(false);
    } catch (error: any) {
      console.error('Failed to clear database:', error);
    } finally {
      setIsClearing(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg">Document Database</h1>
          <p className="text-lg mt-1" style={{ color: 'var(--gray-600)' }}>
            Manage your CVs and job descriptions
          </p>
        </div>
        <div className="flex items-center space-x-3">
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
                            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-lg shadow-xl">
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
  
  if (loading) return <div className="flex items-center justify-center py-8">Loading CV details...</div>;
  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading CV</h3>
        <p className="text-red-500 mb-4">{error}</p>
      </div>
    );
  }
  if (!cv) return <div className="text-center py-8">CV not found</div>;
  
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
  
  return (
    <div className="space-y-4">
      {/* Candidate Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Candidate Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Full Name</h4>
            <p className="text-base font-semibold">{b.name}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Job Title</h4>
            <p className="text-base font-semibold">{b.title}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Experience</h4>
            <p className="text-base font-semibold">{b.years} years</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Upload Date</h4>
            <p className="text-base font-semibold">{formatDate(cv?.cv?.upload_date || cv?.upload_date)}</p>
          </div>
        </div>
        
        {/* Contact Information */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-blue-600">{contactInfo.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium text-blue-600">{contactInfo.phone}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Skills */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Skills</h3>
          <Badge variant="secondary">{b.skillsCount}</Badge>
        </div>
        {skillsData.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {safeArrayMap(skillsData, (skill: string, i: number) => (
              <Badge key={i} variant="outline" className="text-sm">
                {skill}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No skills information available</p>
        )}
      </div>
      
      {/* Responsibilities */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Responsibilities</h3>
          <Badge variant="secondary">{b.respCount}</Badge>
        </div>
        {responsibilitiesData.length > 0 ? (
          <ul className="space-y-2">
            {safeArrayMap(responsibilitiesData, (resp: string, i: number) => (
              <li key={i} className="text-gray-700 flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                {resp}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No responsibilities information available</p>
        )}
      </div>
      
      {/* Text Preview */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Text Preview</h3>
        <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {cv?.cv?.text_info?.extracted_text_preview || cv?.text_info?.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Text length: {cv?.cv?.text_info?.extracted_text_length || cv?.text_info?.extracted_text_length || 0} characters
        </div>
      </div>
      
      {/* Processing / Embeddings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Embeddings Information</h3>
          <div className="space-y-2">
            <Row label="Skills Embeddings" value={cv?.cv?.embeddings_info?.skills_embeddings || cv?.embeddings_info?.skills_embeddings || 0} />
            <Row label="Responsibilities Embeddings" value={cv?.cv?.embeddings_info?.responsibilities_embeddings || cv?.embeddings_info?.responsibilities_embeddings || 0} />
            <Row label="Title Embedding" value={(cv?.cv?.embeddings_info?.has_title_embedding || cv?.embeddings_info?.has_title_embedding) ? 'Yes' : 'No'} />
            <Row label="Experience Embedding" value={(cv?.cv?.embeddings_info?.has_experience_embedding || cv?.embeddings_info?.has_experience_embedding) ? 'Yes' : 'No'} />
            <Row label="Embedding Dimension" value={cv?.cv?.embeddings_info?.embedding_dimension || cv?.embeddings_info?.embedding_dimension || 'N/A'} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Processing Information</h3>
          <div className="space-y-2">
            <Row label="Filename" value={cv?.cv?.processing_metadata?.filename || cv?.processing_metadata?.filename || cv?.cv?.filename || cv?.filename || 'N/A'} mono />
            <Row label="Model Used" value={cv?.cv?.processing_metadata?.model_used || cv?.processing_metadata?.model_used || 'N/A'} />
            <Row
              label="Processing Time"
              value={
                cv?.cv?.processing_metadata?.processing_time || cv?.processing_metadata?.processing_time
                  ? `${(
                      (cv?.cv?.processing_metadata?.processing_time ??
                        cv?.processing_metadata?.processing_time) as number
                    ).toFixed(2)}s`
                  : 'N/A'
              }
            />
            <Row label="Text Length" value={cv?.cv?.processing_metadata?.text_length || cv?.cv?.text_info?.extracted_text_length || cv?.processing_metadata?.text_length || cv?.text_info?.extracted_text_length || 0} />
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
  
  if (loading) return <div className="flex items-center justify-center py-8">Loading JD details...</div>;
  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Job Description</h3>
        <p className="text-red-500 mb-4">{error}</p>
      </div>
    );
  }
  if (!jd) return <div className="text-center py-8">Job Description not found</div>;
  
  const b = getJDBasics(jd);
  
  return (
    <div className="space-y-4">
      {/* Job Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Job Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Row label="Job Title" value={b.title} />
          <Row label="Experience Required" value={`${b.years} years`} />
          <Row label="Upload Date" value={formatDate(jd?.jd?.upload_date || jd?.upload_date)} />
          <Row label="Document Type" value={jd?.jd?.document_type || 'jd'} />
        </div>
      </div>
      
      {/* Required Skills */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Required Skills</h3>
          <Badge variant="secondary">{b.skillsCount}</Badge>
        </div>
        {b.skillsCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {safeArrayMap(b.skills, (skill: string, i: number) => (
              <Badge key={i} variant="outline" className="text-sm">
                {skill}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No skills information available</p>
        )}
      </div>
      
      {/* Responsibilities */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Responsibilities</h3>
          <Badge variant="secondary">{b.responsibilitiesCount}</Badge>
        </div>
        {b.responsibilitiesCount > 0 ? (
          <ul className="space-y-2">
            {safeArrayMap(b.responsibilities, (resp: string, i: number) => (
              <li key={i} className="text-gray-700 flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                {resp}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No responsibilities information available</p>
        )}
      </div>
      
      {/* Text Preview */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Text Preview</h3>
        <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {jd?.jd?.text_info?.extracted_text_preview || jd?.text_info?.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Text length: {jd?.jd?.text_info?.extracted_text_length || jd?.text_info?.extracted_text_length || 0} characters
        </div>
      </div>
      
      {/* Processing / Embeddings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Embeddings Information</h3>
          <div className="space-y-2">
            <Row label="Skills Embeddings" value={jd?.jd?.embeddings_info?.skills_embeddings || jd?.embeddings_info?.skills_embeddings || 0} />
            <Row
              label="Responsibilities Embeddings"
              value={jd?.jd?.embeddings_info?.responsibilities_embeddings || jd?.embeddings_info?.responsibilities_embeddings || 0}
            />
            <Row
              label="Title Embedding"
              value={(jd?.jd?.embeddings_info?.has_title_embedding || jd?.embeddings_info?.has_title_embedding) ? 'Yes' : 'No'}
            />
            <Row
              label="Experience Embedding"
              value={(jd?.jd?.embeddings_info?.has_experience_embedding || jd?.embeddings_info?.has_experience_embedding) ? 'Yes' : 'No'}
            />
            <Row label="Embedding Dimension" value={jd?.jd?.embeddings_info?.embedding_dimension || jd?.embeddings_info?.embedding_dimension || 'N/A'} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Processing Information</h3>
          <div className="space-y-2">
            <Row label="Filename" value={jd?.jd?.processing_metadata?.filename || jd?.processing_metadata?.filename || jd?.jd?.filename || jd?.filename || 'N/A'} mono />
            <Row label="Model Used" value={jd?.jd?.processing_metadata?.model_used || jd?.processing_metadata?.model_used || 'N/A'} />
            <Row
              label="Processing Time"
              value={
                jd?.jd?.processing_metadata?.processing_time || jd?.processing_metadata?.processing_time
                  ? `${(
                      (jd?.jd?.processing_metadata?.processing_time ??
                        jd?.processing_metadata?.processing_time) as number
                    ).toFixed(2)}s`
                  : 'N/A'
              }
            />
            <Row label="Text Length" value={jd?.jd?.processing_metadata?.text_length || jd?.jd?.text_info?.extracted_text_length || jd?.processing_metadata?.text_length || jd?.text_info?.extracted_text_length || 0} />
          </div>
        </div>
      </div>
      
      {/* Optional: collapsible raw JSON for debugging */}
      <div className="mt-2">
        <button
          className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setShowJSON((s) => !s)}
          aria-label={showJSON ? 'Hide raw JSON data' : 'Show raw JSON data'}
        >
          <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showJSON ? 'rotate-180' : ''}`} />
          {showJSON ? 'Hide raw JSON' : 'Show raw JSON'}
        </button>
        {showJSON && (
          <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border max-h-60 overflow-auto">
            {JSON.stringify(jd, null, 2)}
          </pre>
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