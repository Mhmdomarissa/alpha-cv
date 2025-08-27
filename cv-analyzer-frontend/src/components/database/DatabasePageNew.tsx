'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Users, 
  FileText, 
  Calendar, 
  Star, 
  Eye, 
  Trash2, 
  CheckSquare, 
  Square,
  ArrowRight,
  BarChart3,
  Clock,
  Award,
  TrendingUp,
  Download,
  Plus,
  Target
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { CVListItem, JDListItem } from '@/lib/types';
import DatabaseViewerModal from '@/components/ui/database-viewer-modal';

type DocumentType = 'all' | 'cv' | 'jd';
type SortBy = 'date' | 'name' | 'experience';
type SortOrder = 'asc' | 'desc';

export default function DatabasePageNew() {
  const { 
    cvs, 
    jds, 
    selectedJD, 
    selectedCVs, 
    selectJD, 
    selectCV, 
    deselectCV, 
    loadCVs, 
    loadJDs, 
    setCurrentTab,
    runMatch,
    loadingStates 
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedForMatching, setSelectedForMatching] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (cvs.length === 0) loadCVs();
    if (jds.length === 0) loadJDs();
  }, [cvs.length, jds.length, loadCVs, loadJDs]);

  // Analytics calculations
  const totalDocuments = cvs.length + jds.length;
  const avgExperience = cvs.length > 0 
    ? cvs.reduce((sum, cv) => sum + (parseInt(cv.years_of_experience || '0') || 0), 0) / cvs.length 
    : 0;
  const matchReady = selectedCVs.length > 0 && selectedJD;

  // Filter and sort documents
  const filteredCVs = cvs.filter(cv => {
    if (documentType !== 'all' && documentType !== 'cv') return false;
    if (!searchQuery) return true;
    
    const searchTerms = searchQuery.toLowerCase();
    return (
      cv.full_name?.toLowerCase().includes(searchTerms) ||
      cv.job_title?.toLowerCase().includes(searchTerms) ||
      cv.skills?.some(skill => skill.toLowerCase().includes(searchTerms))
    );
  });

  const filteredJDs = jds.filter(jd => {
    if (documentType !== 'all' && documentType !== 'jd') return false;
    if (!searchQuery) return true;
    
    const searchTerms = searchQuery.toLowerCase();
    return (
      jd.job_title?.toLowerCase().includes(searchTerms) ||
      jd.skills?.some(skill => skill.toLowerCase().includes(searchTerms))
    );
  });

  const handleStartMatching = async () => {
    if (selectedCVs.length > 0 && selectedJD) {
      await runMatch();
      setCurrentTab('match');
    }
  };

  const handleCVToggle = (cvId: string) => {
    if (selectedCVs.includes(cvId)) {
      deselectCV(cvId);
    } else {
      selectCV(cvId);
    }
  };

  const handleJDSelect = (jdId: string) => {
    if (selectedJD === jdId) {
      selectJD(null);
    } else {
      selectJD(jdId);
    }
  };

  const clearSelections = () => {
    selectedCVs.forEach(cvId => deselectCV(cvId));
    selectJD(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="heading-lg">Your Documents Database</h1>
        <p className="text-lg mt-2" style={{ color: 'var(--gray-600)' }}>
          Step 2: Review Data
        </p>
        <p className="text-base mt-1" style={{ color: 'var(--gray-500)' }}>
          Manage your uploaded documents and select them for AI matching
        </p>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <FileText className="w-6 h-6" style={{ color: 'var(--primary-600)' }} />
            </div>
          </div>
          <div className="heading-md">{totalDocuments}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Total Documents</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            {cvs.length} CVs, {jds.length} JDs
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <Users className="w-6 h-6" style={{ color: 'var(--green-600)' }} />
            </div>
          </div>
          <div className="heading-md">{cvs.length}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Processed CVs</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Ready for matching
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--yellow-50)' }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: 'var(--yellow-600)' }} />
            </div>
          </div>
          <div className="heading-md">{avgExperience.toFixed(1)}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Avg Experience</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Years across all CVs
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                backgroundColor: matchReady ? 'var(--green-50)' : 'var(--gray-100)' 
              }}
            >
              <Target 
                className="w-6 h-6" 
                style={{ 
                  color: matchReady ? 'var(--green-600)' : 'var(--gray-400)' 
                }} 
              />
            </div>
          </div>
          <div 
            className="heading-md"
            style={{ 
              color: matchReady ? 'var(--green-600)' : 'var(--gray-500)' 
            }}
          >
            {matchReady ? 'Ready' : 'Select'}
          </div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Match Status</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            {selectedCVs.length} CVs, {selectedJD ? '1 JD' : '0 JDs'} selected
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--gray-400)' }} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              style={{
                borderColor: 'var(--gray-300)',
              }}
            />
          </div>

          {/* Filters */}
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            style={{
              borderColor: 'var(--gray-300)',
            }}
          >
            <option value="all">All Documents</option>
            <option value="cv">CVs Only</option>
            <option value="jd">JDs Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            style={{
              borderColor: 'var(--gray-300)',
            }}
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="experience">Sort by Experience</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setCurrentTab('upload')}
            className="btn-outline"
          >
            <Plus className="w-4 h-4" />
            Add More
          </button>
          
          {(selectedCVs.length > 0 || selectedJD) && (
            <button
              onClick={clearSelections}
              className="btn-outline"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Job Descriptions Section */}
      {(documentType === 'all' || documentType === 'jd') && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--green-600)' }} />
            </div>
            <h3 className="heading-sm">Job Descriptions ({filteredJDs.length})</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJDs.map((jd) => (
              <div 
                key={jd.id}
                className={`card transition-all duration-200 cursor-pointer ${
                  selectedJD === jd.id ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{
                  borderColor: selectedJD === jd.id ? 'var(--primary-300)' : 'var(--gray-200)',
                }}
                onClick={() => handleJDSelect(jd.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--green-50)' }}
                    >
                      <FileText className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {jd.job_title || 'Untitled Position'}
                      </h4>
                      <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                        {jd.years_of_experience} years required
                      </p>
                    </div>
                  </div>
                  {selectedJD === jd.id ? (
                    <CheckSquare className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                  ) : (
                    <Square className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--gray-600)' }}>
                      KEY SKILLS ({jd.skills?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {jd.skills?.slice(0, 4).map((skill, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: 'var(--green-50)', 
                            color: 'var(--green-700)' 
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {(jd.skills?.length || 0) > 4 && (
                        <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                          +{(jd.skills?.length || 0) - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--gray-600)' }}>
                      DOCUMENT INFO
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • File: {jd.filename}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • Text length: {jd.text_length} chars
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • Skills required: {jd.skills_count}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--gray-200)' }}>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3 h-3" style={{ color: 'var(--gray-400)' }} />
                      <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                        {new Date(jd.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(true);
                      }}
                      className="text-xs p-1 rounded"
                      style={{ color: 'var(--primary-600)' }}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredJDs.length === 0 && (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--gray-100)' }}
              >
                <FileText className="w-8 h-8" style={{ color: 'var(--gray-400)' }} />
              </div>
              <h3 className="heading-sm mb-2" style={{ color: 'var(--gray-700)' }}>
                No job descriptions found
              </h3>
              <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                Upload some job descriptions to get started with matching
              </p>
              <button
                onClick={() => setCurrentTab('upload')}
                className="btn-primary mt-4"
              >
                <Plus className="w-4 h-4" />
                Upload JDs
              </button>
            </div>
          )}
        </div>
      )}

      {/* CVs Section */}
      {(documentType === 'all' || documentType === 'cv') && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <Users className="w-4 h-4" style={{ color: 'var(--primary-600)' }} />
            </div>
            <h3 className="heading-sm">Candidate CVs ({filteredCVs.length})</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCVs.map((cv) => (
              <div 
                key={cv.id}
                className={`card transition-all duration-200 cursor-pointer ${
                  selectedCVs.includes(cv.id) ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{
                  borderColor: selectedCVs.includes(cv.id) ? 'var(--primary-300)' : 'var(--gray-200)',
                }}
                onClick={() => handleCVToggle(cv.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--primary-50)' }}
                    >
                      <Users className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {cv.full_name || 'Unknown Candidate'}
                      </h4>
                      <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                        {cv.job_title || 'No title'} • {cv.years_of_experience} years
                      </p>
                    </div>
                  </div>
                  {selectedCVs.includes(cv.id) ? (
                    <CheckSquare className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                  ) : (
                    <Square className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--gray-600)' }}>
                      SKILLS ({cv.skills_count || 0})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {cv.skills?.slice(0, 4).map((skill, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: 'var(--primary-50)', 
                            color: 'var(--primary-700)' 
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {(cv.skills?.length || 0) > 4 && (
                        <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                          +{(cv.skills?.length || 0) - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--gray-600)' }}>
                      DOCUMENT INFO
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • File: {cv.filename}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • Text length: {cv.text_length} chars
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        • Structured data: {cv.has_structured_data ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--gray-200)' }}>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3 h-3" style={{ color: 'var(--gray-400)' }} />
                      <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                        {new Date(cv.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(true);
                      }}
                      className="text-xs p-1 rounded"
                      style={{ color: 'var(--primary-600)' }}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCVs.length === 0 && (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--gray-100)' }}
              >
                <Users className="w-8 h-8" style={{ color: 'var(--gray-400)' }} />
              </div>
              <h3 className="heading-sm mb-2" style={{ color: 'var(--gray-700)' }}>
                No CVs found
              </h3>
              <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                Upload some candidate CVs to get started with matching
              </p>
              <button
                onClick={() => setCurrentTab('upload')}
                className="btn-primary mt-4"
              >
                <Plus className="w-4 h-4" />
                Upload CVs
              </button>
            </div>
          )}
        </div>
      )}

      {/* Start Analysis Panel */}
      {matchReady && (
        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--green-50)' }}
              >
                <Target className="w-6 h-6" style={{ color: 'var(--green-600)' }} />
              </div>
              <div>
                <h3 className="heading-sm" style={{ color: 'var(--gray-900)' }}>
                  Ready to Start AI Matching!
                </h3>
                <p className="text-base" style={{ color: 'var(--gray-600)' }}>
                  {selectedCVs.length} candidate{selectedCVs.length !== 1 ? 's' : ''} selected for {selectedJD ? '1 position' : 'matching'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
                  Our AI will analyze skills, experience, and responsibilities to find the best matches
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={clearSelections}
                className="btn-outline"
              >
                Clear Selection
              </button>
              <button
                onClick={handleStartMatching}
                disabled={loadingStates.matching?.isLoading}
                className="btn-primary"
              >
                {loadingStates.matching?.isLoading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Start AI Analysis
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <DatabaseViewerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
