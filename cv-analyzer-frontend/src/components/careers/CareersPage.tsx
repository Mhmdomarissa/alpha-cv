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
  ToggleRight
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import JobPostingForm from './JobPostingForm';
import ApplicationsList from './ApplicationsList';

export default function CareersPage() {
  const { user } = useAuthStore();
  const {
    jobPostings,
    selectedJob,
    applications,
    isLoading,
    isUpdatingStatus,
    error,
    loadJobPostings,
    selectJob,
    updateJobStatus,
    clearError
  } = useCareersStore();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    loadJobPostings();
  }, [loadJobPostings]);

  const handleCopyLink = async (link: string, jobId: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(jobId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleStatusChange = async (jobId: string, isActive: boolean) => {
    await updateJobStatus(jobId, isActive);
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
            Please log in to access the careers management system.
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
          <h1 className="text-3xl font-bold text-neutral-900">Careers Management</h1>
          <p className="text-neutral-600 mt-1">Create job postings and manage applications</p>
        </div>
        
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button className="bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Job Posting</DialogTitle>
            </DialogHeader>
            <JobPostingForm 
              onSuccess={() => {
                setShowCreateForm(false);
                loadJobPostings();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearError}
            className="ml-auto"
          >
            <Check className="w-4 h-4" />
          </Button>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Active Jobs</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {jobPostings.filter(j => j.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <ToggleLeft className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Inactive Jobs</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {jobPostings.filter(j => !j.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total Jobs</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {jobPostings.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job Postings List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Briefcase className="w-5 h-5" />
              <span>Job Postings</span>
              <Badge variant="outline" className="ml-auto">
                {jobPostings.length} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingCard count={3} />
            ) : jobPostings.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-600">No job postings yet</p>
                <p className="text-sm text-neutral-500">Create your first job posting to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobPostings.map((job) => (
                  <div
                    key={job.job_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedJob?.job_id === job.job_id
                        ? 'border-primary-300 bg-primary-50'
                        : job.is_active
                        ? 'border-neutral-200 hover:border-neutral-300'
                        : 'border-gray-300 bg-gray-50 opacity-75 hover:opacity-100'
                    }`}
                    onClick={() => selectJob(job)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className={`font-semibold ${job.is_active ? 'text-neutral-900' : 'text-gray-600'}`}>
                            {job.job_title || 'Untitled Position'}
                          </h3>
                          {!job.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          {job.filename}
                        </p>
                        <div className="flex items-center space-x-3 mt-2">
                          <Badge variant={job.is_active ? 'default' : 'secondary'}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-xs text-neutral-500">
                            {formatDate(job.upload_date)}
                          </span>
                          <select
                            value={job.is_active ? 'active' : 'inactive'}
                            onChange={(e) => {
                              const isActive = e.target.value === 'active';
                              handleStatusChange(job.job_id, isActive);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border rounded px-2 py-1 bg-white"
                            disabled={isUpdatingStatus}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const publicLink = `${window.location.origin}/careers/jobs/${job.public_token}`;
                            handleCopyLink(publicLink, job.job_id);
                          }}
                          title="Copy Job Posting Link"
                        >
                          {copiedLink === job.job_id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const publicLink = `${window.location.origin}/careers/jobs/${job.public_token}`;
                            window.open(publicLink, '_blank');
                          }}
                          title="View Job Posting"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Applications for Selected Job */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Applications</span>
              {selectedJob && (
                <span className="text-sm font-normal text-neutral-600">
                  for {selectedJob.job_title || 'Selected Job'}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedJob ? (
              <ApplicationsList />
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-600">Select a job to view applications</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}