'use client';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Briefcase,
  Calendar,
  MapPin,
  Star,
  Users,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  Upload,
  X,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCareersStore } from '@/stores/careersStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCard } from '@/components/ui/loading';
import JobApplicationForm from './JobApplicationForm';
/** ================= Config ================= **/
const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
// Adjust to your backend if different:
const APPLICATIONS_ENDPOINT = (token: string) => `/api/careers/public/jobs/${token}/applications`;
interface PublicJobPageProps {
  token: string;
}
export default function PublicJobPage({ token }: PublicJobPageProps) {
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
  const jobUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), []);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <LoadingCard count={1} />
        </div>
      </div>
    );
  }
  if (!token) {
    return (
      <div className="py-12">
        <div className="max-w-5xl mx-auto px-6">
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
        <div className="max-w-5xl mx-auto px-6">
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
  const yearsExp = (() => {
    const v = publicJob.experience_required as unknown;
    if (typeof v === 'number') return `${v}+ years`;
    if (typeof v === 'string' && v.trim()) return v;
    return undefined;
  })();
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ================= Hero ================= */}
      <div className="relative bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  {false ? (
                    <img 
                      src="" 
                      alt={publicJob?.company_name || 'Company'} 
                      className="w-14 h-14 object-contain"
                    />
                  ) : (
                    <Briefcase className="w-10 h-10 text-white/80" />
                  )}
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2">{publicJob.job_title || 'Open Position'}</h1>
                  <p className="text-xl text-blue-100">{publicJob.company_name || 'Alpha Data Recruitment'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <Calendar className="w-5 h-5 text-blue-200" />
                  <div>
                    <p className="text-xs text-blue-200">Posted</p>
                    <p className="font-medium">{formatDate(publicJob.upload_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <MapPin className="w-5 h-5 text-blue-200" />
                  <div>
                    <p className="text-xs text-blue-200">Location</p>
                    <p className="font-medium">Remote / On-site</p>
                  </div>
                </div>
                {yearsExp && (
                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <Clock className="w-5 h-5 text-blue-200" />
                    <div>
                      <p className="text-xs text-blue-200">Experience</p>
                      <p className="font-medium">{yearsExp}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
                  onClick={copyLink}
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button 
                  className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg font-semibold"
                  onClick={() => setShowApplicationForm(true)}
                >
                  Apply Now
                </Button>
              </div>
            </div>
            
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Quick Apply</h3>
                <p className="text-blue-100 mb-4">Submit your application in just a few clicks</p>
                <Button 
                  className="w-full bg-white text-blue-700 hover:bg-blue-50 font-semibold"
                  onClick={() => setShowApplicationForm(true)}
                >
                  Start Application
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ================= Main Content ================= */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ===== Left column: Job Details ===== */}
          <div className="lg:col-span-2 space-y-8">
            {/* Job Description */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl border-b">
                <CardTitle className="flex items-center gap-3 text-blue-900">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl">Job Description</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="prose prose-lg max-w-none text-gray-700">
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {publicJob.job_description}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Requirements */}
            {publicJob.requirements && publicJob.requirements.filter(Boolean).length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-xl border-b">
                  <CardTitle className="flex items-center gap-3 text-green-900">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl">Requirements</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-3">
                    {publicJob.requirements
                      .filter((req: string) => req && req.trim())
                      .map((requirement: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-green-700" />
                          </div>
                          <span className="text-gray-700">{requirement}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Responsibilities */}
            {publicJob.responsibilities && publicJob.responsibilities.filter(Boolean).length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-t-xl border-b">
                  <CardTitle className="flex items-center gap-3 text-purple-900">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl">Responsibilities</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-4">
                    {publicJob.responsibilities
                      .filter((r: string) => r && r.trim())
                      .map((responsibility: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-sm font-semibold text-purple-900">{idx + 1}</span>
                          </div>
                          <span className="text-gray-700 leading-relaxed">{responsibility}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* ===== Right column: Apply & Company ===== */}
          <div className="space-y-8">
            {/* Application Card */}
            <Card className="shadow-lg border-0 sticky top-8">
  <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-xl border-b">
    <CardTitle className="text-center text-indigo-900 text-xl">
      {publicJob.is_active ? 'Apply for this Position' : 'Job Status'}
    </CardTitle>
  </CardHeader>
  <CardContent className="p-6">
    {publicJob.is_active ? (
      <AnimatePresence initial={false} mode="wait">
        {showApplicationForm ? (
          <motion.div
            key="full-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <JobApplicationForm
              jobToken={token}
              onSuccess={() => setShowApplicationForm(false)}
              onCancel={() => setShowApplicationForm(false)}
            />
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowApplicationForm(false)}
            >
              ← Back
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="apply-button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ready to join our team?</h3>
                <p className="text-gray-600 text-sm">Submit your application and take the next step in your career</p>
              </div>
            </div>
            
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3"
              onClick={() => setShowApplicationForm(true)}
            >
              Apply Now
            </Button>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Application typically reviewed within 2 business days</p>
              <p>• All applications are kept confidential</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ) : (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-700">No Longer Accepting Applications</h3>
          <p className="text-gray-600 mt-2">
            This job posting is no longer active and is not accepting new applications.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          <p>Thank you for your interest in our company.</p>
          <p>Please check back for future opportunities.</p>
        </div>
      </div>
    )}
  </CardContent>
</Card>
            
           
          </div>
        </div>
      </div>
    </div>
  );
}
/* ================= Helpers & Subcomponents ================= */
function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <div className="text-gray-500">{icon}</div>
      <span>{children}</span>
    </div>
  );
}
function StaggerCard({ children, sticky = false }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className={sticky ? 'sticky top-8' : undefined}
    >
      <Card className="shadow-lg border-0">{children}</Card>
    </motion.div>
  );
}
function bytesToMB(n: number) {
  return Math.round((n / (1024 * 1024)) * 10) / 10;
}
function CVQuickDrop({ token }: { token: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  
  const onFile = (f: File) => {
    setErr(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErr('Please upload a PDF or Word document (.pdf, .doc, .docx).');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`File too large. Max ${MAX_FILE_MB}MB.`);
      return;
    }
    setFile(f);
  };
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = () => {
    setDragOver(false);
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  
  // Handle file input click directly - using document.getElementById approach
  const handleFileInputClick = () => {
    const fileInput = document.getElementById('cv-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };
  
  const reset = () => {
    setFile(null);
    setProgress(0);
    setUploading(false);
    setSuccess(null);
    setErr(null);
    const fileInput = document.getElementById('cv-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };
  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    setSuccess(null);
    setProgress(5);
    try {
      const xhr = new XMLHttpRequest();
      const url = APPLICATIONS_ENDPOINT(token);
      const form = new FormData();
      form.append('cv', file);
      form.append('source', 'public_job_page');
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.max(10, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        };
        xhr.open('POST', url, true);
        xhr.send(form);
      });
      setProgress(100);
      setSuccess('CV uploaded successfully!');
    } catch (e: any) {
      setErr(e?.message || 'Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          block rounded-xl border-2 border-dashed p-6 transition-all duration-300
          ${dragOver 
            ? 'border-blue-500 bg-blue-50 shadow-md' 
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          }
        `}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900 mb-2">
              Drag & drop your CV
            </p>
            <p className="text-sm text-gray-600 mb-4">
              or click to browse files
            </p>
            <p className="text-xs text-gray-500">
              Supports PDF, DOC, DOCX (max {MAX_FILE_MB}MB)
            </p>
          </div>
        </div>
        
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileInputChange}
          className="hidden"
          id="cv-upload-input"
        />
        
        <div className="mt-4 text-center">
          <Button
            onClick={handleFileInputClick}
            className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            Select File
          </Button>
        </div>
      </div>
      
      {file && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {bytesToMB(file.size)}MB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={upload} 
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={reset}
                className="text-gray-500 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {(uploading || progress > 0) && (
            <div className="mt-3">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {progress}% complete
              </p>
            </div>
          )}
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <Check className="w-5 h-5" />
            <span className="font-medium">{success}</span>
          </div>
        </div>
      )}
      
      {err && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{err}</span>
          </div>
        </div>
      )}
    </div>
  );
}