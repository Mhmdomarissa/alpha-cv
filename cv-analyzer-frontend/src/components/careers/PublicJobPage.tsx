'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Briefcase, 
  Calendar, 
  MapPin, 
  Star, 
  Users, 
  CheckCircle,
  AlertCircle,
  FileText,
  Clock
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import JobApplicationForm from './JobApplicationForm';

export default function PublicJobPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  
  const {
    publicJob,
    isLoading,
    error,
    loadPublicJob,
    clearError
  } = useCareersStore();

  const [showApplicationForm, setShowApplicationForm] = useState(false);

  useEffect(() => {
    if (token) {
      loadPublicJob(token);
    } else {
      // If no token provided, we should show an error state
      // instead of infinite loading
    }
  }, [token, loadPublicJob]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <LoadingCard count={1} />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Invalid job link. Please use the complete job posting URL provided by the employer.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (error || !publicJob) {
    return (
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Job posting not found or may have expired.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-start space-x-6">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Briefcase className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">
                {publicJob.job_title || 'Open Position'}
              </h1>
              <p className="text-xl text-primary-100 mb-4">
                {publicJob.company_name || 'Our Company'}
              </p>
              <div className="flex items-center space-x-6 text-primary-200">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Posted {formatDate(publicJob.upload_date)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Remote / On-site</span>
                </div>
                {publicJob.experience_required && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>{publicJob.experience_required} experience</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Job Description</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-neutral max-w-none">
                  <div className="whitespace-pre-wrap text-neutral-700 leading-relaxed">
                    {publicJob.job_description}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            {publicJob.requirements && publicJob.requirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Requirements</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {publicJob.requirements.filter(req => req.trim() !== '').map((requirement, index) => (
                      <div 
                        key={index}
                        className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg"
                      >
                        <Star className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-800">{requirement}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Responsibilities */}
            {publicJob.responsibilities && publicJob.responsibilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Responsibilities</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {publicJob.responsibilities.filter(resp => resp.trim() !== '').map((responsibility, index) => (
                      <div 
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg"
                      >
                        <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-blue-800">
                            {index + 1}
                          </span>
                        </div>
                        <span className="text-sm text-blue-800">{responsibility}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Application Sidebar */}
          <div className="space-y-6">
            {/* Apply Now Card */}
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-center">Ready to Apply?</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-neutral-600">
                    Submit your application and CV to be considered for this position.
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-xs text-neutral-500">
                    <Clock className="w-4 h-4" />
                    <span>Usually responds within 2 business days</span>
                  </div>
                </div>

                {showApplicationForm ? (
                  <JobApplicationForm 
                    jobToken={token}
                    onSuccess={() => setShowApplicationForm(false)}
                    onCancel={() => setShowApplicationForm(false)}
                  />
                ) : (
                  <Button 
                    className="w-full bg-primary-600 hover:bg-primary-700"
                    onClick={() => setShowApplicationForm(true)}
                  >
                    Apply Now
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle>About the Company</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600">
                    We are a leading company committed to innovation and excellence. 
                    Join our team and make a difference in your career.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-neutral-600">
                      <Users className="w-4 h-4" />
                      <span>Growing team</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-neutral-600">
                      <Star className="w-4 h-4" />
                      <span>Competitive benefits</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-neutral-600">
                      <Briefcase className="w-4 h-4" />
                      <span>Growth opportunities</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
