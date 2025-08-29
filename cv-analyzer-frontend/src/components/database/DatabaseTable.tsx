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
  const c = cv?.candidate || {};
  return {
    name: cv?.full_name ?? c.full_name ?? 'Unknown',
    title: cv?.job_title ?? c.job_title ?? 'Unknown',
    years: cv?.years_of_experience ?? c.years_of_experience ?? '0',
    skillsCount: cv?.skills_count ?? c.skills_count ?? (cv?.skills?.length ?? c.skills?.length ?? 0),
    respCount:
      cv?.responsibilities_count ??
      c.responsibilities_count ??
      (cv?.responsibilities?.length ?? c.responsibilities?.length ?? 0),
  };
};
const getJDBasics = (jd: any) => {
  const src = jd?.job_requirements || jd?.structured_info || {};
  const title = src.job_title ?? jd?.job_title ?? 'N/A';
  const years =
    src.years_of_experience ?? src.experience_years ?? jd?.years_of_experience ?? '0';
  const skills =
    src.skills ??
    jd?.skills ??
    [];
  const responsibilities =
    src.responsibilities ??
    src.responsibility_sentences ??
    jd?.responsibilities ??
    [];
  const skillsCount =
    src.skills_count ?? jd?.skills_count ?? (Array.isArray(skills) ? skills.length : 0);
  const responsibilitiesCount =
    src.responsibilities_count ??
    jd?.responsibilities_count ??
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
              disabled={loadingStates.matching.isLoading}
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
                            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-lg shadow-xl">
                              <DialogHeader className="flex flex-row items-center justify-between">
                                <DialogTitle className="text-xl font-semibold">CV Details</DialogTitle>
                                <Button
                                  variant="ghost"
                                  size="icon"
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
                                  size="icon"
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
        const cvData = response.cv || response.data || response;
        setCV(cvData);
      } catch (err: any) {
        setError(err.message || 'Failed to load CV details');
      } finally {
        setLoading(false);
      }
    };
    loadCV();
  }, [cvId]);
  if (loading) return <div className="flex items-center justify-center py-8">Loading CV details...</div>;
  if (error)
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading CV</h3>
        <p className="text-red-500 mb-4">{error}</p>
      </div>
    );
  if (!cv) return <div className="text-center py-8">CV not found</div>;
  const b = getCVBasics(cv);
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
            <p className="text-base font-semibold">{formatDate(cv.upload_date)}</p>
          </div>
        </div>
        {/* Contact Information */}
        {(cv.contact_info || cv.structured_info?.contact_info) && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">
                  {cv.contact_info?.email || cv.structured_info?.contact_info?.email || 'not provided'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">
                  {cv.contact_info?.phone || cv.structured_info?.contact_info?.phone || 'not provided'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Skills */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Skills</h3>
          <Badge className="ml-2">{b.skillsCount}</Badge>
        </div>
        {(cv.skills || cv.candidate?.skills)?.length ? (
          <ul className="space-y-2">
            {(cv.skills || cv.candidate?.skills).map((skill: string, i: number) => (
              <li key={i} className="text-gray-700">{skill}</li>
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
          <Badge className="ml-2">{b.respCount}</Badge>
        </div>
        {(cv.responsibilities || cv.candidate?.responsibilities)?.length ? (
          <ul className="space-y-2">
            {(cv.responsibilities || cv.candidate?.responsibilities).map((resp: string, i: number) => (
              <li key={i} className="text-gray-700">{resp}</li>
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
            {cv.text_info?.extracted_text_preview || cv.extracted_text_preview || 'No text preview available'}
          </p>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Text length: {cv.text_info?.extracted_text_length || cv.extracted_text_length || 0} characters
        </div>
      </div>
      {/* Processing / Embeddings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Embeddings Information</h3>
          <div className="space-y-2">
            <Row label="Skills Embeddings" value={cv.embeddings_info?.skills_embeddings || cv.skills_embeddings || 0} />
            <Row label="Responsibilities Embeddings" value={cv.embeddings_info?.responsibilities_embeddings || cv.responsibilities_embeddings || 0} />
            <Row label="Title Embedding" value={(cv.embeddings_info?.has_title_embedding || cv.has_title_embedding) ? 'Yes' : 'No'} />
            <Row label="Experience Embedding" value={(cv.embeddings_info?.has_experience_embedding || cv.has_experience_embedding) ? 'Yes' : 'No'} />
            <Row label="Embedding Dimension" value={cv.embeddings_info?.embedding_dimension || cv.embedding_dimension || 'N/A'} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Processing Information</h3>
          <div className="space-y-2">
            <Row label="Filename" value={cv.processing_metadata?.filename || cv.filename || 'N/A'} mono />
            <Row label="Model Used" value={cv.processing_metadata?.model_used || cv.model_used || 'N/A'} />
            <Row
  label="Processing Time"
  value={
    cv.processing_metadata?.processing_time || cv.processing_time
      ? `${(
          (cv.processing_metadata?.processing_time ??
            cv.processing_time) as number
        ).toFixed(2)}s`
      : 'N/A'
  }
/>
            <Row label="Text Length" value={cv.processing_metadata?.text_length || cv.text_length || 0} />
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
        const jdData = response.jd || response.data || response.job_description || response;
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
            <Row label="Skills Embeddings" value={jd.embeddings_info?.skills_embeddings || jd.skills_embeddings || 0} />
            <Row
              label="Responsibilities Embeddings"
              value={jd.embeddings_info?.responsibilities_embeddings || jd.responsibilities_embeddings || 0}
            />
            <Row
              label="Title Embedding"
              value={(jd.embeddings_info?.has_title_embedding || jd.has_title_embedding) ? 'Yes' : 'No'}
            />
            <Row
              label="Experience Embedding"
              value={(jd.embeddings_info?.has_experience_embedding || jd.has_experience_embedding) ? 'Yes' : 'No'}
            />
            <Row label="Embedding Dimension" value={jd.embeddings_info?.embedding_dimension || jd.embedding_dimension || 'N/A'} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Processing Information</h3>
          <div className="space-y-2">
            <Row label="Filename" value={jd.processing_metadata?.filename || jd.filename || 'N/A'} mono />
            <Row label="Model Used" value={jd.processing_metadata?.model_used || jd.model_used || 'N/A'} />
            <Row
  label="Processing Time"
  value={
    jd.processing_metadata?.processing_time || jd.processing_time
      ? `${(
          (jd.processing_metadata?.processing_time ??
            jd.processing_time) as number
        ).toFixed(2)}s`
      : 'N/A'
  }
/>
            <Row label="Text Length" value={jd.processing_metadata?.text_length || jd.text_length || 0} />
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