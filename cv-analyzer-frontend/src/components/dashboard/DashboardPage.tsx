'use client';
import React, { useEffect } from 'react';
import { 
  Upload, 
  Database, 
  Users,
  FileText,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Award,
  Briefcase
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

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
  
  const totalDocuments = cvs.length + jds.length;
  const totalMatches = matchResult?.candidates.length || 0;
  
  // Load documents when component mounts
  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);


  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-[#00529b] shadow-sm">
            <svg width="36" height="36" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(0,200) scale(0.1,-0.1)" fill="white">
                <path d="M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m925 779 c-153 -31 -275 -94 -275 -142 0 -11 -20 -62 -44 -111 -25 -50 -50 -118 -57 -151 -11 -53 -10 -65 6 -99 26 -54 21 -90 -21 -159 -27 -46 -37 -74 -38 -107 l-1 -45 53 -3 52 -3 0 -38 c0 -23 6 -44 15 -51 11 -9 13 -16 5 -24 -16 -16 -12 -44 9 -56 17 -9 19 -18 14 -85 -5 -63 -3 -75 11 -81 31 -12 5 -24 -52 -24 -37 0 -66 6 -81 16 -22 16 -23 22 -18 91 5 66 4 74 -15 84 -16 9 -19 17 -14 44 4 19 2 36 -4 40 -5 3 -10 21 -10 40 0 36 -13 46 -53 38 -69 -13 -74 46 -12 163 25 46 45 91 45 98 0 7 -9 34 -20 58 -17 40 -18 53 -9 104 5 33 30 100 55 150 24 49 44 100 44 111 0 22 42 63 89 87 82 42 230 74 346 74 l70 0 -90 -19z m55 -1181 c27 -29 38 -73 45 -188 5 -72 4 -99 -7 -111 -14 -18 -119 -91 -123 -87 -2 2 2 27 8 56 9 43 8 64 -6 116 -9 36 -17 79 -17 98 -1 40 -25 111 -40 116 -5 2 -10 8 -10 13 0 5 29 9 65 9 53 0 68 -4 85 -22z"/>
              </g>
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Alpha CV</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">AI-powered resume matching</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-lg bg-[#00529b] flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{totalDocuments}</div>
          <p className="text-ui font-medium text-gray-600">Total Documents</p>
          <p className="text-caption text-gray-500">{cvs.length} CVs, {jds.length} JDs</p>
        </div>
        <button
          onClick={() => { setDatabaseActiveTab('cvs'); setCurrentTab('database'); }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow w-full text-left"
        >
          <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{cvs.length}</div>
          <p className="text-ui font-medium text-gray-600">Candidates</p>
          <p className="text-caption text-gray-500">Ready for matching</p>
        </button>
        <button
          onClick={() => { setDatabaseActiveTab('jds'); setCurrentTab('database'); }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow w-full text-left"
        >
          <div className="w-12 h-12 rounded-lg bg-amber-600 flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{jds.length}</div>
          <p className="text-ui font-medium text-gray-600">Job Positions</p>
          <p className="text-caption text-gray-500">Available for matching</p>
        </button>
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
          <div className="w-12 h-12 rounded-lg bg-violet-600 flex items-center justify-center mb-4">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{totalMatches}</div>
          <p className="text-ui font-medium text-gray-600">AI Matches</p>
          <p className="text-caption text-gray-500">Generated so far</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-[#00529b] flex items-center justify-center">
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
          <div className="space-y-3">
            <button
              onClick={() => setCurrentTab('upload')}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-[#00529b] flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">Upload Documents</div>
                  <div className="text-caption text-gray-500">Add CVs and job descriptions</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setCurrentTab('database')}
              disabled={totalDocuments === 0}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">Review Database</div>
                  <div className="text-caption text-gray-500">Manage your uploaded documents</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Recent Matches</h3>
              <p className="text-gray-600">Latest AI matching results</p>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">View Recent Matches</h4>
            <p className="text-gray-600 mb-4">Check candidate rankings and match results</p>
            <button
              onClick={() => setCurrentTab('match')}
              className="px-6 py-3 bg-[#00529b] hover:bg-[#003d73] text-white font-semibold rounded-lg transition-colors"
            >
              View Recent Matches
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">System Status: Operational</div>
              <div className="text-caption text-gray-600">AI matching ready • Database connected</div>
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

    </div>
  );
}