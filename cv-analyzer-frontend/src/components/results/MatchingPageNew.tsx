'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Brain,
  TrendingUp,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Eye,
  Download,
  Settings,
  Star,
  Filter,
  Briefcase,
  Calendar,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { useCareersStore } from '@/stores/careersStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button-enhanced';
import { MatchWeights } from '@/lib/types';

type SortKey = 'score' | 'skills' | 'experience';

const DEFAULT_WEIGHTS = {
  skills: 80,
  responsibilities: 15,
  job_title: 2.5,
  experience: 2.5,
};

// --- Helpers -------------------------------------------------------------
const uuidLike = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

function normalizeWeights(w: MatchWeights) {
  const keys = ['skills', 'responsibilities', 'job_title', 'experience'] as const;
  const sum = keys.reduce((s, k) => s + (w?.[k] ?? 0), 0);
  if (!sum || sum <= 0) return { ...DEFAULT_WEIGHTS };
  const norm = Object.fromEntries(keys.map((k) => [k, (w?.[k] ?? 0) / sum])) as typeof DEFAULT_WEIGHTS;
  return norm;
}

function scoreBadge(score: number) {
  if (score >= 0.8) return { label: 'Excellent', bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (score >= 0.6) return { label: 'Good', bg: 'bg-amber-100', text: 'text-amber-700' };
  return { label: 'Needs Review', bg: 'bg-rose-100', text: 'text-rose-700' };
}

function scoreColor(score: number) {
  if (score >= 0.8) return 'text-emerald-600';
  if (score >= 0.6) return 'text-amber-600';
  return 'text-rose-600';
}

function barColor(score: number) {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-rose-500';
}

// Try hard to get a human-friendly candidate name from the store or candidate object.
function resolveCandidateName(candidate: any, cvIndex: Record<string, any>): string {
  const fromCandidate = candidate?.cv_name;
  const cvMeta = cvIndex[candidate?.cv_id];
  // Prefer a proper name from candidate fields if it doesn't look like an ID
  if (fromCandidate && !uuidLike(fromCandidate)) return String(fromCandidate);
  // Try common CV metadata fields
  const guesses = [
    cvMeta?.full_name,
    cvMeta?.candidate_name,
    cvMeta?.name,
    cvMeta?.display_name,
    cvMeta?.person_name,
    cvMeta?.owner,
    // Fallback to filename before extension if it looks like a name
    (cvMeta?.filename || cvMeta?.file_name || cvMeta?.original_name)?.replace(/\.[^.]+$/, ''),
  ].filter(Boolean);
  const firstGood = guesses.find((g: string) => g && !uuidLike(g) && g.trim().length > 1);
  if (firstGood) return String(firstGood);
  // Last resort: show "Candidate" + short id suffix
  const id = String(candidate?.cv_id || '').slice(0, 8);
  return id ? `Candidate ${id}` : 'Candidate';
}

function resolveTitle(candidate: any, cvIndex: Record<string, any>): string {
  const cvMeta = cvIndex[candidate?.cv_id];
  return candidate?.cv_job_title || cvMeta?.job_title || cvMeta?.title || 'No title';
}

function resolveYears(candidate: any, cvIndex: Record<string, any>): string {
  const cvMeta = cvIndex[candidate?.cv_id];
  const yrs =
    (typeof candidate?.cv_years === 'number' ? candidate.cv_years : undefined) ??
    (typeof cvMeta?.experience_years === 'number' ? cvMeta.experience_years : undefined) ??
    (typeof cvMeta?.years_of_experience === 'number' ? cvMeta.years_of_experience : undefined);
  return typeof yrs === 'number' ? `${yrs} years` : 'Experience n/a';
}

// --- Component -----------------------------------------------------------
export default function MatchingPageNew() {
  const {
    matchResult,
    matchWeights,
    setMatchWeights,
    cvs, // used to resolve names and meta
    selectedJD,
    selectedCVs,
    runMatch,
    loadingStates
  } = useAppStore();
  
  const { applications } = useCareersStore();
  
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [downloadingCV, setDownloadingCV] = useState<string | null>(null);
  const [resultsLimit, setResultsLimit] = useState<number | 'all'>(3); // Default to top 3
  const [isExporting, setIsExporting] = useState(false);
  
  // Ensure default weights present
  useEffect(() => {
    const keys: (keyof typeof DEFAULT_WEIGHTS)[] = ['skills', 'responsibilities', 'job_title', 'experience'];
    const missing = !matchWeights || keys.some((k) => typeof (matchWeights as any)[k] !== 'number');
    const zeroSum =
      matchWeights &&
      keys.reduce((s, k) => s + (matchWeights as any)[k], 0) <= 0;
    if (missing || zeroSum) {
      setMatchWeights?.({ ...DEFAULT_WEIGHTS });
    }
  }, [matchWeights, setMatchWeights]);

  // Auto-run matching when we have careers data but no match results
  useEffect(() => {
    if (selectedJD && selectedCVs && selectedCVs.length > 0 && !matchResult && !loadingStates.matching.isLoading) {
      // Validate that selectedJD looks like a valid UUID (not a job posting ID)
      const isValidJdId = selectedJD && typeof selectedJD === 'string' && selectedJD.length === 36 && selectedJD.includes('-');
      if (isValidJdId) {
        console.log('Auto-running matching for careers data:', { selectedJD, selectedCVs });
        runMatch();
      } else {
        console.warn('Skipping auto-matching: Invalid JD ID format', { selectedJD });
      }
    }
  }, [selectedJD, selectedCVs, matchResult, loadingStates.matching.isLoading, runMatch]);
  
  const normWeights = useMemo(() => normalizeWeights(matchWeights ?? DEFAULT_WEIGHTS), [matchWeights]);
  
  // Build CV index for quick lookups
  const cvIndex = useMemo(() => {
    const idx: Record<string, any> = {};
    (cvs || []).forEach((cv: any) => {
      const id = cv?.id || cv?.document_id || cv?.cv_id;
      if (id) idx[id] = cv;
    });
    return idx;
  }, [cvs]);
  
  const candidates: any[] = matchResult?.candidates ?? [];
  
  // Debug logging
  console.log('MatchingPageNew - matchResult:', matchResult);
  console.log('MatchingPageNew - candidates:', candidates);
  console.log('MatchingPageNew - candidates length:', candidates.length);
  
  // Compute display scores using current (normalized) weights
  const candidatesWithComputed = useMemo(() => {
    return candidates.map((c) => {
      const skills = Number(c.skills_score ?? 0);
      const resp = Number(c.responsibilities_score ?? 0);
      const title = Number(c.job_title_score ?? 0);
      const years = Number(c.years_score ?? 0);
      const computed_overall =
        skills * normWeights.skills +
        resp * normWeights.responsibilities +
        title * normWeights.job_title +
        years * normWeights.experience;
      return { ...c, computed_overall };
    });
  }, [candidates, normWeights]);
  
  const sortedCandidates = useMemo(() => {
    const filtered = [...candidatesWithComputed]
      .filter((c) => (c.computed_overall ?? 0) >= filterThreshold)
      .sort((a, b) => {
        if (sortBy === 'score') return (b.computed_overall ?? 0) - (a.computed_overall ?? 0);
        if (sortBy === 'skills') return (b.skills_score ?? 0) - (a.skills_score ?? 0);
        if (sortBy === 'experience') return (b.years_score ?? 0) - (a.years_score ?? 0);
        return 0;
      });
    
    // Apply results limit
    if (resultsLimit === 'all') {
      return filtered;
    }
    return filtered.slice(0, resultsLimit);
  }, [candidatesWithComputed, sortBy, filterThreshold, resultsLimit]);
  
  // Analytics - both total and visible
  const totalMatches = candidatesWithComputed.length;
  const excellentMatches = candidatesWithComputed.filter((c) => c.computed_overall >= 0.8).length;
  const goodMatches = candidatesWithComputed.filter((c) => c.computed_overall >= 0.6 && c.computed_overall < 0.8).length;
  const averageScore =
    totalMatches > 0
      ? Math.round(
          (candidatesWithComputed.reduce((s, c) => s + (c.computed_overall ?? 0), 0) / totalMatches) * 100
        )
      : 0;
  const topScore =
    totalMatches > 0
      ? Math.round(Math.max(...candidatesWithComputed.map((c) => c.computed_overall ?? 0)) * 100)
      : 0;
  
  // Visible analytics for current view
  const visibleMatches = sortedCandidates.length;
  const visibleExcellent = sortedCandidates.filter((c) => c.computed_overall >= 0.8).length;
  const visibleGood = sortedCandidates.filter((c) => c.computed_overall >= 0.6 && c.computed_overall < 0.8).length;
  const visibleAverage = visibleMatches > 0 
    ? Math.round((sortedCandidates.reduce((s, c) => s + (c.computed_overall ?? 0), 0) / visibleMatches) * 100)
    : 0;
  const visibleTop = visibleMatches > 0 
    ? Math.round(Math.max(...sortedCandidates.map((c) => c.computed_overall ?? 0)) * 100)
    : 0;
  
  // Total filtered candidates (before results limit)
  const totalFiltered = candidatesWithComputed.filter((c) => (c.computed_overall ?? 0) >= filterThreshold).length;
  
  // Download CV handler
  const handleDownloadCV = async (cvId: string) => {
    setDownloadingCV(cvId);
    try {
      const { blob, filename } = await api.downloadCV(cvId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // Use the filename from server response
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CV:', error);
    } finally {
      setDownloadingCV(null);
    }
  };

  // Export results handler
  const handleExportResults = async () => {
    if (!matchResult || !matchResult.candidates) {
      alert('No match results to export');
      return;
    }

    setIsExporting(true);
    
    try {
      // Create CSV content
      const headers = [
        'Rank',
        'Candidate Name',
        'Email',
        'Phone',
        'Overall Score (%)',
        'Skills Score (%)',
        'Responsibilities Score (%)',
        'Job Title Score (%)',
        'Experience Score (%)',
        'Job Title',
        'Experience (Years)',
        'Job Description Title',
        'Job Description Experience Required',
        'Application Date',
        'CV Filename'
      ];

      const csvRows = [headers.join(',')];

      // Process each candidate
      candidatesWithComputed.forEach((candidate, index) => {
        // Find corresponding application data
        const application = applications.find(app => app.application_id === candidate.cv_id);
        
        // Get candidate name
        const candidateName = resolveCandidateName(candidate, cvIndex);
        
        // Get job title and experience
        const jobTitle = resolveTitle(candidate, cvIndex);
        const experience = resolveYears(candidate, cvIndex);
        
        // Get CV metadata
        const cvMeta = cvIndex[candidate?.cv_id];
        const filename = cvMeta?.filename || `cv_${candidate.cv_id}.pdf`;

        const row = [
          index + 1, // Rank
          `"${candidateName}"`, // Candidate Name
          `"${application?.applicant_email || 'N/A'}"`, // Email
          `"${application?.applicant_phone || 'N/A'}"`, // Phone
          Math.round((candidate.computed_overall ?? 0) * 100), // Overall Score
          Math.round((candidate.skills_score ?? 0) * 100), // Skills Score
          Math.round((candidate.responsibilities_score ?? 0) * 100), // Responsibilities Score
          Math.round((candidate.job_title_score ?? 0) * 100), // Job Title Score
          Math.round((candidate.years_score ?? 0) * 100), // Experience Score
          `"${jobTitle}"`, // Job Title
          `"${experience}"`, // Experience
          `"${matchResult.jd_job_title || 'N/A'}"`, // JD Title
          `"${matchResult.jd_years || 'N/A'} years"`, // JD Experience Required
          `"${application?.application_date ? new Date(application.application_date).toLocaleDateString() : 'N/A'}"`, // Application Date
          `"${filename}"` // CV Filename
        ];

        csvRows.push(row.join(','));
      });

      // Create and download CSV file
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `match_results_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export results:', error);
      alert('Failed to export results. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Empty state
  if (!matchResult?.candidates || matchResult.candidates.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">AI Matching Results</h1>
          <p className="text-base mt-2 text-gray-600">Step 3: Run Match</p>
        </div>
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-gray-100">
            <Target className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No matches yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Select CVs and a job description from the Database to run AI matching
          </p>
          <button
            onClick={() => useAppStore.getState().setCurrentTab?.('database')}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Database
          </button>
        </div>
      </div>
    );
  }
  
  // --- Animations
  const fadeInUp = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" as const },
  };
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div {...fadeInUp} className="text-center">
        <h1 className="text-3xl font-semibold text-gray-900">AI Matching Results</h1>
        <p className="text-base mt-2 text-gray-600">
          Evaluated {totalMatches} candidate{totalMatches !== 1 ? 's' : ''} using weighted, explainable scoring.
        </p>
      </motion.div>
      
      {/* Analytics */}
      <motion.div
        {...fadeInUp}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-50">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {visibleMatches}
            {resultsLimit !== 'all' && totalMatches > visibleMatches && (
              <span className="text-sm text-gray-500 ml-1">/{totalMatches}</span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {resultsLimit !== 'all' ? `Top ${resultsLimit} Candidates` : 'Total Candidates'}
          </p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-amber-600">{visibleTop}%</div>
          <p className="text-sm text-gray-600">Best {resultsLimit !== 'all' ? 'Visible' : ''} Match</p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{visibleAverage}%</div>
          <p className="text-sm text-gray-600">{resultsLimit !== 'all' ? 'Visible' : ''} Average Score</p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
              <Star className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-emerald-600">{visibleExcellent}</div>
          <p className="text-sm text-gray-600">{resultsLimit !== 'all' ? 'Visible' : ''} Excellent (≥80%)</p>
        </motion.div>
      </motion.div>
      
      {/* Quality Distribution */}
      <motion.div {...fadeInUp} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-50">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quality Distribution</h3>
            <p className="text-sm text-gray-600">Breakdown by overall match</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="h-2 rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${(excellentMatches / Math.max(totalMatches, 1)) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="font-medium text-emerald-700">{excellentMatches} Excellent</div>
            <p className="text-sm text-gray-500">80–100% match</p>
          </div>
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="h-2 rounded-full bg-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${(goodMatches / Math.max(totalMatches, 1)) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
            <div className="font-medium text-amber-700">{goodMatches} Good</div>
            <p className="text-sm text-gray-500">60–79% match</p>
          </div>
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="h-2 rounded-full bg-rose-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${((totalMatches - excellentMatches - goodMatches) / Math.max(totalMatches, 1)) * 100}%`,
                }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
            <div className="font-medium text-rose-700">
              {totalMatches - excellentMatches - goodMatches} Needs Review
            </div>
            <p className="text-sm text-gray-500">&lt;60% match</p>
          </div>
        </div>
      </motion.div>
      
      {/* Controls */}
      <motion.div {...fadeInUp} className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWeights((s) => !s)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            {showWeights ? 'Hide' : 'Show'} Weights
            {showWeights ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
          
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="score">Sort by Overall Score</option>
            <option value="skills">Sort by Skills Match</option>
            <option value="experience">Sort by Experience Years</option>
          </select>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={resultsLimit}
              onChange={(e) => setResultsLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={3}>Show Top 3</option>
              <option value={5}>Show Top 5</option>
              <option value="all">Show All</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportResults}
            disabled={isExporting}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </>
            )}
          </button>
          <button className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors text-sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Generate Report
          </button>
        </div>
      </motion.div>
      
      {/* Weights Panel */}
      <AnimatePresence initial={false}>
        {showWeights && (
          <motion.div
            key="weights"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-50">
                <Brain className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Matching Weights</h3>
                <p className="text-sm text-gray-600">Defaults: Skills 80%, Responsibilities 15%, Title 2.5%, Experience 2.5%</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(['skills', 'responsibilities', 'job_title', 'experience'] as const).map((key) => {
                const raw = matchWeights?.[key] ?? DEFAULT_WEIGHTS[key];
                const pct = Math.round(normWeights[key] * 100);
                const labelMap: Record<typeof key, string> = {
                  skills: 'Skills',
                  responsibilities: 'Responsibilities',
                  job_title: 'Job Title',
                  experience: 'Experience (Years)',
                } as any;
                return (
                  <div key={key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-sm text-gray-800">{labelMap[key]}</label>
                      <span className="text-sm font-semibold text-indigo-600">{pct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={raw}
                      onChange={(e) =>
                        setMatchWeights?.({
                          ...(matchWeights ?? DEFAULT_WEIGHTS),
                          [key]: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${Math.max(
                          0,
                          Math.min(100, raw * 100)
                        )}%, #e5e7eb ${Math.max(0, Math.min(100, raw * 100))}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="text-xs text-gray-500">
                      {key === 'skills' && 'Technical & domain skills alignment'}
                      {key === 'responsibilities' && 'Responsibility / task alignment'}
                      {key === 'job_title' && 'Title similarity'}
                      {key === 'experience' && 'Years of experience fit'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-gray-500">Weights are normalized automatically to total 100%.</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMatchWeights?.({ ...DEFAULT_WEIGHTS })}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Ranked Candidates */}
      <motion.div {...fadeInUp} className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Ranked Candidates</h3>
              <p className="text-sm text-gray-600">
                {sortedCandidates.length} shown{resultsLimit !== 'all' ? ` (top ${resultsLimit})` : ''} of {totalFiltered} total. 
                Sorted by {sortBy === 'score' ? 'overall match' : sortBy}.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {sortedCandidates.map((candidate, index) => {
                const overall = candidate.computed_overall ?? 0;
                const badge = scoreBadge(overall);
                const isOpen = expandedMatch === candidate.cv_id;
                const displayName = resolveCandidateName(candidate, cvIndex);
                const title = resolveTitle(candidate, cvIndex);
                const yearsText = resolveYears(candidate, cvIndex);
                const cvMeta = cvIndex[candidate?.cv_id];
                const filename = cvMeta?.filename || `cv_${candidate.cv_id}.pdf`;
                
                return (
                  <motion.div
  key={candidate.cv_id}
  layout
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.2 }}
  className={`relative overflow-hidden rounded-xl border bg-white transition-all ${
    isOpen ? 'ring-2 ring-indigo-200 border-indigo-200' : 'border-gray-200'
  }`}
>
  {/* OUTER WRAPPER FIXED: now a <div> with role="button" */}
  <div
    onClick={() =>
      setExpandedMatch((prev) => (prev === candidate.cv_id ? null : candidate.cv_id))
    }
    role="button"
    tabIndex={0}
    className="w-full text-left p-5 hover:bg-gray-50 transition-colors cursor-pointer"
  >
    {/* Header row */}
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${barColor(
            overall
          )}`}
        >
          #{index + 1}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{displayName}</h4>
          <p className="text-sm text-gray-600">
            {title} • {yearsText}
          </p>
        </div>
      </div>
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-1">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${overall * 100}, 100`}
                className={barColor(overall)}
                strokeLinecap="round"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-gray-200"
                opacity="0.3"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-900">
                {Math.round(overall * 100)}%
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>
        <span className="text-sm text-indigo-600 hover:text-indigo-700">
          {isOpen ? 'Hide details' : 'View details'}
        </span>
      </div>
    </div>

    {/* Quick breakdown */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
      {/* Skills */}
      <div className="p-3 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Skills</span>
          <span className={`text-xs font-semibold ${scoreColor(candidate.skills_score ?? 0)}`}>
            {Math.round((candidate.skills_score ?? 0) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${barColor(candidate.skills_score ?? 0)}`}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(0, Math.min(100, (candidate.skills_score ?? 0) * 100))}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Responsibilities */}
      <div className="p-3 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Responsibilities</span>
          <span className={`text-xs font-semibold ${scoreColor(candidate.responsibilities_score ?? 0)}`}>
            {Math.round((candidate.responsibilities_score ?? 0) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${barColor(candidate.responsibilities_score ?? 0)}`}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(
                0,
                Math.min(100, (candidate.responsibilities_score ?? 0) * 100)
              )}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          />
        </div>
      </div>

      {/* Title */}
      <div className="p-3 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Title</span>
          <span className={`text-xs font-semibold ${scoreColor(candidate.job_title_score ?? 0)}`}>
            {Math.round((candidate.job_title_score ?? 0) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${barColor(candidate.job_title_score ?? 0)}`}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(0, Math.min(100, (candidate.job_title_score ?? 0) * 100))}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>

      {/* Years */}
      <div className="p-3 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Years</span>
          <span className={`text-xs font-semibold ${scoreColor(candidate.years_score ?? 0)}`}>
            {Math.round((candidate.years_score ?? 0) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${barColor(candidate.years_score ?? 0)}`}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(0, Math.min(100, (candidate.years_score ?? 0) * 100))}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
          />
        </div>
      </div>
    </div>

    {/* Download CV Button */}
    <div className="mt-4 flex justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleDownloadCV(candidate.cv_id);
        }}

        disabled={downloadingCV === candidate.cv_id}
        className="flex items-center gap-1"
      >
        {downloadingCV === candidate.cv_id ? (
          <>
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Downloading...</span>
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4" />
            <span>Download CV</span>
          </>
        )}
      </Button>
    </div>
  </div>


                    
                    {/* Expanded details */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="details"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="px-5 pb-5"
                        >
                          <div className="mt-2 space-y-6">
                            {/* Position Details */}
                            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                              <h4 className="font-semibold text-gray-900 mb-3">Position Details</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700">Job Description</h5>
                                  <div className="flex items-center mt-1">
                                    <Briefcase className="w-4 h-4 text-gray-500 mr-2" />
                                    <p className="text-sm text-gray-900">{matchResult?.jd_job_title || 'N/A'}</p>
                                  </div>
                                  <div className="flex items-center mt-1">
                                    <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                                    <p className="text-sm text-gray-900">{matchResult?.jd_years || 'N/A'} years required</p>
                                  </div>
                                </div>
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700">Candidate</h5>
                                  <div className="flex items-center mt-1">
                                    <Briefcase className="w-4 h-4 text-gray-500 mr-2" />
                                    <p className="text-sm text-gray-900">{candidate.cv_job_title || 'N/A'}</p>
                                  </div>
                                  <div className="flex items-center mt-1">
                                    <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                                    <p className="text-sm text-gray-900">{candidate.cv_years || 'N/A'} years experience</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Skills detail */}
                            {Array.isArray(candidate.skills_assignments) && candidate.skills_assignments.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Brain className="w-4 h-4 text-indigo-600" />
                                  <h4 className="font-semibold text-gray-900">
                                    Matched Skills ({candidate.skills_assignments.length})
                                  </h4>
                                </div>
                                <div className="grid gap-3 max-h-80 overflow-y-auto">
                                  {candidate.skills_assignments.map((a: any, idx: number) => {
                                    const s = Number(a.score ?? 0);
                                    return (
                                      <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-white">
                                        <div className="text-sm text-gray-900">
                                          JD Required: <span className="font-medium">{a.jd_item}</span>
                                        </div>
                                        <div className="text-sm text-gray-700">CV has: {a.cv_item}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${barColor(s)}`} style={{ width: `${s * 100}%` }} />
                                          </div>
                                          <span className={`text-xs font-medium ${scoreColor(s)}`}>{Math.round(s * 100)}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Unmatched Skills */}
                            {Array.isArray(candidate.unmatched_jd_skills) && candidate.unmatched_jd_skills.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Eye className="w-4 h-4 text-rose-600" />
                                  <h4 className="font-semibold text-gray-900">
                                    Unmatched Skills ({candidate.unmatched_jd_skills.length})
                                  </h4>
                                </div>
                                <div className="grid gap-3 max-h-80 overflow-y-auto">
                                  {candidate.unmatched_jd_skills.map((skill: string, idx: number) => (
                                    <div key={idx} className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                                      <div className="text-sm text-rose-900">
                                        Required skill: <span className="font-medium">{skill}</span>
                                      </div>
                                      <div className="text-sm text-rose-700">No matching skill found in candidate's profile</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Responsibilities detail */}
                            {Array.isArray(candidate.responsibilities_assignments) && candidate.responsibilities_assignments.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Target className="w-4 h-4 text-emerald-600" />
                                  <h4 className="font-semibold text-gray-900">
                                    Matched Responsibilities ({candidate.responsibilities_assignments.length})
                                  </h4>
                                </div>
                                <div className="grid gap-3 max-h-80 overflow-y-auto">
                                  {candidate.responsibilities_assignments.map((a: any, idx: number) => {
                                    const s = Number(a.score ?? 0);
                                    return (
                                      <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-white">
                                        <div className="text-sm text-gray-900">
                                          JD Required: <span className="font-medium">{a.jd_item}</span>
                                        </div>
                                        <div className="text-sm text-gray-700">CV has: {a.cv_item}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${barColor(s)}`} style={{ width: `${s * 100}%` }} />
                                          </div>
                                          <span className={`text-xs font-medium ${scoreColor(s)}`}>{Math.round(s * 100)}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Unmatched Responsibilities */}
                            {Array.isArray(candidate.unmatched_jd_responsibilities) && candidate.unmatched_jd_responsibilities.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Eye className="w-4 h-4 text-rose-600" />
                                  <h4 className="font-semibold text-gray-900">
                                    Unmatched Responsibilities ({candidate.unmatched_jd_responsibilities.length})
                                  </h4>
                                </div>
                                <div className="grid gap-3 max-h-80 overflow-y-auto">
                                  {candidate.unmatched_jd_responsibilities.map((resp: string, idx: number) => (
                                    <div key={idx} className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                                      <div className="text-sm text-rose-900">
                                        Required responsibility: <span className="font-medium">{resp}</span>
                                      </div>
                                      <div className="text-sm text-rose-700">No matching responsibility found in candidate's profile</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Summary */}
                            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                  <div className="text-lg font-semibold text-indigo-600">
                                    {candidate.skills_assignments
                                      ? candidate.skills_assignments.filter((a: any) => (a.score ?? 0) >= 0.7).length
                                      : 0}
                                    /
                                    {candidate.skills_assignments ? candidate.skills_assignments.length : 0}
                                  </div>
                                  <div className="text-xs text-gray-600">Strong Skills Matches (≥70%)</div>
                                </div>
                                <div>
                                  <div className="text-lg font-semibold text-emerald-600">
                                    {candidate.responsibilities_assignments
                                      ? candidate.responsibilities_assignments.filter((a: any) => (a.score ?? 0) >= 0.7).length
                                      : 0}
                                    /
                                    {candidate.responsibilities_assignments
                                      ? candidate.responsibilities_assignments.length
                                      : 0}
                                  </div>
                                  <div className="text-xs text-gray-600">Strong Responsibility Matches (≥70%)</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          {/* Show All Notice */}
          {resultsLimit !== 'all' && 
           totalFiltered > sortedCandidates.length && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Showing top {resultsLimit} of {totalFiltered} candidates
                    </p>
                    <p className="text-sm text-blue-700">
                      {totalFiltered - sortedCandidates.length} more candidates available
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setResultsLimit('all')}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Show All
                </button>
              </div>
            </div>
          )}
          
          {sortedCandidates.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-800 mb-1">No matches found</h3>
              <p className="text-sm text-gray-500">Adjust your filters to view more candidates.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}