'use client';
import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Calendar,
  Briefcase,
  CheckCircle,
  Users,
  AlertCircle,
  ExternalLink,
  Building
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import JobApplicationForm from './JobApplicationForm';
import MoreOpenings from './MoreOpenings';

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
      <div className="min-h-screen bg-transparent py-12">
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
    <div className="min-h-screen bg-transparent">
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-primary rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative w-14 h-14 bg-white rounded-xl border border-gray-100 flex items-center justify-center shadow-sm overflow-hidden p-2">
                  <img 
                    src="/alphadatalogo.svg"
                    alt="Alpha CV"
                    className="h-10 w-10 object-contain"
                  />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">AlphaData</h1>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recruitment Solutions</p>
              </div>
            </div>

            {publicJob.is_active ? (
              <Button
                onClick={() => setShowApplicationForm(true)}
                className="bg-gradient-primary text-white shadow-lg shadow-blue-900/20 px-6 h-11 font-semibold rounded-xl hover:scale-[1.02] transition-all"
                title="Apply now"
              >
                Apply Now
              </Button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-600 text-sm font-semibold">
                No longer accepting candidates
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 gap-6">
          {/* Main Job Info */}
          <div className="space-y-6">
            {/* Hero Card */}
            <div className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <div className="p-6 sm:p-7 relative">
                <div className="relative space-y-4 text-center">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                    {publicJob.job_title || 'Open Position'}
                  </h1>

                  <div className="mx-auto w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-600 place-items-center">
                    <div className="flex items-center gap-2.5 justify-center">
                      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                        <MapPin className="w-4.5 h-4.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Location</p>
                        <p className="text-sm font-semibold text-gray-700">{publicJob.job_location || 'UAE'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5 justify-center">
                      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                        <Building className="w-4.5 h-4.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Company</p>
                        <p className="text-sm font-semibold text-gray-700">{publicJob.company_name || 'AlphaData'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 justify-center">
                      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                        <Calendar className="w-4.5 h-4.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Posted On</p>
                        <p className="text-sm font-semibold text-gray-700">{formatDate(publicJob.upload_date)}</p>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>

        {/* Content Sections - Full Width Below Hero */}
        <div className="mt-8 space-y-6">
          {/* Job Summary */}
          <div className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-5 flex items-center gap-3">
              <div className="w-2 h-7 bg-gradient-primary rounded-full"></div>
              Job Summary
            </h2>
            <div className="prose prose-blue max-w-none text-gray-700 text-base leading-relaxed whitespace-pre-wrap">
              {publicJob.job_description}
            </div>
          </div>

          {/* Responsibilities */}
          {publicJob.responsibilities && publicJob.responsibilities.filter(Boolean).length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-2 h-7 bg-gradient-primary rounded-full"></div>
                Key Responsibilities
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {publicJob.responsibilities
                  .filter((r: string) => r && r.trim())
                  .map((responsibility: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all duration-300 group">
                      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-gradient-primary transition-colors">
                        <Users className="w-3.5 h-3.5 text-[#00529b] group-hover:text-white" />
                      </div>
                      <span className="text-gray-700 font-semibold leading-relaxed text-sm sm:text-base">{responsibility}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Qualifications */}
          {publicJob.requirements && publicJob.requirements.filter(Boolean).length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-2 h-7 bg-gradient-primary rounded-full"></div>
                Qualifications & Requirements
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {publicJob.requirements
                  .filter((req: string) => req && req.trim())
                  .map((requirement: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-blue-50/20 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all duration-300 group">
                      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-gradient-primary transition-colors">
                        <CheckCircle className="w-3.5 h-3.5 text-[#00529b] group-hover:text-white" />
                      </div>
                      <span className="text-gray-700 font-semibold leading-relaxed text-sm sm:text-base">{requirement}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Apply CTA (between Qualifications/Responsibilities and Related Openings) */}
          <div className="flex justify-center">
            {publicJob.is_active ? (
              <Button
                onClick={() => setShowApplicationForm(true)}
                className="bg-gradient-primary text-white shadow-lg shadow-blue-900/20 px-10 h-12 font-semibold rounded-2xl hover:scale-[1.02] transition-all"
              >
                Apply Now
              </Button>
            ) : (
              <div className="px-5 py-3 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-600 text-sm font-semibold">
                No longer accepting candidates
              </div>
            )}
          </div>

          {/* Related Jobs / More Openings */}
          <div className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 sm:p-12 overflow-hidden">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
              <div className="w-2 h-8 bg-gradient-primary rounded-full"></div>
              Related Openings
            </h3>
            <MoreOpenings currentJobToken={token} />
          </div>
        </div>
      </main>

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
                jobData={{
                  years_of_experience: publicJob.experience_required,
                  job_title: publicJob.job_title
                }}
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