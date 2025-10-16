'use client';
import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Calendar,
  Briefcase,
  ExternalLink,
  Building,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { JobPostingListItem } from '@/lib/types';
import { Button } from '@/components/ui/button-enhanced';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MoreOpeningsProps {
  currentJobToken?: string; // Exclude current job from the list
}

export default function MoreOpenings({ currentJobToken }: MoreOpeningsProps) {
  const [recentJobs, setRecentJobs] = useState<JobPostingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch 6 jobs to ensure we have 5 after filtering out current job
        const jobs = await api.getRecentJobPostings(6);
        
        // Filter out the current job if token is provided
        const filteredJobs = currentJobToken 
          ? jobs.filter(job => job.public_token !== currentJobToken)
          : jobs;
        
        // Take only the first 5
        setRecentJobs(filteredJobs.slice(0, 5));
      } catch (err: any) {
        console.error('Failed to fetch recent jobs:', err);
        setError('Failed to load recent job openings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentJobs();
  }, [currentJobToken]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleJobClick = (job: JobPostingListItem) => {
    if (job.public_token && job.public_token !== 'unknown') {
      window.open(`/careers/jobs/${job.public_token}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading more openings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (recentJobs.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Other Openings</h3>
        <p className="text-gray-600">
          This is currently the only active job opening. Check back later for more opportunities!
        </p>
      </div>
    );
  }

  return (
    <div className="more-openings-section p-4 sm:p-8 space-y-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">More Openings</h2>
        <p className="text-sm sm:text-base text-gray-600">
          Explore other exciting career opportunities at our company
        </p>
      </div>

      <div className="space-y-3">
        {recentJobs.map((job, index) => (
          <div 
            key={job.job_id} 
            className="more-openings-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all duration-300 cursor-pointer group"
            onClick={() => handleJobClick(job)}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors break-words">
                  {job.job_title}
                </h3>
                {job.job_location && (
                  <div className="flex items-center space-x-1 mt-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{job.job_location}</span>
                  </div>
                )}
              </div>
              
              <div className="flex-shrink-0 sm:ml-4">
                <Button
                  size="sm"
                  className="apply-button px-3 sm:px-4 py-2 w-full sm:w-auto text-sm"
                  style={{
                    backgroundColor: 'rgba(0,82,155,0.8)',
                    borderColor: 'rgba(0,82,155,0.8)',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,61,115,0.9)';
                    e.currentTarget.style.borderColor = 'rgba(0,61,115,0.9)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,82,155,0.8)';
                    e.currentTarget.style.borderColor = 'rgba(0,82,155,0.8)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJobClick(job);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Apply
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {recentJobs.length >= 5 && (
        <div className="text-center pt-4">
          <p className="text-sm text-gray-500">
            Showing the 5 most recent job openings
          </p>
        </div>
      )}
    </div>
  );
}
