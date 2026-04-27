'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Users, 
  FileText, 
  Copy,
  Check,
  AlertCircle,
  Briefcase,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Trash2,
  User,
  RefreshCw,
  Target,
  Filter,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { useUserSessionStore } from '@/stores/userSessionStore';
import { JobPostingListItem } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import { AdminOnly } from '@/components/auth/RoleBasedAccess';
import JobPostingForm from './JobPostingForm';

const JOBS_PAGE_SIZE = 20;

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(d?: string) {
  if (!d || d === 'Unknown') return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

function downloadWordHtml(filename: string, html: string) {
  const blob = new Blob(
    [
      `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
    ],
    { type: 'application/msword;charset=utf-8' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filterJobPostings(
  list: JobPostingListItem[],
  opts: {
    jobFilter: 'all' | 'yours' | 'others';
    statusFilter: 'all' | 'active' | 'inactive';
    query: string;
    username?: string;
  }
): JobPostingListItem[] {
  let result = list;
  if (opts.jobFilter === 'yours') result = result.filter((job) => job.posted_by_user === opts.username);
  else if (opts.jobFilter === 'others') result = result.filter((job) => job.posted_by_user !== opts.username);
  if (opts.statusFilter === 'active') result = result.filter((job) => !!job.is_active);
  else if (opts.statusFilter === 'inactive') result = result.filter((job) => !job.is_active);
  const q = opts.query.trim().toLowerCase();
  if (q) {
    result = result.filter((job) => {
      const title = String(job.job_title || '').toLowerCase();
      const poster = String(job.posted_by_user || '').toLowerCase();
      const subject = String((job as any).email_subject_template || '').toLowerCase();
      const id = String(job.job_id || '').toLowerCase();
      return title.includes(q) || poster.includes(q) || subject.includes(q) || id.includes(q);
    });
  }
  return result;
}

export default function CareersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    jobPostings,
    totalJobPostings,
    isLoading,
    error,
    loadJobPostings,
    loadMoreJobPostings,
    updateJobStatus,
    selectJob,
    selectedJob,
    matchJobCandidates
  } = useCareersStore();
  const { setCurrentTab, setMatchingProgress, setLoading: setAppLoading } = useAppStore();
  
  const {
    loadingStates,
    setLoading,
    queueRequest,
    clearUserData
  } = useUserSessionStore();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPostingListItem | null>(null);
  const [editingJobData, setEditingJobData] = useState<any>(null);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState<string | null>(null);
  const [showJobDeleteConfirm, setShowJobDeleteConfirm] = useState<JobPostingListItem | null>(null);
  const [jobFilter, setJobFilter] = useState<'all' | 'yours' | 'others'>('all');
  const [listPageIndex, setListPageIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [reportFrom, setReportFrom] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return toYmd(start);
  });
  const [reportTo, setReportTo] = useState(() => toYmd(new Date()));
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Reset to first page when filters change
  useEffect(() => {
    setListPageIndex(0);
  }, [jobFilter, statusFilter, query]);

  // When user searches, load all remaining pages so results aren't limited to first page
  useEffect(() => {
    if (!query.trim()) return;
    const { totalJobPostings: total, jobPostings: jp } = useCareersStore.getState();
    if (total != null && jp.length >= total) return;
    let cancelled = false;
    const loadAll = async () => {
      let attempts = 0;
      while (attempts < 50 && !cancelled) {
        const { jobPostings: current, totalJobPostings: tot } = useCareersStore.getState();
        if (tot != null && current.length >= tot) break;
        const lenBefore = current.length;
        await loadMoreJobPostings();
        const lenAfter = useCareersStore.getState().jobPostings.length;
        if (lenAfter === lenBefore) break;
        attempts++;
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [query, loadMoreJobPostings]);

  useEffect(() => {
    queueRequest('load-job-postings', async () => {
      setLoading('careers', true);
      try {
        await loadJobPostings();
      } finally {
        setLoading('careers', false);
      }
    });
  }, [loadJobPostings, queueRequest, setLoading]);

  const handleToggleStatus = async (jobId: string, currentStatus: boolean) => {
    await updateJobStatus(jobId, !currentStatus);
  };

  const handleViewApplicants = (job: JobPostingListItem) => {
    router.push(`/careers/applicants/${job.job_id}`);
  };

  const handleDeleteAllJobPostings = async () => {
    setIsDeletingAll(true);
    try {
      const response = await api.deleteAllJobPostings();
      if (response.success) {
        await loadJobPostings();
        alert(`Successfully deleted all job postings!\n\nDetails:\n- Job postings deleted: ${response.details.job_postings_deleted}\n- JD documents deleted: ${response.details.jd_documents_deleted}\n- JD structured data deleted: ${response.details.jd_structured_deleted}\n- JD embeddings deleted: ${response.details.jd_embeddings_deleted}\n- CVs preserved: ${response.details.cvs_preserved}`);
      } else {
        alert('Failed to delete job postings. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to delete all job postings:', error);
      if (error.message?.includes('Admin') || error.message?.includes('403')) {
        alert('Access denied. Admin privileges required for this action.');
      } else {
        alert('Failed to delete job postings. Please try again.');
      }
    } finally {
      setIsDeletingAll(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditJob = async (job: JobPostingListItem) => {
    setEditingJob(job);
    setIsLoadingEditData(true);
    setEditingJobData(null);
    
    try {
      const jobData = await api.getJobForEdit(job.job_id);
      setEditingJobData(jobData);
      setShowEditForm(true);
    } catch (error) {
      console.error('Failed to load job data for editing:', error);
    } finally {
      setIsLoadingEditData(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadJobPostings();
      setListPageIndex(0);
    } catch (error) {
      console.error('Failed to refresh job postings:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMatchCandidates = async (job: JobPostingListItem) => {
    const totalCVs = job.application_count ?? 0;
    if (totalCVs === 0) return;
    try {
      setMatchingProgress({
        totalCVs,
        processedCVs: 0,
        currentStage: 'initializing',
        isVisible: true,
        estimatedTimeRemaining: Math.max(30, totalCVs * 3),
      });
      setAppLoading('careersMatching', true);
      setCurrentTab('match');
      selectJob(job);
      await new Promise((r) => setTimeout(r, 500));
      await matchJobCandidates(job.job_id);
    } catch (error) {
      console.error('Failed to match candidates:', error);
      alert('Failed to match candidates. Please try again.');
    }
  };

  const handleDeleteJob = async (job: JobPostingListItem) => {
    setIsDeletingJob(job.job_id);
    try {
      const response = await api.deleteJobPosting(job.job_id);
      if (response.success) {
        await loadJobPostings();
        alert(`Successfully deleted job posting "${job.job_title}"!\n\nDetails:\n- Job posting deleted: ${response.details.job_posting_deleted ? 'Yes' : 'No'}\n- JD documents deleted: ${response.details.jd_documents_deleted}\n- JD structured data deleted: ${response.details.jd_structured_deleted}\n- JD embeddings deleted: ${response.details.jd_embeddings_deleted}\n- Applications archived: ${response.details.applications_archived}`);
      } else {
        alert('Failed to delete job posting. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to delete job posting:', error);
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        alert('Job posting not found. It may have already been deleted.');
      } else if (error.message?.includes('403') || error.message?.includes('You can only delete job postings that you created')) {
        alert('Access denied. You can only delete job postings that you created.');
      } else if (error.message?.includes('401')) {
        alert('Access denied. Please make sure you are logged in.');
      } else {
        alert('Failed to delete job posting. Please try again.');
      }
    } finally {
      setIsDeletingJob(null);
      setShowJobDeleteConfirm(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const filteredJobs = useMemo(
    () =>
      filterJobPostings(jobPostings, {
        jobFilter,
        statusFilter,
        query,
        username: user?.username,
      }),
    [jobPostings, jobFilter, statusFilter, query, user?.username]
  );

  const maxPageIndex = Math.max(0, Math.ceil(filteredJobs.length / JOBS_PAGE_SIZE) - 1);

  useEffect(() => {
    setListPageIndex((p) => Math.min(p, maxPageIndex));
  }, [maxPageIndex]);

  const visibleJobs = useMemo(
    () =>
      filteredJobs.slice(
        listPageIndex * JOBS_PAGE_SIZE,
        listPageIndex * JOBS_PAGE_SIZE + JOBS_PAGE_SIZE
      ),
    [filteredJobs, listPageIndex]
  );

  const filterOpts = { jobFilter, statusFilter, query, username: user?.username };

  const handlePrevPage = () => {
    setListPageIndex((p) => Math.max(0, p - 1));
  };

  const handleNextPage = async () => {
    const nextPage = listPageIndex + 1;
    const nextStart = nextPage * JOBS_PAGE_SIZE;

    if (nextStart < filteredJobs.length) {
      setListPageIndex(nextPage);
      return;
    }

    for (let attempts = 0; attempts < 25; attempts++) {
      const { jobPostings: jp, totalJobPostings: total } = useCareersStore.getState();
      const filtered = filterJobPostings(jp, filterOpts);
      if (nextStart < filtered.length) {
        setListPageIndex(nextPage);
        return;
      }
      const totalCount = total ?? jp.length;
      if (jp.length >= totalCount) return;

      const lenBefore = jp.length;
      await loadMoreJobPostings();
      const lenAfter = useCareersStore.getState().jobPostings.length;
      if (lenAfter === lenBefore) return;
    }
  };

  const rangeStart = filteredJobs.length === 0 ? 0 : listPageIndex * JOBS_PAGE_SIZE + 1;
  const rangeEnd = Math.min((listPageIndex + 1) * JOBS_PAGE_SIZE, filteredJobs.length);
  const hasNextPageInMemory = (listPageIndex + 1) * JOBS_PAGE_SIZE < filteredJobs.length;
  const mayHaveMoreOnServer =
    totalJobPostings != null && jobPostings.length < totalJobPostings;
  const canGoNext = hasNextPageInMemory || mayHaveMoreOnServer;

  if (!user) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to be logged in to access the careers page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Full-page spinner only for the initial careers load, not for "load next page" (that would hide the list).
  if ((isLoading && jobPostings.length === 0) || loadingStates.careers) {
    return (
      <div className="p-6">
        <LoadingCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading job postings: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="relative z-10 w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Careers</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-0.5">
            {user.role === 'admin' ? 'Manage job postings and applications' : `Your job postings (${user.username})`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Loaded {jobPostings.length}{totalJobPostings != null ? ` of ${totalJobPostings}` : ''} jobs • Use filters to find roles quickly
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-gray-300 text-gray-700"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-primary text-white border-0 shadow-lg shadow-blue-900/20"
          >
            <FileText className="w-4 h-4 mr-2 text-white" />
            <span className="text-white">Post JD as File</span>
          </Button>
          <AdminOnly>
            {jobPostings.length > 0 && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white border-0"
                disabled={isDeletingAll}
              >
                {isDeletingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Jobs
                  </>
                )}
              </Button>
            )}
          </AdminOnly>
        </div>
      </div>

      {/* Role banners */}
      {user.role === 'admin' && (
        <div className="bg-blue-600 border border-blue-600 rounded-lg p-3 sm:p-4 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-start sm:items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full mt-1.5 sm:mt-0 shrink-0"></div>
            <p className="text-white text-xs sm:text-sm">
              <strong>Admin View:</strong> You can see and manage all job postings in the system.
            </p>
          </div>
        </div>
      )}

      {/* Weekly analysis report (admin only) */}
      <AdminOnly>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">Weekly Analysis Report</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Select date range and download a Word report. Uses aggregated stats (no heavy payloads).
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">From</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">To</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button
                disabled={!reportFrom || !reportTo || downloadingReport}
                className="bg-primary hover:bg-blue-700 !text-white border-0 shadow-sm"
                onClick={async () => {
                  if (downloadingReport) return;
                  setDownloadingReport(true);
                  try {
                    const r = await api.getWeeklyAnalysisReport({ startDate: reportFrom, endDate: reportTo });
                    const title = `Alpha CV – weekly Analysis Report`;
                    const dateLine = `(Date: ${r.range.start_date} – ${r.range.end_date})`;

                    const recruiters = r.recruiters_posted
                      .map((x, i) => `${i + 1}. ${x.recruiter} – ${x.jobs_posted}`)
                      .join('<br/>');

                    const appsByRecruiter = Object.entries(r.applications_by_recruiter)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([recruiter, jobs], idx) => {
                        const jobsHtml = jobs
                          .map((j, jIdx) => `${String.fromCharCode(97 + (jIdx % 26))}. ${j.job_title} – ${j.applications}`)
                          .join('<br/>');
                        return `${idx + 1}. <b>${recruiter}</b><br/>${jobsHtml}`;
                      })
                      .join('<br/><br/>');

                    const html = `
                      <div style="font-family:Calibri, Arial, sans-serif; font-size:11pt;">
                        <div style="font-weight:700; font-size:16pt;">${title}</div>
                        <div style="margin-top:4px; font-size:11pt;">${dateLine}</div>
                        <div style="margin-top:16px;">
                          <div><b>1. How many total jobs posted?</b></div>
                          <div>Total jobs posted – ${r.total_jobs_posted}</div>
                        </div>
                        <div style="margin-top:14px;">
                          <div><b>2. Which Recruiters Posted?</b></div>
                          <div style="margin-top:6px;">${recruiters || '—'}</div>
                        </div>
                        <div style="margin-top:14px;">
                          <div><b>3. How many applications got for each job?</b></div>
                          <div style="margin-top:6px;">${appsByRecruiter || '—'}</div>
                        </div>
                        <div style="margin-top:14px;">
                          <div><b>4. Any selections?</b></div>
                          <div style="margin-top:6px;">—</div>
                        </div>
                      </div>
                    `;

                    downloadWordHtml(`weekly_analysis_report_${r.range.start_date}_to_${r.range.end_date}.doc`, html);
                  } catch (e: any) {
                    alert(e?.message || 'Failed to generate report');
                  } finally {
                    setDownloadingReport(false);
                  }
                }}
              >
                {downloadingReport ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2 !text-white" />
                    <span className="!text-white">Download Word Report</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </AdminOnly>
      
      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[360px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search job title, poster, subject…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="inline-flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value as 'all' | 'yours' | 'others')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0"
                title="Ownership filter"
              >
                <option value="all">All Jobs</option>
                <option value="yours">Your Jobs</option>
                <option value="others">Others' Jobs</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0"
                title="Status filter"
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between lg:justify-end gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Filter className="w-4 h-4 text-gray-400" />
              <span>
                Showing {Math.min(visibleJobs.length, filteredJobs.length)} of {filteredJobs.length}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {user.role === 'user' && (
        <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start sm:items-center gap-2">
            <div className="w-2 h-2 bg-neutral-900 rounded-full mt-1.5 sm:mt-0 shrink-0"></div>
            <p className="text-neutral-900 text-xs sm:text-sm">
              <strong>User View:</strong> You can see all job postings but can only edit and manage the ones you created.
            </p>
          </div>
        </div>
      )}

      {/* Create Job Form */}
      {showCreateForm && (
        <JobPostingForm
          onSuccess={() => {
            setShowCreateForm(false);
            loadJobPostings();
          }}
        />
      )}

      {/* Job Postings List */}
      <div className="grid gap-6">
        {isLoading && jobPostings.length === 0 ? (
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} type="jd" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {jobPostings.length === 0
                  ? "No job postings yet"
                  : `No jobs found for "${jobFilter === 'all' ? 'All Jobs' : jobFilter === 'yours' ? 'Your Jobs' : "Others' Jobs"}" filter`
                }
              </h3>
              <p className="text-gray-600 mb-6">
                {jobPostings.length === 0
                  ? "Create your first job posting to get started."
                  : "Try changing the filter or create a new job posting."
                }
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-[neutral-900] hover:bg-[neutral-800] text-white border-0"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Post JD as File
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {visibleJobs.map((job) => (
            // ✅ Each job + its applicants are wrapped together
            <div key={job.job_id} className="space-y-0">
              <Card className="hover:shadow-md transition-shadow border-gray-200">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                          <CardTitle className="text-lg sm:text-xl break-words">{job.job_title}</CardTitle>
                          <Badge
                            variant={job.is_active ? "default" : "secondary"}
                            className={job.is_active ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-500"}
                          >
                            {job.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        {/* All action buttons in a single inline row */}
                        <div className="flex items-center gap-1 shrink-0">
                          {job.can_edit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleEditJob(job); }}
                              title="Edit"
                              className="h-8 w-8 p-0 rounded-full text-blue-600 hover:bg-blue-50"
                              disabled={isLoadingEditData}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
                          {job.can_edit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(job.job_id, job.is_active); }}
                              title={job.is_active ? 'Deactivate' : 'Activate'}
                              className={`h-8 w-8 p-0 rounded-full ${
                                job.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {job.is_active ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                            </Button>
                          )}
                          {job.can_delete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setShowJobDeleteConfirm(job); }}
                              title="Delete"
                              className="h-8 w-8 p-0 rounded-full text-red-600 hover:bg-red-50"
                              disabled={isDeletingJob === job.job_id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const jobUrl = `${window.location.origin}/careers/jobs/${job.public_token}`;
                              navigator.clipboard.writeText(jobUrl);
                              setCopiedLink(job.job_id);
                              setTimeout(() => setCopiedLink(null), 2000);
                            }}
                            title="Copy public job link"
                            className="h-8 w-8 p-0 rounded-full text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                          >
                            {copiedLink === job.job_id
                              ? <Check className="w-4 h-4 text-green-600" />
                              : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); window.open(`/careers/jobs/${job.public_token}`, '_blank'); }}
                            title="View Live Page"
                            className="h-8 w-8 p-0 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* User Attribution */}
                      {job.posted_by_user && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-gray-500 mb-2">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span>Posted by: </span>
                          <span className="font-medium text-neutral-900">{job.posted_by_user}</span>
                          {job.posted_by_role === 'admin' && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">Admin</Badge>
                          )}
                          {job.posted_by_role === 'user' && (
                            <Badge variant="outline" className="text-xs bg-neutral-100 text-neutral-500 border-neutral-200">User</Badge>
                          )}
                          {job.posted_by_user === user.username && (
                            <Badge variant="outline" className="text-xs bg-primary text-white border-blue-600 shadow-md">Your Job</Badge>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{job.application_count} applications</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileText className="w-4 h-4" />
                          <span>Created {formatDate(job.upload_date)}</span>
                        </div>
                      </div>

                      {/* Email Subject Template */}
                        {job.email_subject_template && (
                          <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email / Naukri Subject</span>
                              <div className="flex flex-wrap items-center justify-end gap-2" />
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2.5 rounded-lg shadow-sm group hover:border-blue-200 transition-colors">
                              <code className="text-xs sm:text-sm font-mono text-gray-800 break-all flex-1">
                                {job.email_subject_template}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(job.email_subject_template || '');
                                  setCopiedLink(`${job.job_id}-subject`);
                                  setTimeout(() => setCopiedLink(null), 2000);
                                }}
                                className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 gap-1.5 rounded-lg transition-all shrink-0"
                                title="Copy Subject"
                              >
                                {copiedLink === `${job.job_id}-subject` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span className="text-xs font-bold">Copy Subject</span>
                              </Button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-blue-400" />
                              Use this subject when posting on job boards or emailing candidates
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                  {/* Match + View Applied Candidates buttons */}
                  {(job.application_count || 0) > 0 && (
                    <div className="mt-8 pt-4 border-t border-gray-100">
                      <div className="flex flex-col sm:flex-row justify-end gap-3">
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleMatchCandidates(job); }}
                        title="Match Candidates"
                        className="bg-gradient-primary text-white w-full sm:w-auto shadow-lg shadow-blue-900/20"
                      >
                        <Target className="w-4 h-4 mr-1 text-white shrink-0" />
                        <span className="text-white truncate">Match ({job.application_count || 0})</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleViewApplicants(job)}
                        className="w-full sm:w-auto bg-gradient-primary text-white shadow-lg shadow-blue-900/20"
                      >
                        <Users className="w-4 h-4 mr-2 text-white shrink-0" />
                        <span className="text-white truncate">
                          View Applied Candidates ({job.application_count || 0})
                        </span>
                      </Button>
                      </div>
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Edit form inline below this specific job card */}
              {showEditForm && editingJob?.job_id === job.job_id && editingJobData && (
                <div className="mt-2">
                  <JobPostingForm
                    jobId={editingJob.job_id}
                    publicToken={editingJob.public_token === "unknown" ? undefined : editingJob.public_token}
                    initialData={{
                      jobTitle: editingJobData.job_title || '',
                      jobLocation: editingJobData.job_location || '',
                      jobSummary: editingJobData.job_summary || '',
                      keyResponsibilities: editingJobData.key_responsibilities || '',
                      qualifications: editingJobData.qualifications || ''
                    }}
                    onSuccess={() => {
                      setShowEditForm(false);
                      setEditingJob(null);
                      setEditingJobData(null);
                      loadJobPostings();
                    }}
                  />
                </div>
              )}

            </div>
            ))}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4 pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevPage}
                disabled={listPageIndex === 0 || isLoading}
                className="border-gray-300 text-gray-700 w-full sm:w-auto"
              >
                <ChevronLeft className="w-4 h-4 mr-1 shrink-0" />
                Previous
              </Button>
              <p className="text-sm text-gray-600 text-center order-first sm:order-none">
                {filteredJobs.length === 0
                  ? 'No matching jobs'
                  : `Showing ${rangeStart}–${rangeEnd} of ${filteredJobs.length}`}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleNextPage()}
                disabled={!canGoNext || isLoading}
                className="border-gray-300 text-gray-700 w-full sm:w-auto"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1 shrink-0" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Admin delete all confirmation */}
      <AdminOnly>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Delete All Job Postings</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete all job postings? This action cannot be undone.
                <br /><br />
                <strong>Note:</strong> All CVs (including job applications) will be preserved.
                <br />
                <strong className="text-red-600">⚠️ Admin-only action</strong>
              </p>
              <div className="flex justify-end space-x-3">
                <Button onClick={() => setShowDeleteConfirm(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-700" disabled={isDeletingAll}>
                  Cancel
                </Button>
                <Button onClick={handleDeleteAllJobPostings} className="bg-red-600 hover:bg-red-700 text-white" disabled={isDeletingAll}>
                  {isDeletingAll ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Deleting...</>
                  ) : (
                    <><Trash2 className="w-4 h-4 mr-2" />Delete All</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AdminOnly>

      {/* Individual job delete confirmation */}
      {showJobDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Job Posting</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>"{showJobDeleteConfirm.job_title}"</strong>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800"><strong>This action will:</strong></p>
              <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                <li>Mark the job posting as deleted</li>
                <li>Archive {showJobDeleteConfirm.application_count || 0} application(s)</li>
                <li>Remove the job from public view</li>
              </ul>
              <p className="text-sm text-yellow-800 mt-2">
                💡 <strong>Note:</strong> This is a soft deletion - data can be recovered if needed.
              </p>
              {user.role === 'admin' && showJobDeleteConfirm.posted_by_user !== user.username && (
                <p className="text-sm text-blue-800 mt-2">
                  🔧 <strong>Admin Action:</strong> You are deleting a job posted by {showJobDeleteConfirm.posted_by_user}.
                </p>
              )}
              {user.role === 'user' && showJobDeleteConfirm.posted_by_user === user.username && (
                <p className="text-sm text-green-800 mt-2">
                  ✅ <strong>Your Job:</strong> You are deleting your own job posting.
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button onClick={() => setShowJobDeleteConfirm(null)} className="bg-gray-300 hover:bg-gray-400 text-gray-700" disabled={isDeletingJob === showJobDeleteConfirm.job_id}>
                Cancel
              </Button>
              <Button onClick={() => handleDeleteJob(showJobDeleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white" disabled={isDeletingJob === showJobDeleteConfirm.job_id}>
                {isDeletingJob === showJobDeleteConfirm.job_id ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Deleting...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" />Delete Job</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
