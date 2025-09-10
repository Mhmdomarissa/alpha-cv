'use client';
import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Calendar,
  Briefcase,
  CheckCircle,
  Users,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import JobApplicationForm from './JobApplicationForm';

interface ProfessionalJobPageProps {
  token: string;
}

export default function ProfessionalJobPage({ token }: ProfessionalJobPageProps) {
  const { publicJob, isLoading, error, loadPublicJob, clearError } = useCareersStore();
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  useEffect(() => {
    if (token) loadPublicJob(token);
  }, [token, loadPublicJob]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
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
            <AlertDescription>{error || 'Job posting not found or may have expired.'}</AlertDescription>
          </Alert>
          {error && (
            <div className="mt-4 flex">
              <Button variant="ghost" onClick={() => clearError?.()}>Dismiss</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="professional-job-layout">
      {/* Header with Logo and Apply Button */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* AlphaData Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-16 h-12 flex items-center justify-center">
                <img 
                  src="https://www.alphadatarecruitment.ae/wp-content/uploads/2020/07/130-60.svg"
                  alt="AlphaData Recruitment"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to briefcase icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="alphadata-logo w-12 h-12 rounded-lg items-center justify-center hidden">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AlphaData</h1>
                <p className="text-sm text-gray-600">Recruitment Solutions</p>
              </div>
            </div>

            {/* Apply Button - Top Right */}
            {publicJob.is_active && (
              <Button
                onClick={() => setShowApplicationForm(true)}
                className="btn-professional animate-scale-in"
              >
                Apply Now
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Job Title and Location */}
          <div className="text-center space-y-4 animate-slide-in-up">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 job-title-mobile">
              {publicJob.job_title || 'Open Position'}
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-gray-600">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>{publicJob.company_name || 'AlphaData Recruitment'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Posted {formatDate(publicJob.upload_date)}</span>
              </div>
            </div>
          </div>

          {/* Job Summary Section */}
          <div className="job-section-card animate-slide-in-up">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Job Summary:
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-gray max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {publicJob.job_description}
                </div>
              </div>
            </CardContent>
          </div>

          {/* Key Responsibilities Section */}
          {publicJob.responsibilities && publicJob.responsibilities.filter(Boolean).length > 0 && (
            <div className="job-section-card animate-slide-in-up">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Key Responsibilities:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {publicJob.responsibilities
                    .filter((r: string) => r && r.trim())
                    .map((responsibility: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{responsibility}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </div>
          )}

          {/* Qualifications Section */}
          {publicJob.requirements && publicJob.requirements.filter(Boolean).length > 0 && (
            <div className="job-section-card animate-slide-in-up">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Qualifications:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {publicJob.requirements
                    .filter((req: string) => req && req.trim())
                    .map((requirement: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{requirement}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </div>
          )}

          {/* Bottom Apply Button */}
          <div className="text-center py-8 animate-slide-in-up">
            {publicJob.is_active ? (
              <Button
                onClick={() => setShowApplicationForm(true)}
                className="btn-professional text-lg px-8 py-3"
              >
                Apply Now
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-700">No Longer Accepting Applications</h3>
                  <p className="text-gray-600 mt-2">
                    This job posting is no longer active and is not accepting new applications.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Application Form Modal/Overlay */}
      {showApplicationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Apply for this Position</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowApplicationForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </Button>
              </div>
              
              <JobApplicationForm
                jobToken={token}
                onSuccess={() => setShowApplicationForm(false)}
                onCancel={() => setShowApplicationForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
