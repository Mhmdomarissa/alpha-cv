'use client';
import React, { useEffect } from 'react';
import {
  Upload,
  Database,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Award,
  Briefcase
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import { TypewriterCycle } from '@/components/ui/Typewriter';
import { Skeleton } from '@/components/ui/loading';

export default function DashboardPage() {
  const {
    cvs,
    jds,
    totalCVs,
    totalJDs,
    matchResult,
    setCurrentTab,
    setDatabaseActiveTab,
    loadCVs,
    loadJDs,
    loadingStates
  } = useAppStore();

  const cvCount = totalCVs ?? cvs.length;
  const jdCount = totalJDs ?? jds.length;
  const totalMatches = matchResult?.candidates.length || 0;

  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="w-full max-w-7xl mx-auto space-y-8 py-8 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center space-y-3 sm:space-y-4 px-1">
        <div className="flex justify-center">
          <div className="flex items-center justify-center">
            <img
              src="/alphadatalogo.svg"
              alt="Alpha Data Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
            />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome to Alpha CV</h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto min-h-[1.5em]">
          <TypewriterCycle
            texts={[
              'AI-powered resume matching',
              'Find the best candidates faster',
              'Smart matching for recruiters',
            ]}
            speed={70}
            pauseBetween={2800}
          />
        </p>
      </div>

      {/* Stats Grid — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <button
          onClick={() => { setDatabaseActiveTab('cvs'); setCurrentTab('database'); }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow w-full text-left animate-fade-in-up animation-delay-100"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          {loadingStates.cvs.isLoading ? (
            <Skeleton width="40px" height="32px" className="mb-1" />
          ) : (
            <div className="text-2xl font-bold text-gray-800">{cvCount}</div>
          )}
          <p className="text-ui font-medium text-gray-600">Candidates</p>
          <p className="text-caption text-gray-500">Ready for matching</p>
        </button>

        <button
          onClick={() => { setDatabaseActiveTab('jds'); setCurrentTab('database'); }}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow w-full text-left animate-fade-in-up animation-delay-200"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          {loadingStates.jds.isLoading ? (
            <Skeleton width="40px" height="32px" className="mb-1" />
          ) : (
            <div className="text-2xl font-bold text-gray-800">{jdCount}</div>
          )}
          <p className="text-ui font-medium text-gray-600">Job Positions</p>
          <p className="text-caption text-gray-500">Available for matching</p>
        </button>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md animate-fade-in-up animation-delay-300">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
            <Award className="w-6 h-6 text-white" />
          </div>
          {loadingStates.cvs.isLoading || loadingStates.jds.isLoading ? (
            <Skeleton width="40px" height="32px" className="mb-1" />
          ) : (
            <div className="text-2xl font-bold text-gray-800">{totalMatches}</div>
          )}
          <p className="text-ui font-medium text-gray-600">AI Matches</p>
          <p className="text-caption text-gray-500">Generated so far</p>
        </div>
      </div>

      {/* Next best action */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Next step</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {cvCount === 0 && jdCount === 0
                ? 'Upload CVs and a job description to start matching.'
                : cvCount === 0
                  ? 'Upload candidate CVs to build your database.'
                  : jdCount === 0
                    ? 'Upload a job description so we can rank candidates.'
                    : 'You’re ready — go to Database and run a match.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {(cvCount === 0 || jdCount === 0) ? (
              <Button
                onClick={() => setCurrentTab('upload')}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload documents
              </Button>
            ) : (
              <Button
                onClick={() => { setDatabaseActiveTab('cvs'); setCurrentTab('database'); }}
              >
                <Database className="w-4 h-4 mr-2" />
                Go to Database
              </Button>
            )}
            <Button
              onClick={() => setCurrentTab('careers')}
              variant="outline"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Manage jobs
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-white rounded-xl p-5 sm:p-8 border border-gray-200 shadow-sm animate-fade-in-up animation-delay-200">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shadow-blue-900/20">
              <img
                src="/alphadatalogo.svg"
                alt="Alpha Data Logo"
                className="w-8 h-8 object-contain brightness-0 invert"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">Quick Actions</h3>
              <p className="text-neutral-600 font-medium">Get started with your CV matching workflow</p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setCurrentTab('upload')}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-md">
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
              onClick={() => { setDatabaseActiveTab('cvs'); setCurrentTab('database'); }}
              disabled={cvCount === 0 && jdCount === 0}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-md">
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
          <p className="text-sm text-gray-500 mt-4">Upload CVs and JDs, then run Match to see ranked candidates.</p>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-8 border border-gray-200 shadow-sm animate-fade-in-up animation-delay-300">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shadow-blue-900/20">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Recent Matches</h3>
              <p className="text-gray-600">Latest AI matching results</p>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-50/50 rounded-full mx-auto flex items-center justify-center mb-4 border border-blue-100">
              <BarChart3 className="w-8 h-8 text-[#00529b]" />
            </div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">View Recent Matches</h4>
            <p className="text-gray-600 mb-4">Check candidate rankings and match results</p>
            <Button
              onClick={() => setCurrentTab('match')}
            >
              View Recent Matches
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shadow-blue-900/20">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">System Status: Operational</div>
              <div className="text-caption text-gray-600">AI matching ready • Database connected</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full animate-pulse bg-[#00529b]" />
            <span className="text-sm font-medium text-[#00529b]">Online</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
