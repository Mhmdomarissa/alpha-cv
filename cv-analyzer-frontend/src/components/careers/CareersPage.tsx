'use client';
import React, { useEffect, useState } from 'react';
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
  Target
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { JobPostingListItem } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import { AdminOnly } from '@/components/auth/RoleBasedAccess';
import JobPostingForm from './JobPostingForm';
import ApplicationsList from './ApplicationsList';
import MatchingAnimation from '@/components/ui/matching-animation';

export default function CareersPage() {
  const { user } = useAuthStore();
  const {
    jobPostings,
    isLoading,
    error,
    loadJobPostings,
    updateJobStatus,
    selectJob,
    selectedJob,
    matchJobCandidates
  } = useCareersStore();
  const { setCurrentTab } = useAppStore();
  
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

  useEffect(() => {
    loadJobPostings();
  }, [loadJobPostings]);

  const handleToggleStatus = async (jobId: string, currentStatus: boolean) => {
    await updateJobStatus(jobId, !currentStatus);
  };

  const handleSelectJob = (job: JobPostingListItem) => {
    selectJob(job);
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
      // Handle specific admin permission error
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
    } catch (error) {
      console.error('Failed to refresh job postings:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMatchCandidates = async (job: JobPostingListItem) => {
    try {
      // Show matching animation
      setIsMatching(true);
      
      // First select the job to load its applications
      selectJob(job);
      
      // Wait a moment for applications to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Run the matching
      await matchJobCandidates(job.job_id);
      
      // Hide matching animation
      setIsMatching(false);
      
      // Navigate to match results tab
      setCurrentTab('match');
    } catch (error) {
      console.error('Failed to match candidates:', error);
      // Hide matching animation on error
      setIsMatching(false);
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
      // Handle specific errors
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        alert('Job posting not found. It may have already been deleted.');
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
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

  if (isLoading) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-gray-600 mt-1">Manage your job postings and applications</p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={handleRefresh}
            className="bg-white hover:bg-gray-50 text-black border border-gray-300"
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
            className="bg-white hover:bg-gray-50 text-black border border-gray-300"
          >
            <FileText className="w-4 h-4 mr-2" />
            Post JD as File
          </Button>
          {/* 🚨 ADMIN-ONLY DELETE ALL BUTTON 🚨 */}
          <AdminOnly>
            {jobPostings.length > 0 && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-600"
                style={{ color: 'white' }}
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

      {/* Job Postings List */}
      <div className="grid gap-6">
        {jobPostings.length === 0 ? (
        <Card>
            <CardContent className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No job postings yet</h3>
              <p className="text-gray-600 mb-6">Create your first job posting to get started.</p>
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-white hover:bg-gray-50 text-black border border-gray-300"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Post JD as File
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          jobPostings.map((job) => (
            <div key={job.job_id} className="space-y-4">
              <Card 
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  selectedJob?.job_id === job.job_id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => handleSelectJob(job)}
              >
              <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <CardTitle className="text-xl">{job.job_title}</CardTitle>
                      <Badge variant={job.is_active ? "default" : "secondary"}>
                        {job.is_active ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        
                        {/* User Attribution */}
                        {job.posted_by_user && (
                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            <User className="w-4 h-4 mr-1" />
                            <span>Posted by: </span>
                            <span className="font-medium text-gray-700 ml-1">{job.posted_by_user}</span>
                            {job.posted_by_role === 'admin' && (
                              <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
                            )}
                          </div>
                        )}
                        
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{job.application_count} applications</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>Created {formatDate(job.upload_date)}</span>
                      </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                    {/* Match Candidates Button - Only show if job has applications */}
                    {(job.application_count || 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMatchCandidates(job);
                        }}
                        title="Match Candidates"
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-3 py-1 shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <Target className="w-4 h-4 mr-1" />
                        Match ({job.application_count || 0})
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                      title="Edit Job Posting"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      disabled={isLoadingEditData}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(job.job_id, job.is_active);
                      }}
                      title={job.is_active ? "Deactivate Job" : "Activate Job"}
                      className={job.is_active 
                        ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                        : "text-green-600 hover:text-green-700 hover:bg-green-50"
                      }
                    >
                      {job.is_active ? (
                        <ToggleLeft className="w-4 h-4" />
                      ) : (
                        <ToggleRight className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowJobDeleteConfirm(job);
                      }}
                      title="Delete Job Posting"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={isDeletingJob === job.job_id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    
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
                      title="Copy Job Link"
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                        >
                          {copiedLink === job.job_id ? (
                        <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                        window.open(`/careers/jobs/${job.public_token}`, '_blank');
                          }}
                      title="View Job Posting"
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                    
                  </div>
              </div>
              </CardHeader>
              
                {selectedJob?.job_id === job.job_id && (
                  <CardContent>
                    <ApplicationsList />
                  </CardContent>
                )}
        </Card>
        
              {/* Edit Job Form - Show directly below the job being edited */}
              {showEditForm && editingJob && editingJobData && editingJob.job_id === job.job_id && (
                <div className="mt-4">
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
          ))
        )}
      </div>

      {/* Create Job Form (File Upload) */}
      {showCreateForm && (
        <JobPostingForm
          onSuccess={() => {
            setShowCreateForm(false);
            loadJobPostings();
          }}
        />
      )}


      {/* 🚨 ADMIN-ONLY DELETE CONFIRMATION DIALOG 🚨 */}
      <AdminOnly>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700"
                  disabled={isDeletingAll}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteAllJobPostings}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  style={{ color: 'white' }}
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
                      Delete All
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AdminOnly>

      {/* Individual Job Delete Confirmation Dialog */}
      {showJobDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Job Posting</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>"{showJobDeleteConfirm.job_title}"</strong>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>This action will:</strong>
              </p>
              <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                <li>Mark the job posting as deleted</li>
                <li>Archive {showJobDeleteConfirm.application_count || 0} application(s)</li>
                <li>Remove the job from public view</li>
              </ul>
              <p className="text-sm text-yellow-800 mt-2">
                💡 <strong>Note:</strong> This is a soft deletion - data can be recovered if needed.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                onClick={() => setShowJobDeleteConfirm(null)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700"
                disabled={isDeletingJob === showJobDeleteConfirm.job_id}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteJob(showJobDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white"
                style={{ color: 'white' }}
                disabled={isDeletingJob === showJobDeleteConfirm.job_id}
              >
                {isDeletingJob === showJobDeleteConfirm.job_id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Job
                  </>
                )}
              </Button>
            </div>
          </div>
      </div>
      )}

      {/* Matching Animation */}
      <MatchingAnimation isVisible={isMatching} />
    </div>
  );
}