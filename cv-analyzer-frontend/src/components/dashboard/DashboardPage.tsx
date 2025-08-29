'use client';
import React, { useEffect } from 'react';
import { 
  Upload, 
  Database, 
  Target, 
  Users,
  FileText,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function DashboardPage() {
  const { 
    cvs, 
    jds, 
    matchResult, 
    setCurrentTab, 
    loadCVs, 
    loadJDs,
    selectedCVs,
    selectedJD,
    selectAllCVs,
    selectJD,
    runMatch
  } = useAppStore();
  
  const totalDocuments = cvs.length + jds.length;
  const totalMatches = matchResult?.candidates.length || 0;
  const canStartMatching = cvs.length > 0 && jds.length > 0;
  
  const recentMatches = matchResult?.candidates.slice(0, 5) || [];
  
  // Load documents when component mounts
  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);
  
  // Handle match button click
  const handleStartMatching = async () => {
    if (cvs.length === 0 || jds.length === 0) return;
    
    // Select all CVs if none are selected
    if (selectedCVs.length === 0) {
      selectAllCVs();
    }
    
    // Select first JD if none is selected
    if (!selectedJD && jds.length > 0) {
      selectJD(jds[0].id);
    }
    
    // Run matching and switch to match tab
    await runMatch();
    setCurrentTab('match');
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>
        <div>
          <h1 className="heading-xl">Welcome to Alpha CV</h1>
          <p className="text-lg" style={{ color: 'var(--gray-600)' }}>
            AI-powered resume matching made simple and intelligent
          </p>
        </div>
      </div>

      {/* Quick Stats */}
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
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Candidates</p>
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
              <Target className="w-6 h-6" style={{ color: 'var(--yellow-600)' }} />
            </div>
          </div>
          <div className="heading-md">{jds.length}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Job Positions</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Available for matching
          </p>
        </div>
        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <Award className="w-6 h-6" style={{ color: 'var(--green-600)' }} />
            </div>
          </div>
          <div className="heading-md">{totalMatches}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>AI Matches</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Generated so far
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Get Started Section */}
        <div className="card-elevated">
          <div className="flex items-center space-x-3 mb-6">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <Zap className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <h3 className="heading-sm">Quick Actions</h3>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                Get started with your CV matching workflow
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setCurrentTab('upload')}
              className="w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md group"
              style={{ 
                borderColor: 'var(--gray-200)',
                backgroundColor: 'white',
              }}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary-50)' }}
                >
                  <Upload className="w-4 h-4" style={{ color: 'var(--primary-600)' }} />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: 'var(--gray-900)' }}>
                    Upload Documents
                  </div>
                  <div className="text-sm" style={{ color: 'var(--gray-500)' }}>
                    Add CVs and job descriptions
                  </div>
                </div>
              </div>
              <ArrowRight 
                className="w-4 h-4 transition-transform group-hover:translate-x-1" 
                style={{ color: 'var(--gray-400)' }}
              />
            </button>
            <button
              onClick={() => setCurrentTab('database')}
              disabled={totalDocuments === 0}
              className="w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                borderColor: 'var(--gray-200)',
                backgroundColor: 'white',
              }}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--green-50)' }}
                >
                  <Database className="w-4 h-4" style={{ color: 'var(--green-600)' }} />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: 'var(--gray-900)' }}>
                    Review Database
                  </div>
                  <div className="text-sm" style={{ color: 'var(--gray-500)' }}>
                    Manage your uploaded documents
                  </div>
                </div>
              </div>
              <ArrowRight 
                className="w-4 h-4 transition-transform group-hover:translate-x-1" 
                style={{ color: 'var(--gray-400)' }}
              />
            </button>
            {/* Updated Match Button */}
            <button
  onClick={handleStartMatching}
  disabled={!canStartMatching}
  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-lg group ${
    canStartMatching
      ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 text-white shadow-md'
      : 'bg-gray-100 text-gray-400 border-gray-200'
  } disabled:opacity-60 disabled:cursor-not-allowed`}
>
  <div className="flex items-center space-x-3">
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        canStartMatching ? 'bg-white/20' : 'bg-gray-200'
      }`}
    >
      <Target
        className="w-4 h-4"
        style={{
          color: canStartMatching ? 'white' : 'var(--gray-400)',
        }}
      />
    </div>
    <div className="text-left">
      <div className="font-medium flex items-center space-x-2">
        <span>Start AI Matching</span>
        {canStartMatching && (
          <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
        )}
      </div>
      <div
        className={`text-sm ${
          canStartMatching ? 'text-white/90' : 'text-gray-500'
        }`}
      >
        {canStartMatching
          ? `Ready to match ${cvs.length} candidates with ${jds.length} positions`
          : 'Upload CVs and JDs first'}
      </div>
    </div>
  </div>
  <ArrowRight
    className="w-4 h-4 transition-transform group-hover:translate-x-1"
    style={{ color: canStartMatching ? 'white' : 'var(--gray-400)' }}
  />
</button>

          </div>
        </div>

        {/* Recent Matches Section */}
        <div className="card-elevated">
          <div className="flex items-center space-x-3 mb-6">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
            </div>
            <div>
              <h3 className="heading-sm">Recent Matches</h3>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                Latest AI-powered matching results
              </p>
            </div>
          </div>
          {recentMatches.length > 0 ? (
            <div className="space-y-3">
              {recentMatches.map((match, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--gray-50)' }}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                      style={{ 
                        backgroundColor: match.overall_score >= 0.7 ? 'var(--green-500)' : 
                                        match.overall_score >= 0.5 ? 'var(--yellow-500)' : 'var(--red-500)',
                        color: 'white'
                      }}
                    >
                      {Math.round(match.overall_score * 100)}
                    </div>
                    <div>
                      <div className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>
                        {match.cv_name || 'Candidate'}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--gray-500)' }}>
                        {match.cv_job_title || 'No title'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: 'var(--gray-900)' }}>
                      {Math.round(match.overall_score * 100)}% Match
                    </div>
                    <div className="text-xs" style={{ color: 'var(--gray-500)' }}>
                      {match.cv_years} years exp.
                    </div>
                  </div>
                </div>
              ))}
              
              <button
                onClick={() => setCurrentTab('match')}
                className="w-full mt-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ 
                  color: 'var(--primary-600)',
                  backgroundColor: 'var(--primary-50)',
                }}
              >
                View All Matches →
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--gray-100)' }}
              >
                <TrendingUp className="w-8 h-8" style={{ color: 'var(--gray-400)' }} />
              </div>
              <h4 className="heading-sm mb-2" style={{ color: 'var(--gray-700)' }}>
                No matches yet
              </h4>
              <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                Upload documents and run your first AI matching to see results here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="card-simple">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <CheckCircle className="w-4 h-4" style={{ color: 'var(--green-600)' }} />
            </div>
            <div>
              <div className="font-medium" style={{ color: 'var(--gray-900)' }}>
                System Status: All Systems Operational
              </div>
              <div className="text-sm" style={{ color: 'var(--gray-600)' }}>
                AI matching engine ready • Database connected • Processing available
              </div>
            </div>
          </div>
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--green-500)' }}
          />
        </div>
      </div>
    </div>
  );
}