// components/database/DatabasePageNew.tsx
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
  Settings,
  Brain
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
/* ----------------------------- Small utilities ---------------------------- */
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'N/A';
  }
};
const getCVBasics = (cv: any) => {
  // Handle nested API response structure: response.cv.candidate
  const candidate = cv?.cv?.candidate || cv?.candidate || {};
  const cvData = cv?.cv || cv;
  
  return {
    name: candidate?.full_name || cvData?.full_name || 'Unknown',
    title: candidate?.job_title || cvData?.job_title || 'Unknown', 
    years: candidate?.years_of_experience || cvData?.years_of_experience || '0',
    skillsCount: candidate?.skills_count || candidate?.skills?.length || cvData?.skills?.length || 0,
    respCount: candidate?.responsibilities_count || candidate?.responsibilities?.length || cvData?.responsibilities?.length || 0,
  };
};
const getJDBasics = (jd: any) => {
  // Handle nested API response structure: response.jd or direct response
  const jdData = jd?.jd || jd;
  const src = jdData?.job_requirements || jdData?.structured_info || {};
  
  const title = src.job_title ?? jdData?.job_title ?? 'N/A';
  const years =
    src.years_of_experience ?? src.experience_years ?? jdData?.years_of_experience ?? '0';
  const skills =
    src.skills ??
    jdData?.skills ??
    [];
  const responsibilities =
    src.responsibilities ??
    src.responsibility_sentences ??
    jdData?.responsibilities ??
    [];
  const skillsCount =
    src.skills_count ?? jdData?.skills_count ?? (Array.isArray(skills) ? skills.length : 0);
  const responsibilitiesCount =
    src.responsibilities_count ??
    jdData?.responsibilities_count ??
    (Array.isArray(responsibilities) ? responsibilities.length : 0);
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
  const [showJDJSON, setShowJDJSON] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCVs, setFilteredCVs] = useState<any[]>([]);
  const [filteredJDs, setFilteredJDs] = useState<any[]>([]);

  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);

  useEffect(() => {
    // Filter CVs based on search query
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
    // Filter JDs based on search query
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
  const handleStartMatching = () => {
    // Navigate to match tab immediately to show loading animation
    setCurrentTab('match');
    
    // The MatchingPageNew component will automatically detect selectedJD and selectedCVs
    // and start the matching process, showing the loading animation
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  const clearSearch = () => {
    setSearchQuery('');
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
          <Button
            variant="outline"
            onClick={() => {
              loadCVs();
              loadJDs();
            }}
            disabled={isLoadingCVs || isLoadingJDs}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {canStartMatching && (
            <Button
              variant="primary"
              onClick={handleStartMatching}
            >
              <Play className="w-4 h-4 mr-2" />
              Match Selected
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
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogHeader>
                              <CVDetails cvId={cv.id} />
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="sm" onClick={() => handleReprocessCV(cv.id)} disabled={isDeleting}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCV(cv.id)}
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-700"
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
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogHeader>
                              <JDDetails jdId={jd.id} />
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="sm" onClick={() => handleReprocessJD(jd.id)} disabled={isDeleting}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJD(jd.id)}
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-700"
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
  const [cv, setCV] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const loadCV = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getCVDetails(cvId);
        const cvData = response;
        setCV(cvData);
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
              <p className="font-semibold text-blue-600 break-all">{cv.structured_info?.contact_info?.email || cv.structured_info?.email || cv.candidate?.contact_info?.email || 'Not available'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <Phone className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Phone</p>
              <p className="font-semibold text-green-600">{cv.structured_info?.contact_info?.phone || cv.structured_info?.phone || cv.candidate?.contact_info?.phone || 'Not available'}</p>
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
            {b.skillsCount} skills
          </Badge>
        </div>
        {(() => {
          const skills = cv?.cv?.candidate?.skills || cv?.candidate?.skills || cv?.cv?.skills || cv?.skills || [];
          return skills.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {skills.map((skill: string, i: number) => (
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
          );
        })()}
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
            {b.respCount} items
          </Badge>
        </div>
        {(() => {
          const responsibilities = cv?.cv?.candidate?.responsibilities || cv?.candidate?.responsibilities || cv?.cv?.responsibilities || cv?.responsibilities || [];
          return responsibilities.length ? (
            <div className="space-y-4">
              {responsibilities.map((resp: string, i: number) => (
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
          );
        })()}
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
            {cv?.cv?.text_info?.extracted_text_preview || cv?.text_info?.extracted_text_preview || cv?.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>Document length: {cv?.cv?.text_info?.extracted_text_length || cv?.text_info?.extracted_text_length || cv?.extracted_text_length || 0} characters</span>
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
              <Badge variant="outline" className="bg-white">{cv?.cv?.embeddings_info?.skills_embeddings || cv?.embeddings_info?.skills_embeddings || cv?.skills_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Responsibilities Embeddings</span>
              <Badge variant="outline" className="bg-white">{cv?.cv?.embeddings_info?.responsibilities_embeddings || cv?.embeddings_info?.responsibilities_embeddings || cv?.responsibilities_embeddings || 0}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Model Used</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.processing_metadata?.model_used || cv?.processing_metadata?.model_used || cv?.model_used || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Processing Time</span>
              <span className="text-sm font-semibold text-gray-800">
                {cv?.cv?.processing_metadata?.processing_time || cv?.processing_metadata?.processing_time || cv?.processing_time
                  ? `${((cv?.cv?.processing_metadata?.processing_time ?? cv?.processing_metadata?.processing_time ?? cv?.processing_time) as number).toFixed(2)}s`
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
              <Badge variant={(cv?.cv?.embeddings_info?.has_title_embedding || cv?.embeddings_info?.has_title_embedding || cv?.has_title_embedding) ? "success" : "outline"}>
                {(cv?.cv?.embeddings_info?.has_title_embedding || cv?.embeddings_info?.has_title_embedding || cv?.has_title_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Experience Embedding</span>
              <Badge variant={(cv?.cv?.embeddings_info?.has_experience_embedding || cv?.embeddings_info?.has_experience_embedding || cv?.has_experience_embedding) ? "success" : "outline"}>
                {(cv?.cv?.embeddings_info?.has_experience_embedding || cv?.embeddings_info?.has_experience_embedding || cv?.has_experience_embedding) ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Embedding Dimension</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.embeddings_info?.embedding_dimension || cv?.embeddings_info?.embedding_dimension || cv?.embedding_dimension || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Text Length</span>
              <span className="text-sm font-semibold text-gray-800">{cv?.cv?.processing_metadata?.text_length || cv?.cv?.text_info?.extracted_text_length || cv?.processing_metadata?.text_length || cv?.text_info?.extracted_text_length || cv?.text_length || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
/* ---------------------------- JD Details (modal) --------------------------- */
function JDDetails({ jdId }: { jdId: string }) {
  const [jd, setJD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJSON, setShowJSON] = useState(false);
  useEffect(() => {
    const loadJD = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getJDDetails(jdId);
        // accept several shapes
        const jdData = response;
        setJD(jdData);
      } catch (err: any) {
        setError(err.message || 'Failed to load JD details');
      } finally {
        setLoading(false);
      }
    };
    loadJD();
  }, [jdId]);
  if (loading) return <div className="flex items-center justify-center py-8">Loading JD details...</div>;
  if (error)
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Job Description</h3>
        <p className="text-red-500 mb-4">{error}</p>
      </div>
    );
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
          <Row label="Upload Date" value={formatDate(jd.upload_date)} />
          <Row label="Document Type" value={jd.document_type || 'jd'} />
        </div>
      </div>
      {/* Required Skills */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Required Skills</h3>
          <Badge className="ml-2">{b.skillsCount}</Badge>
        </div>
        {b.skillsCount > 0 ? (
          <ul className="space-y-2">
            {b.skills.map((s: string, i: number) => (
              <li key={i} className="text-gray-700">{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No skills information available</p>
        )}
      </div>
      {/* Responsibilities */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Responsibilities</h3>
          <Badge className="ml-2">{b.responsibilitiesCount}</Badge>
        </div>
        {b.responsibilitiesCount > 0 ? (
          <ul className="space-y-2">
            {b.responsibilities.map((r: string, i: number) => (
              <li key={i} className="text-gray-700">{r}</li>
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
            {jd.text_info?.extracted_text_preview || jd.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Text length: {jd.text_info?.extracted_text_length || jd.extracted_text_length || 0} characters
        </div>
      </div>
      {/* Processing / Embeddings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Embeddings Information</h3>
          <div className="space-y-2">
            <Row label="Skills Embeddings" value={jd?.jd?.embeddings_info?.skills_embeddings || jd?.embeddings_info?.skills_embeddings || jd?.skills_embeddings || 0} />
            <Row
              label="Responsibilities Embeddings"
              value={jd?.jd?.embeddings_info?.responsibilities_embeddings || jd?.embeddings_info?.responsibilities_embeddings || jd?.responsibilities_embeddings || 0}
            />
            <Row
              label="Title Embedding"
              value={(jd?.jd?.embeddings_info?.has_title_embedding || jd?.embeddings_info?.has_title_embedding || jd?.has_title_embedding) ? 'Yes' : 'No'}
            />
            <Row
              label="Experience Embedding"
              value={(jd?.jd?.embeddings_info?.has_experience_embedding || jd?.embeddings_info?.has_experience_embedding || jd?.has_experience_embedding) ? 'Yes' : 'No'}
            />
            <Row label="Embedding Dimension" value={jd?.jd?.embeddings_info?.embedding_dimension || jd?.embeddings_info?.embedding_dimension || jd?.embedding_dimension || 'N/A'} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Processing Information</h3>
          <div className="space-y-2">
            <Row label="Filename" value={jd?.jd?.processing_metadata?.filename || jd?.processing_metadata?.filename || jd?.jd?.filename || jd?.filename || 'N/A'} mono />
            <Row label="Model Used" value={jd?.jd?.processing_metadata?.model_used || jd?.processing_metadata?.model_used || jd?.model_used || 'N/A'} />
            <Row
  label="Processing Time"
  value={
    jd?.jd?.processing_metadata?.processing_time || jd?.processing_metadata?.processing_time || jd?.processing_time
      ? `${(
          (jd?.jd?.processing_metadata?.processing_time ??
            jd?.processing_metadata?.processing_time ??
            jd?.processing_time) as number
        ).toFixed(2)}s`
      : 'N/A'
  }
/>
            <Row label="Text Length" value={jd?.jd?.processing_metadata?.text_length || jd?.jd?.text_info?.extracted_text_length || jd?.processing_metadata?.text_length || jd?.text_info?.extracted_text_length || jd?.text_length || 0} />
          </div>
        </div>
      </div>
      {/* Optional: collapsible raw JSON for debugging */}
      <div className="mt-2">
        <button
          className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setShowJSON((s) => !s)}
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