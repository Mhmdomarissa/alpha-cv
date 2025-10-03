'use client';
import React, { useEffect, useState } from 'react';
import { 
  Upload, 
  Database, 
  Users,
  FileText,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  TrendingUp,
  Award,
  BookOpen,
  Play,
  Lightbulb,
  Briefcase
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import QuickTutorial from '@/components/guide/QuickTutorial';

export default function DashboardPage() {
  const { 
    cvs, 
    jds, 
    matchResult, 
    setCurrentTab, 
    setDatabaseActiveTab,
    loadCVs, 
    loadJDs
  } = useAppStore();
  
  const [showTutorial, setShowTutorial] = useState(false);
  
  const totalDocuments = cvs.length + jds.length;
  const totalMatches = matchResult?.candidates.length || 0;
  
  // Load documents when component mounts
  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);


  return (
    <div className="space-y-8">
      {/* Welcome Header - Enhanced */}
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl group hover:scale-105 transition-all duration-300 shadow-2xl">
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 200 200" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:rotate-12 transition-transform duration-300"
            >
              <g transform="translate(0,200) scale(0.1,-0.1)" fill="#00529b">
                <path d="M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m925 779 c-153 -31 -275 -94 -275 -142 0 -11 -20 -62 -44 -111 -25 -50 -50 -118 -57 -151 -11 -53 -10 -65 6 -99 26 -54 21 -90 -21 -159 -27 -46 -37 -74 -38 -107 l-1 -45 53 -3 52 -3 0 -38 c0 -23 6 -44 15 -51 11 -9 13 -16 5 -24 -16 -16 -12 -44 9 -56 17 -9 19 -18 14 -85 -5 -63 -3 -75 11 -81 31 -12 5 -24 -52 -24 -37 0 -66 6 -81 16 -22 16 -23 22 -18 91 5 66 4 74 -15 84 -16 9 -19 17 -14 44 4 19 2 36 -4 40 -5 3 -10 21 -10 40 0 36 -13 46 -53 38 -69 -13 -74 46 -12 163 25 46 45 91 45 98 0 7 -9 34 -20 58 -17 40 -18 53 -9 104 5 33 30 100 55 150 24 49 44 100 44 111 0 22 42 63 89 87 82 42 230 74 346 74 l70 0 -90 -19z m55 -1181 c27 -29 38 -73 45 -188 5 -72 4 -99 -7 -111 -14 -18 -119 -91 -123 -87 -2 2 2 27 8 56 9 43 8 64 -6 116 -9 36 -17 79 -17 98 -1 40 -25 111 -40 116 -5 2 -10 8 -10 13 0 5 29 9 65 9 53 0 68 -4 85 -22z"/>
              </g>
            </svg>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
            Welcome to Alpha CV
          </h1>
          <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            AI-powered resume matching made simple and intelligent
          </p>
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>

      {/* Quick Stats - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)',
                boxShadow: '0 8px 32px rgba(0, 82, 155, 0.3)'
              }}
            >
              <FileText className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2">{totalDocuments}</div>
          <p className="text-sm font-medium text-slate-600 mb-1">Total Documents</p>
          <p className="text-xs text-slate-500">
            {cvs.length} CVs, {jds.length} JDs
          </p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        </div>
        
        <button 
          onClick={() => {
            setDatabaseActiveTab('cvs');
            setCurrentTab('database');
          }}
          className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 w-full text-left cursor-pointer"
        >
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
          <div className="text-3xl font-bold text-slate-800 mb-2">{cvs.length}</div>
          <p className="text-sm font-medium text-slate-600 mb-1">Candidates</p>
          <p className="text-xs text-slate-500">
            Ready for matching
          </p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </button>
        
        <button 
          onClick={() => {
            setDatabaseActiveTab('jds');
            setCurrentTab('database');
          }}
          className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 w-full text-left cursor-pointer"
        >
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
              }}
            >
              <Briefcase className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2">{jds.length}</div>
          <p className="text-sm font-medium text-slate-600 mb-1">Job Positions</p>
          <p className="text-xs text-slate-500">
            Available for matching
          </p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
        </button>
        
        <div className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex justify-center mb-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Award className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-2">{totalMatches}</div>
          <p className="text-sm font-medium text-slate-600 mb-1">AI Matches</p>
          <p className="text-xs text-slate-500">
            Generated so far
          </p>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
        </div>
      </div>

      {/* Quick Actions - Enhanced */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Get Started Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center space-x-4 mb-8">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)',
              boxShadow: '0 8px 32px rgba(0, 82, 155, 0.3)'
            }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 200 200" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <g transform="translate(0,200) scale(0.1,-0.1)" fill="currentColor">
                  <path d="M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m925 779 c-153 -31 -275 -94 -275 -142 0 -11 -20 -62 -44 -111 -25 -50 -50 -118 -57 -151 -11 -53 -10 -65 6 -99 26 -54 21 -90 -21 -159 -27 -46 -37 -74 -38 -107 l-1 -45 53 -3 52 -3 0 -38 c0 -23 6 -44 15 -51 11 -9 13 -16 5 -24 -16 -16 -12 -44 9 -56 17 -9 19 -18 14 -85 -5 -63 -3 -75 11 -81 31 -12 5 -24 -52 -24 -37 0 -66 6 -81 16 -22 16 -23 22 -18 91 5 66 4 74 -15 84 -16 9 -19 17 -14 44 4 19 2 36 -4 40 -5 3 -10 21 -10 40 0 36 -13 46 -53 38 -69 -13 -74 46 -12 163 25 46 45 91 45 98 0 7 -9 34 -20 58 -17 40 -18 53 -9 104 5 33 30 100 55 150 24 49 44 100 44 111 0 22 42 63 89 87 82 42 230 74 346 74 l70 0 -90 -19z m55 -1181 c27 -29 38 -73 45 -188 5 -72 4 -99 -7 -111 -14 -18 -119 -91 -123 -87 -2 2 2 27 8 56 9 43 8 64 -6 116 -9 36 -17 79 -17 98 -1 40 -25 111 -40 116 -5 2 -10 8 -10 13 0 5 29 9 65 9 53 0 68 -4 85 -22z"/>
                </g>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Quick Actions</h3>
              <p className="text-slate-600 font-medium">
                Get started with your CV matching workflow
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setCurrentTab('upload')}
              className="w-full flex items-center justify-between p-5 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 shadow-sm hover:shadow-lg hover:bg-white/90 transition-all duration-300 group hover:-translate-y-0.5"
            >
              <div className="flex items-center space-x-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-110"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)',
                    boxShadow: '0 4px 16px rgba(0, 82, 155, 0.3)'
                  }}
                >
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800 text-base">
                    Upload Documents
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    Add CVs and job descriptions
                  </div>
                </div>
              </div>
              <ArrowRight 
                className="w-5 h-5 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-slate-600" 
              />
            </button>
            
            <button
              onClick={() => setCurrentTab('database')}
              disabled={totalDocuments === 0}
              className="w-full flex items-center justify-between p-5 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 shadow-sm hover:shadow-lg hover:bg-white/90 transition-all duration-300 group hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <div className="flex items-center space-x-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-110"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800 text-base">
                    Review Database
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    Manage your uploaded documents
                  </div>
                </div>
              </div>
              <ArrowRight 
                className="w-5 h-5 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-slate-600" 
              />
            </button>

          </div>
        </div>

        {/* Recent Matches Section - Enhanced */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center space-x-4 mb-8">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
              }}
            >
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Recent Matches</h3>
              <p className="text-slate-600 font-medium">
                Latest AI-powered matching results
              </p>
            </div>
          </div>
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg">
              <BarChart3 className="w-10 h-10 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-slate-800 mb-2">View Recent Matches</h4>
            <p className="text-slate-600 mb-6">
              Check your latest AI-powered matching results and candidate rankings
            </p>
            <button
              onClick={() => setCurrentTab('match')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              View Recent Matches →
            </button>
          </div>
        </div>
      </div>

      {/* System Status - Enhanced */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">
                System Status: All Systems Operational
              </div>
              <div className="text-sm text-slate-600 font-medium">
                AI matching engine ready • Database connected • Processing available
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: '#10b981' }}
            />
            <span className="text-sm font-medium text-green-600">Online</span>
          </div>
        </div>
      </div>


      
      {/* Quick Tutorial Modal */}
      <QuickTutorial 
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onNavigate={(tab: string) => setCurrentTab(tab as any)}
      />

    </div>
  );
}