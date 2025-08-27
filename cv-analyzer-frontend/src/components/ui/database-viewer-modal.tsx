'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Eye, 
  Download, 
  Clock, 
  User, 
  FileText, 
  Award, 
  Calendar,
  Database,
  BarChart3,
  Users,
  Target,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { LoadingSpinner } from './loading';

interface DatabaseViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormattedCV {
  id: string;
  name: string;
  filename: string;
  job_title: string;
  skills_count: number;
  experience_years: string | number;
  upload_date: string;
  text_length: number;
  top_skills: string[];
  responsibilities_count: number;
  has_structured_data: boolean;
}

interface FormattedJD {
  id: string;
  filename: string;
  job_title: string;
  required_skills: number;
  required_years: string | number;
  upload_date: string;
  text_length: number;
  top_skills: string[];
  responsibilities_count: number;
  has_structured_data: boolean;
}

interface DatabaseViewData {
  cvs: FormattedCV[];
  jds: FormattedJD[];
  summary: {
    total_documents: number;
    total_cvs: number;
    total_jds: number;
    avg_cv_skills: number;
    avg_jd_skills: number;
    ready_for_matching: boolean;
  };
}

export default function DatabaseViewerModal({ isOpen, onClose }: DatabaseViewModalProps) {
  const [data, setData] = useState<DatabaseViewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cvs' | 'jds'>('overview');

  useEffect(() => {
    if (isOpen) {
      fetchDatabaseView();
    }
  }, [isOpen]);

  const fetchDatabaseView = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.getDatabaseView();
      if (response.success) {
        setData(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch database view');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load database view');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Unknown') return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const exportData = () => {
    if (!data) return;
    
    const exportObj = {
      summary: data.summary,
      cvs: data.cvs,
      jds: data.jds,
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpha_cv_database_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        style={{ border: '1px solid var(--gray-200)' }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'var(--gray-200)' }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-100)' }}
            >
              <Database className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <h2 className="heading-lg" style={{ color: 'var(--gray-900)' }}>
                Database Viewer
              </h2>
              <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                Complete overview of stored documents and data
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={exportData}
              disabled={!data}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--gray-100)',
                color: 'var(--gray-700)',
              }}
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--gray-500)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-80px)]">
          {/* Sidebar Navigation */}
          <div 
            className="w-64 border-r p-4"
            style={{ borderColor: 'var(--gray-200)', backgroundColor: 'var(--gray-50)' }}
          >
            <div className="space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'cvs', label: 'CVs', icon: Users },
                { id: 'jds', label: 'Job Descriptions', icon: Target },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? 'var(--primary-100)' : 'transparent',
                      color: isActive ? 'var(--primary-700)' : 'var(--gray-600)',
                    }}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                    {data && (
                      <span 
                        className="ml-auto text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: isActive ? 'var(--primary-200)' : 'var(--gray-200)',
                          color: isActive ? 'var(--primary-700)' : 'var(--gray-600)',
                        }}
                      >
                        {tab.id === 'cvs' ? data.summary.total_cvs :
                         tab.id === 'jds' ? data.summary.total_jds :
                         data.summary.total_documents}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-sm" style={{ color: 'var(--gray-500)' }}>
                    Loading database view...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--red-500)' }} />
                  <h3 className="heading-sm mb-2" style={{ color: 'var(--gray-900)' }}>
                    Error Loading Data
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--gray-500)' }}>
                    {error}
                  </p>
                  <button
                    onClick={fetchDatabaseView}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--primary-600)',
                      color: 'white',
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : data ? (
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="heading-md mb-4" style={{ color: 'var(--gray-900)' }}>
                        Database Summary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div 
                          className="p-4 rounded-xl"
                          style={{ backgroundColor: 'var(--blue-50)', border: '1px solid var(--blue-200)' }}
                        >
                          <div className="flex items-center space-x-3">
                            <Users className="w-8 h-8" style={{ color: 'var(--blue-600)' }} />
                            <div>
                              <p className="text-2xl font-bold" style={{ color: 'var(--blue-600)' }}>
                                {data.summary.total_cvs}
                              </p>
                              <p className="text-sm" style={{ color: 'var(--blue-500)' }}>CVs</p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className="p-4 rounded-xl"
                          style={{ backgroundColor: 'var(--green-50)', border: '1px solid var(--green-200)' }}
                        >
                          <div className="flex items-center space-x-3">
                            <Target className="w-8 h-8" style={{ color: 'var(--green-600)' }} />
                            <div>
                              <p className="text-2xl font-bold" style={{ color: 'var(--green-600)' }}>
                                {data.summary.total_jds}
                              </p>
                              <p className="text-sm" style={{ color: 'var(--green-500)' }}>Job Descriptions</p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className="p-4 rounded-xl"
                          style={{ backgroundColor: 'var(--purple-50)', border: '1px solid var(--purple-200)' }}
                        >
                          <div className="flex items-center space-x-3">
                            <Award className="w-8 h-8" style={{ color: 'var(--purple-600)' }} />
                            <div>
                              <p className="text-2xl font-bold" style={{ color: 'var(--purple-600)' }}>
                                {data.summary.avg_cv_skills.toFixed(1)}
                              </p>
                              <p className="text-sm" style={{ color: 'var(--purple-500)' }}>Avg CV Skills</p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className="p-4 rounded-xl"
                          style={{ 
                            backgroundColor: data.summary.ready_for_matching ? 'var(--green-50)' : 'var(--orange-50)',
                            border: data.summary.ready_for_matching ? '1px solid var(--green-200)' : '1px solid var(--orange-200)'
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <CheckCircle 
                              className="w-8 h-8" 
                              style={{ 
                                color: data.summary.ready_for_matching ? 'var(--green-600)' : 'var(--orange-600)' 
                              }} 
                            />
                            <div>
                              <p 
                                className="text-sm font-bold"
                                style={{ 
                                  color: data.summary.ready_for_matching ? 'var(--green-600)' : 'var(--orange-600)' 
                                }}
                              >
                                {data.summary.ready_for_matching ? 'Ready' : 'Not Ready'}
                              </p>
                              <p 
                                className="text-xs"
                                style={{ 
                                  color: data.summary.ready_for_matching ? 'var(--green-500)' : 'var(--orange-500)' 
                                }}
                              >
                                For Matching
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'cvs' && (
                  <div>
                    <h3 className="heading-md mb-4" style={{ color: 'var(--gray-900)' }}>
                      CV Documents ({data.cvs.length})
                    </h3>
                    <div className="space-y-4">
                      {data.cvs.map((cv) => (
                        <div 
                          key={cv.id}
                          className="p-4 rounded-lg border transition-all duration-200"
                          style={{ borderColor: 'var(--gray-200)' }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <User className="w-5 h-5" style={{ color: 'var(--blue-600)' }} />
                                <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                                  {cv.name}
                                </h4>
                                <span 
                                  className="px-2 py-1 text-xs rounded-full"
                                  style={{
                                    backgroundColor: cv.has_structured_data ? 'var(--green-100)' : 'var(--orange-100)',
                                    color: cv.has_structured_data ? 'var(--green-700)' : 'var(--orange-700)',
                                  }}
                                >
                                  {cv.has_structured_data ? 'Processed' : 'Raw'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Job Title:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{cv.job_title}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Experience:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{cv.experience_years}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Skills:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{cv.skills_count}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Uploaded:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{formatDate(cv.upload_date)}</p>
                                </div>
                              </div>
                              
                              {cv.top_skills.length > 0 && (
                                <div className="mt-3">
                                  <span className="text-sm" style={{ color: 'var(--gray-500)' }}>Top Skills:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {cv.top_skills.map((skill, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 text-xs rounded-full"
                                        style={{
                                          backgroundColor: 'var(--blue-100)',
                                          color: 'var(--blue-700)',
                                        }}
                                      >
                                        {skill.length > 30 ? skill.substring(0, 30) + '...' : skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'jds' && (
                  <div>
                    <h3 className="heading-md mb-4" style={{ color: 'var(--gray-900)' }}>
                      Job Descriptions ({data.jds.length})
                    </h3>
                    <div className="space-y-4">
                      {data.jds.map((jd) => (
                        <div 
                          key={jd.id}
                          className="p-4 rounded-lg border transition-all duration-200"
                          style={{ borderColor: 'var(--gray-200)' }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <Target className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
                                <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                                  {jd.job_title}
                                </h4>
                                <span 
                                  className="px-2 py-1 text-xs rounded-full"
                                  style={{
                                    backgroundColor: jd.has_structured_data ? 'var(--green-100)' : 'var(--orange-100)',
                                    color: jd.has_structured_data ? 'var(--green-700)' : 'var(--orange-700)',
                                  }}
                                >
                                  {jd.has_structured_data ? 'Processed' : 'Raw'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Filename:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{jd.filename}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Required Years:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{jd.required_years}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Required Skills:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{jd.required_skills}</p>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--gray-500)' }}>Uploaded:</span>
                                  <p style={{ color: 'var(--gray-900)' }}>{formatDate(jd.upload_date)}</p>
                                </div>
                              </div>
                              
                              {jd.top_skills.length > 0 && (
                                <div className="mt-3">
                                  <span className="text-sm" style={{ color: 'var(--gray-500)' }}>Required Skills:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {jd.top_skills.map((skill, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 text-xs rounded-full"
                                        style={{
                                          backgroundColor: 'var(--green-100)',
                                          color: 'var(--green-700)',
                                        }}
                                      >
                                        {skill.length > 30 ? skill.substring(0, 30) + '...' : skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
