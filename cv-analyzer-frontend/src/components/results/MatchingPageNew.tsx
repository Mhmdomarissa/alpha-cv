'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Target,
  Brain,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  Eye,
  Download,
  Star,
  Filter,
  Briefcase,
  Calendar,
  FileDown,
  MessageSquare,
  Pencil,
  Save,
  X,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
const FilePreviewModal = dynamic(() => import('@/components/ui/file-preview-modal').then(mod => mod.FilePreviewModal), {
  ssr: false,
});
const QueueStatusModal = dynamic(() => import('@/components/common/QueueStatusModal').then(mod => mod.default), {
  ssr: false,
});
import { getApiBaseUrl } from '@/lib/config';
import { useCareersStore } from '@/stores/careersStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button-enhanced';
import { MatchWeights } from '@/lib/types';
// Queue components removed

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

function resolveExpectedSalary(candidate: any, applications: any[]): number | null {
  const fromCandidate = candidate?.expected_salary;
  if (typeof fromCandidate === 'number' && fromCandidate > 0) return fromCandidate;
  if (applications?.length) {
    const app = applications.find((a: any) => a.application_id === candidate?.cv_id);
    const salary = app?.expected_salary ?? (app as any)?.expected_salary;
    if (typeof salary === 'number' && salary > 0) return salary;
  }
  return null;
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
    loadingStates,
    matchingQueue,
    setMatchingQueue,
  } = useAppStore();

  const { applications } = useCareersStore();
  const { user } = useAuthStore();

  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; id: string; type: string; extractedText?: string }>({
    isOpen: false,
    url: '',
    name: '',
    id: '',
    type: '',
    extractedText: ''
  });
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [downloadingCV, setDownloadingCV] = useState<string | null>(null);
  const [resultsLimit, setResultsLimit] = useState<number | 'all'>(3); // Default to top 3
  const [isExporting, setIsExporting] = useState(false);

  // Notes state
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [candidateNotes, setCandidateNotes] = useState<Record<string, any[]>>({});
  const [notesSummary, setNotesSummary] = useState<Record<string, { has_notes: boolean; notes_count: number; latest_note: any | null }>>({});

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

  // Load batch notes summary for all candidates when match results change
  useEffect(() => {
    const loadSummary = async () => {
      try {
        if (!matchResult?.candidates) return;
        const ids: string[] = Array.from(
          new Set(
            (matchResult.candidates as any[])
              .map((c: any) => (c && c.cv_id ? String(c.cv_id) : ''))
              .filter((id: string) => Boolean(id))
          )
        );
        if (ids.length === 0) return;
        const res = await api.getNotesSummary(ids);
        const map: Record<string, { has_notes: boolean; notes_count: number; latest_note: any | null }> = {};
        (res.summaries || []).forEach((s: any) => {
          map[s.cv_id] = { has_notes: !!s.has_notes, notes_count: s.notes_count || 0, latest_note: s.latest_note || null };
        });
        setNotesSummary(map);
      } catch (e) {
        console.warn('Failed to load notes summary, falling back on-demand:', e);
      }
    };
    loadSummary();
  }, [matchResult?.candidates]);

  // Queue handlers removed

  // Auto-run matching when we have selected data but no match results
  useEffect(() => {
    if (selectedJD && selectedCVs && selectedCVs.length > 0 && !matchResult && !loadingStates.matching.isLoading && !loadingStates.careersMatching.isLoading) {
      // Check if this is careers data (when we have applications from careers store)
      const hasCareersData = applications && applications.length > 0;

      if (hasCareersData) {
        // For careers data, validate that selectedJD looks like a valid UUID
        const isValidJdId = selectedJD && typeof selectedJD === 'string' && selectedJD.length === 36 && selectedJD.includes('-');
        if (isValidJdId) {
          runMatch();
        } else {
          console.warn('Skipping auto-matching: Invalid JD ID format', { selectedJD });
        }
      } else {
        // For database page data, auto-run matching immediately
        runMatch();
      }
    }
  }, [selectedJD, selectedCVs, matchResult, loadingStates.matching.isLoading, loadingStates.careersMatching.isLoading, runMatch, applications]);


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

  // Compute display scores using current (normalized) weights
  const candidatesWithComputed = useMemo(() => {
    return candidates.map((c) => {
      // Use the backend's overall_score directly instead of recalculating
      const computed_overall = Number(c.overall_score ?? 0);
      return { ...c, computed_overall };
    });
  }, [candidates]);

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
    try {
      setDownloadingCV(cvId);
      const { blob, filename } = await api.downloadCV(cvId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CV:', error);
    } finally {
      setDownloadingCV(null);
    }
  };

  const handlePreviewFile = async (id: string, type: string, filename: string) => {
    const normalizedFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    let fileUrl: string;
    let extractedText = '';

    if (type === 'cv') {
      // Use CV download API (same as careers page) so preview works for both
      // main CVs and job-application CVs (which may be stored under different paths).
      try {
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
        }
        const { blob } = await api.downloadCV(id);
        const blobUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(blobUrl);
        fileUrl = blobUrl;
      } catch (err) {
        console.error('Failed to load CV for preview:', err);
        return;
      }
      if (!normalizedFilename.toLowerCase().endsWith('.pdf')) {
        try {
          const details = await api.getCVDetails(id);
          extractedText = details?.text_info?.extracted_text_preview || '';
        } catch {
          // ignore
        }
      }
    } else {
      fileUrl = `${getApiBaseUrl()}/api/storage/files/${type}/${id}`;
      if (!normalizedFilename.toLowerCase().endsWith('.pdf')) {
        try {
          const details = await api.getJDDetails(id);
          extractedText = details?.text_info?.extracted_text_preview || '';
        } catch {
          // ignore
        }
      }
    }

    setPreviewData({
      isOpen: true,
      url: fileUrl,
      name: normalizedFilename,
      id,
      type,
      extractedText
    });
  };

  // Notes handlers
  const loadCandidateNotes = async (cvId: string) => {
    try {
      const response = await api.getCVNotes(cvId);
      setCandidateNotes(prev => ({
        ...prev,
        [cvId]: response.notes || []
      }));
      // refresh summary cache for this id after a change/fetch
      setNotesSummary(prev => ({
        ...prev,
        [cvId]: {
          has_notes: (response.notes || []).length > 0,
          notes_count: (response.notes || []).length,
          latest_note: (response.notes || []).length > 0
            ? (response.notes as any[]).reduce((latest, n) => {
              const a = (latest?.updated_at || latest?.created_at || '') as string;
              const b = (n?.updated_at || n?.created_at || '') as string;
              return a >= b ? latest : n;
            })
            : null,
        }
      }));
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleEditNote = (cvId: string) => {
    setEditingNote(cvId);
    setNoteText('');
  };

  const handleSaveNote = async (cvId: string) => {
    if (!noteText.trim()) return;

    setSavingNote(cvId);
    try {
      await api.addOrUpdateNote(cvId, noteText.trim(), user?.username || 'anonymous');
      await loadCandidateNotes(cvId);
      setEditingNote(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setSavingNote(null);
    }
  };

  const handleCancelNote = () => {
    setEditingNote(null);
    setNoteText('');
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

  // When matching is in progress, overlay is shown by layout (MatchingProgressBar)
  if ((loadingStates.matching.isLoading || loadingStates.careersMatching.isLoading) &&
    !loadingStates.matching.error && !loadingStates.careersMatching.error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <p className="text-sm">Preparing your results...</p>
      </div>
    );
  }

  // Error state - show error message if matching failed (check AFTER loading state)
  const matchError = loadingStates.matching.error || loadingStates.careersMatching.error;
  if (matchError) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">AI Matching Results</h1>
          <p className="text-base mt-2 text-gray-600">Matching Error</p>
        </div>
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-red-100">
            <Target className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Matching Failed</h3>
          <div className="max-w-2xl mx-auto p-6 rounded-lg border bg-red-50 border-red-200">
            <div>
              <p className="text-sm text-red-800 font-medium mb-2">Error Message:</p>
              <p className="text-base text-red-900">{matchError}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => useAppStore.getState().setCurrentTab?.('database')}
              className="inline-flex items-center px-4 py-2 bg-[#00529b] text-white rounded-lg hover:bg-[#003d73] transition-colors"
            >
              Go to Database
            </button>
            <button
              onClick={() => {
                // Clear error and allow user to try again
                useAppStore.getState().setLoading?.('matching', false, undefined);
                useAppStore.getState().setLoading?.('careersMatching', false, undefined);
              }}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - show when no matching is in progress and no results
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
            className="inline-flex items-center px-4 py-2 bg-[#00529b] text-white rounded-lg hover:bg-[#003d73] transition-colors"
          >
            Go to Database
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {matchingQueue?.isQueued && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 text-yellow-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                ⏳ Waiting in queue - Other users are currently matching
              </p>
              {matchingQueue.queuePosition !== null && (
                <p className="text-xs text-yellow-600 mt-1">
                  Your position: <span className="font-semibold">#{matchingQueue.queuePosition}</span>
                  {matchingQueue.estimatedWaitTime && (
                    <span className="ml-2">
                      • Estimated wait: {Math.ceil((matchingQueue.estimatedWaitTime || 0) / 60)} minutes
                    </span>
                  )}
                </p>
              )}
              {matchingQueue.message && (
                <p className="text-xs text-yellow-700 mt-1">{matchingQueue.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Match Results</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-0.5">
          {totalMatches} candidate{totalMatches !== 1 ? 's' : ''} evaluated. Sort and filter below.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gray-100">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-gray-900">
            {visibleMatches}
            {resultsLimit !== 'all' && totalMatches > visibleMatches && (
              <span className="text-sm text-gray-500 ml-1">/{totalMatches}</span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {resultsLimit !== 'all' ? `Top ${resultsLimit} Candidates` : 'Total Candidates'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-amber-50">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-amber-600">{visibleTop}%</div>
          <p className="text-sm text-gray-600">Best {resultsLimit !== 'all' ? 'Visible' : ''} Match</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-emerald-50">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-gray-900">{visibleAverage}%</div>
          <p className="text-sm text-gray-600">{resultsLimit !== 'all' ? 'Visible' : ''} Average Score</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 text-center border border-gray-200">
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-emerald-50">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-emerald-600">{visibleExcellent}</div>
          <p className="text-sm text-gray-600">{resultsLimit !== 'all' ? 'Visible' : ''} Excellent (≥80%)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-gray-100 shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Quality Distribution</h3>
            <p className="text-sm text-gray-600">Breakdown by overall match</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${(excellentMatches / Math.max(totalMatches, 1)) * 100}%` }}
              />
            </div>
            <div className="font-medium text-emerald-700">{excellentMatches} Excellent</div>
            <p className="text-sm text-gray-500">80–100% match</p>
          </div>
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-amber-500 transition-[width] duration-300"
                style={{ width: `${(goodMatches / Math.max(totalMatches, 1)) * 100}%` }}
              />
            </div>
            <div className="font-medium text-amber-700">{goodMatches} Good</div>
            <p className="text-sm text-gray-500">60–79% match</p>
          </div>
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-rose-500 transition-[width] duration-300"
                style={{ width: `${((totalMatches - excellentMatches - goodMatches) / Math.max(totalMatches, 1)) * 100}%` }}
              />
            </div>
            <div className="font-medium text-rose-700">
              {totalMatches - excellentMatches - goodMatches} Needs Review
            </div>
            <p className="text-sm text-gray-500">&lt;60% match</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] focus:border-[#00529b]"
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] focus:border-[#00529b]"
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-emerald-50 shrink-0">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Ranked Candidates</h3>
              <p className="text-sm text-gray-600">
                {sortedCandidates.length} shown{resultsLimit !== 'all' ? ` (top ${resultsLimit})` : ''} of {totalFiltered} total.
                Sorted by {sortBy === 'score' ? 'overall match' : sortBy}.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {sortedCandidates.map((candidate, index) => {
              const overall = candidate.computed_overall ?? 0;
              const badge = scoreBadge(overall);
              const isOpen = expandedMatch === candidate.cv_id;
              const displayName = resolveCandidateName(candidate, cvIndex);
              const title = resolveTitle(candidate, cvIndex);
              const yearsText = resolveYears(candidate, cvIndex);
              const expectedSalary = resolveExpectedSalary(candidate, applications ?? []);
              const cvMeta = cvIndex[candidate?.cv_id];
              const filename = cvMeta?.filename || `cv_${candidate.cv_id}.pdf`;

              return (
                <div
                  key={candidate.cv_id}
                  className={`relative overflow-hidden rounded-xl border bg-white ${isOpen ? 'ring-2 ring-[#00529b]/30 border-[#00529b]' : 'border-gray-200'}`}
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
                      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white shrink-0 ${barColor(
                              overall
                            )}`}
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{displayName}</h4>
                              {(notesSummary[candidate.cv_id]?.notes_count || (candidateNotes[candidate.cv_id]?.length || 0)) > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{notesSummary[candidate.cv_id]?.notes_count ?? (candidateNotes[candidate.cv_id]?.length || 0)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {title} • {yearsText}
                              {expectedSalary != null && (
                                <span className="text-gray-700 font-medium"> • Expected: AED {expectedSalary.toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {/* AI Badge and Score Info */}
                        <div className="flex items-center gap-4">
                          {candidate.has_llm_analysis && (
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                              <Sparkles className="w-3 h-3" />
                              <span>AI Verified</span>
                            </div>
                          )}
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
                              {candidate.has_llm_analysis && candidate.llm_analysis?.match_level ? (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${candidate.llm_analysis.match_level === 'Strong' ? 'bg-emerald-100 text-emerald-700' :
                                    candidate.llm_analysis.match_level === 'Good' ? 'bg-blue-100 text-blue-700' :
                                      candidate.llm_analysis.match_level === 'Average' ? 'bg-amber-100 text-amber-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                  {candidate.llm_analysis.match_level}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                                >
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-[#00529b] hover:text-[#003d73]">
                              {isOpen ? 'Hide details' : 'View details'}
                            </span>
                          </div>
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
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-[width] duration-300 ${barColor(candidate.skills_score ?? 0)}`}
                              style={{ width: `${Math.max(0, Math.min(100, (candidate.skills_score ?? 0) * 100))}%` }}
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
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-[width] duration-300 ${barColor(candidate.responsibilities_score ?? 0)}`}
                              style={{ width: `${Math.max(0, Math.min(100, (candidate.responsibilities_score ?? 0) * 100))}%` }}
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
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-[width] duration-300 ${barColor(candidate.job_title_score ?? 0)}`}
                              style={{ width: `${Math.max(0, Math.min(100, (candidate.job_title_score ?? 0) * 100))}%` }}
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
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-[width] duration-300 ${barColor(candidate.years_score ?? 0)}`}
                              style={{ width: `${Math.max(0, Math.min(100, (candidate.years_score ?? 0) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex justify-between items-center">
                        {/* Note Section */}
                        <div className="flex items-center gap-2">
                          {editingNote === candidate.cv_id ? (
                            <div className="flex items-center gap-2">
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note about this candidate..."
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] resize-none"
                                rows={2}
                                cols={30}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveNote(candidate.cv_id);
                                }}
                                disabled={savingNote === candidate.cv_id || !noteText.trim()}
                                className="flex items-center gap-1"
                              >
                                {savingNote === candidate.cv_id ? (
                                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelNote();
                                }}
                                className="flex items-center gap-1"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditNote(candidate.cv_id);
                                }}
                                className="flex items-center gap-1"
                              >
                                <Pencil className="w-4 h-4" />
                                <span>Add Note</span>
                              </Button>
                              {(notesSummary[candidate.cv_id]?.notes_count || (candidateNotes[candidate.cv_id]?.length || 0)) > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                  <MessageSquare className="w-4 h-4" />
                                  <span>{(notesSummary[candidate.cv_id]?.notes_count ?? (candidateNotes[candidate.cv_id]?.length || 0))} note{((notesSummary[candidate.cv_id]?.notes_count ?? (candidateNotes[candidate.cv_id]?.length || 0)) !== 1) ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cvMeta = cvIndex[candidate?.cv_id];
                              const filename = cvMeta?.filename || candidate.cv_name || `cv_${candidate.cv_id}.pdf`;
                              // Ensure filename has .pdf extension (simple: just add .pdf if missing)
                              const normalizedFilename = filename.toLowerCase().endsWith('.pdf') 
                                ? filename 
                                : `${filename}.pdf`;
                              handlePreviewFile(candidate.cv_id, 'cv', normalizedFilename);
                            }}
                            title="Preview Original File"
                            className="flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Preview</span>
                          </Button>

                          {/* We don't have CVDetails exported yet, so I'll just use the expand functionality 
                              The user said "beside delete button there is one more button Show Extracted Content"
                              Since there is no delete button here, I'll add it anyway as per requested UI.
                          */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMatch(expandedMatch === candidate.cv_id ? null : candidate.cv_id);
                            }}
                            title="Show AI Analysis"
                            className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <FileCheck className="w-4 h-4" />
                            <span>Details</span>
                          </Button>

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
                    </div>



                    {isOpen && (
                        <div className="px-5 pb-5">
                          <div className="mt-2 space-y-6">
                            {/* AI Analysis Section (Redesigned) */}
                            {candidate.has_llm_analysis && candidate.llm_analysis && (
                              <div className="p-6 rounded-xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${candidate.llm_analysis.match_level === 'Strong' ? 'bg-emerald-100 text-emerald-600' :
                                      candidate.llm_analysis.match_level === 'Good' ? 'bg-blue-100 text-blue-600' :
                                        'bg-amber-100 text-amber-600'
                                      }`}>
                                      <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <h4 className="text-lg font-bold text-gray-900 leading-tight">AI Match Analysis</h4>
                                      <p className="text-sm font-medium text-gray-500">
                                        Match Level: <span className={
                                          candidate.llm_analysis.match_level === 'Strong' ? 'text-emerald-600' :
                                            candidate.llm_analysis.match_level === 'Good' ? 'text-blue-600' :
                                              'text-amber-600'
                                        }>{candidate.llm_analysis.match_level || 'N/A'}</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-gray-900">{Math.round(overall * 100)}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                                  <div>
                                    <h5 className="text-sm font-bold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4" /> Key Matches
                                    </h5>
                                    <ul className="space-y-3">
                                      {(candidate.llm_analysis.key_matches || []).map((match: string, i: number) => (
                                        <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                          {match}
                                        </li>
                                      ))}
                                      {(!candidate.llm_analysis.key_matches || candidate.llm_analysis.key_matches.length === 0) && (
                                        <li className="text-sm text-gray-400">No key matches identified.</li>
                                      )}
                                    </ul>
                                  </div>

                                  <div>
                                    <h5 className="text-sm font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4" /> Gaps
                                    </h5>
                                    <ul className="space-y-3">
                                      {(candidate.llm_analysis.gaps || []).map((gap: string, i: number) => (
                                        <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                          {gap}
                                        </li>
                                      ))}
                                      {(!candidate.llm_analysis.gaps || candidate.llm_analysis.gaps.length === 0) && (
                                        <li className="text-sm text-gray-400 italic">No major gaps identified.</li>
                                      )}
                                    </ul>
                                  </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                  <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Fit Summary</h5>
                                  <p className="text-sm text-gray-800 leading-relaxed italic">
                                    "{candidate.llm_analysis.summary || 'Detailed summary unavailable.'}"
                                  </p>
                                </div>
                              </div>
                            )}

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

                            {/* Semantic Details (Hidden for AI analyze candidates) */}
                            {!candidate.has_llm_analysis && (
                              <>
                                {/* Skills details */}
                                {Array.isArray(candidate.skills_assignments) && candidate.skills_assignments.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <Brain className="w-4 h-4 text-[#00529b]" />
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
                                      <div className="text-lg font-semibold text-[#00529b]">
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
                              </>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
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
      </div>

      <FilePreviewModal
        isOpen={previewData.isOpen}
        onClose={() => {
          if (previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl(null);
          }
          setPreviewData((prev) => ({ ...prev, isOpen: false }));
        }}
        fileUrl={previewData.url}
        fileName={previewData.name}
        fileId={previewData.id}
        fileType={previewData.type === 'cv' ? 'application/pdf' : 'application/pdf'}
        extractedText={previewData.extractedText}
      />

      <QueueStatusModal
        isOpen={matchingQueue?.isQueued || false}
        queuePosition={matchingQueue?.queuePosition || null}
        estimatedWaitTime={matchingQueue?.estimatedWaitTime || null}
        message={matchingQueue?.message || null}
      />
    </div>
  );
}