'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Target, Users, Briefcase } from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button-enhanced';
import { LoadingCard } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Protected from '@/components/layout/Protected';
import ApplicationsList from '@/components/careers/ApplicationsList';
import type { JobPostingListItem } from '@/lib/types';

export default function JobApplicantsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const { user } = useAuthStore();
  const {
    selectJob,
    selectedJob,
    applications,
    matchJobCandidates,
    jobPostings,
    loadJobApplications,
  } = useCareersStore();
  const { setCurrentTab, setMatchingProgress, setLoading: setAppLoading } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    if (!jobId || !user) {
      if (!user) setError('You need to be logged in to view applicants.');
      setInitializing(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setError(null);
      setInitializing(true);
      try {
        // Step 1: Try to find job in already-loaded postings (no extra API call needed)
        const existingJob = jobPostings.find((j) => j.job_id === jobId);

        if (existingJob) {
          // Job is already in store — use it directly, no permission issues
          selectJob(existingJob);
        } else {
          // Job not in local store — try the edit endpoint (works if owner/admin),
          // but gracefully fall back for non-owners instead of blocking the page.
          let resolvedJob: JobPostingListItem;
          try {
            const editData = await api.getJobForEdit(jobId);
            resolvedJob = {
              job_id: jobId,
              job_title: editData.job_title,
              filename: '',
              upload_date: '',
              is_active: true,
              public_token: '',
            };
          } catch (editErr: any) {
            // 403 / not owner — we still want to show applicants read-only.
            // Use a placeholder title; the applicants list will still load fine.
            resolvedJob = {
              job_id: jobId,
              job_title: 'Job Applicants',
              filename: '',
              upload_date: '',
              is_active: true,
              public_token: '',
            };
          }

          if (cancelled) return;
          selectJob(resolvedJob);
        }

        // Step 2: Always load the applications for this job regardless of edit access
        if (!cancelled) {
          await loadJobApplications(jobId);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load applicants.');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatchCandidates = async () => {
    if (!selectedJob || applications.length === 0) return;
    try {
      setMatchingProgress({
        totalCVs: applications.length,
        processedCVs: 0,
        currentStage: 'initializing',
        isVisible: true,
        estimatedTimeRemaining: Math.max(30, applications.length * 3),
      });
      setAppLoading('careersMatching', true);
      setCurrentTab('match');
      router.push('/');
      await new Promise((r) => setTimeout(r, 500));
      await matchJobCandidates(selectedJob.job_id);
    } catch (e) {
      console.error('Failed to match candidates:', e);
      alert('Failed to match candidates. Please try again.');
    } finally {
      setIsMatching(false);
    }
  };

  if (!user) {
    return (
      <Protected>
        <div className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You need to be logged in to view applicants.</AlertDescription>
          </Alert>
        </div>
      </Protected>
    );
  }

  if (initializing) {
    return (
      <Protected>
        <div className="p-6">
          <LoadingCard />
        </div>
      </Protected>
    );
  }

  if (error) {
    return (
      <Protected>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to app
          </Button>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-[#eff6ff]/30">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Careers
            </Button>
          </div>

          <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <Briefcase className="w-4 h-4" />
                <span className="truncate">Job</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                {selectedJob?.job_title || 'Applicants'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  {applications.length} candidate{applications.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-sm text-gray-600">
                  Review CVs, add notes, and run AI match when ready
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {applications.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setIsMatching(true);
                    handleMatchCandidates();
                  }}
                  disabled={isMatching}
                  className="bg-[#00529b] hover:bg-[#003d73] !text-white"
                >
                  <Target className="w-4 h-4 mr-2 !text-white" />
                  {isMatching ? 'Starting…' : `Match ${applications.length}`}
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <ApplicationsList />
          </div>
        </div>
      </div>
    </Protected>
  );
}