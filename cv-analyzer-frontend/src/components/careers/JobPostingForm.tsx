import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Check, ExternalLink, Copy, Wand2, Edit3, Briefcase, Save } from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { api } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/toast';

interface JobPostingFormProps {
  onSuccess: () => void;
  jobId?: string; // For editing existing jobs
  publicToken?: string; // For preserving the public token when editing
  initialData?: {
    jobTitle: string;
    jobLocation: string;
    jobSummary: string;
    keyResponsibilities: string;
    qualifications: string;
  };
}

export default function JobPostingForm({ onSuccess, jobId, publicToken, initialData }: JobPostingFormProps) {
  const { createJobPosting, createJobPostingWithFormData, createManualJobPosting, isCreatingJob, error, clearError } = useCareersStore();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState<{link: string, token: string, jobId: string} | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    jobTitle: initialData?.jobTitle || '',
    jobLocation: initialData?.jobLocation || '',
    jobSummary: initialData?.jobSummary || '',
    keyResponsibilities: initialData?.keyResponsibilities || '',
    qualifications: initialData?.qualifications || ''
  });
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoFillData, setAutoFillData] = useState<any>(null);
  const [showForm, setShowForm] = useState(true); // Show form immediately
  
  // Auto-scroll to form when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      const formElement = document.getElementById('job-posting-form');
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, []);

  // Initialize success state for editing mode
  useEffect(() => {
    if (jobId && initialData) {
      if (publicToken) {
        // Job has a valid token, preserve it
        setSuccess({
          link: `${window.location.origin}/careers/jobs/${publicToken}`,
          token: publicToken,
          jobId: jobId
        });
      } else {
        // Job doesn't have a valid token, show a message
        setSuccess({
          link: 'Token will be generated after update',
          token: 'Will be generated',
          jobId: jobId
        });
      }
    }
  }, [jobId, initialData, publicToken]);
  
  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      clearError();
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return;
    }
    
    setSelectedFile(file);
    clearError();
  };
  
  // Auto-fill function that processes JD through existing pipeline
  const handleJDUpload = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      // Upload JD through existing pipeline
      const response = await api.uploadJD(selectedFile);
      
      if (response.status === 'success') {
        const jdId = response.jd_id;
        const standardizedData = response.standardized_data;
        
        // If we have the standardized data already, use it directly
        if (standardizedData) {
          const processedData = {
            job_requirements: standardizedData,
            structured_info: standardizedData
          };
          setAutoFillData(processedData);
          
          // Auto-fill form fields
          handleAutoFill(processedData);
          setShowForm(true);
        } else if (jdId) {
          // Fallback: Query the database to get processed data
          try {
            const detailsResponse = await api.getJDDetails(jdId);
            const processedData = detailsResponse;
            setAutoFillData(processedData);
            
            // Auto-fill form fields
            handleAutoFill(processedData);
            setShowForm(true);
          } catch (detailError) {
            console.warn('Failed to get JD details, but showing form anyway');
            setShowForm(true);
          }
        } else {
          setShowForm(true);
        }
      }
    } catch (error) {
      console.error('Failed to process JD:', error);
      // Keep form available for manual input
      setShowForm(true);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Auto-fill form fields from processed data
  const handleAutoFill = (processedData: any) => {
    const jobRequirements = processedData.job_requirements || {};
    const structuredInfo = processedData.structured_info || {};
    
    setFormData({
      jobTitle: jobRequirements.job_title || structuredInfo.job_title || '',
      jobLocation: structuredInfo.location || structuredInfo.job_location || '',
      jobSummary: structuredInfo.job_summary || structuredInfo.summary || '',
      keyResponsibilities: Array.isArray(jobRequirements.responsibilities) 
        ? jobRequirements.responsibilities.join('\n• ') 
        : (structuredInfo.responsibilities || []).join('\n• '),
      qualifications: Array.isArray(jobRequirements.skills)
        ? jobRequirements.skills.join('\n• ')
        : (structuredInfo.skills || []).join('\n• ')
    });
  };
  
  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };
  
  const handleSave = async () => {
    const currentJobId = jobId || success?.jobId;
    if (!currentJobId) {
      console.error('No job ID available for saving');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updateData = {
        job_title: formData.jobTitle || undefined,
        job_location: formData.jobLocation || undefined,
        job_summary: formData.jobSummary || undefined,
        key_responsibilities: formData.keyResponsibilities || undefined,
        qualifications: formData.qualifications || undefined,
      };

      const result = await api.updateJobPosting(currentJobId, updateData);

      if (result.success) {
        setSaveSuccess(true);
        console.log('About to show success toast for save (JobPostingForm)');
        showSuccess('Changes Saved Successfully!', 'Your job posting has been updated.');
        console.log('Success toast called for save (JobPostingForm)');
        // Call onSuccess to close dialog and refresh data after toast is visible
        setTimeout(() => onSuccess(), 5000);
      }
    } catch (error) {
      console.error('Failed to save job posting updates:', error);
      showError('Failed to Save Changes', 'Please try again or contact support if the issue persists.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    console.log('🔄 handleSubmit called - checking for duplicates...');
    
    if (!selectedFile && Object.values(formData).every(v => !v.trim())) {
      return; // No file and no form data
    }
    
    // Check if already processing
    if (isCreatingJob || isProcessing) {
      console.log('⚠️ Already creating job, preventing duplicate submission');
      return;
    }
    
    console.log('✅ Starting job creation process...');
    
    try {
      let result;
      
      if (selectedFile) {
        // If there's a file, use the file upload method
        console.log('Using createJobPostingWithFormData for file upload');
        result = await createJobPostingWithFormData(selectedFile, formData);
      } else {
        // If no file but has form data, use manual job posting
        console.log('Using createManualJobPosting for manual posting');
        result = await createManualJobPosting(formData);
      }
      
      if (result) {
        setSuccess({ 
          link: result.public_link, 
          token: result.public_token,
          jobId: result.job_id
        });
        setSelectedFile(null);
        // Keep form data for editing
        setShowForm(true);
        
        console.log('About to show success toast for job posting (JobPostingForm)');
        showSuccess('Job Posted Successfully!', 'Your job posting is now live and ready to receive applications.');
        console.log('Success toast called for job posting (JobPostingForm)');
        
        // Close form after delay
        setTimeout(() => {
          onSuccess();
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to create job posting:', error);
      showError('Failed to Post Job', 'Please try again or contact support if the issue persists.');
    }
  };
  
  const handleViewJob = () => {
    if (success?.link) {
      window.open(success.link, '_blank');
    }
  };
  
  // Robust copy implementation
  const copyToClipboard = async (text: string) => {
    try {
      // Modern browsers
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (fallbackErr) {
        return false;
      }
    }
  };

  const handleCopyLink = async () => {
    if (success?.link) {
      const copySuccess = await copyToClipboard(success.link);
      if (copySuccess) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error('Failed to copy link');
      }
    }
  };
  
  // Handle file input click directly
  const handleFileInputClick = () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  
  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div id="job-posting-form" className="space-y-6 scroll-mt-20">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Success Display */}
      {success && !jobId && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="space-y-3">
              <p className="font-semibold">Job posting created successfully!</p>
              
              {/* Professional Job Link */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Job Posting Link:</span>
                  <span className="text-sm bg-blue-100 px-2 py-1 rounded truncate max-w-xs">
                    {success.link}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyLink}
                    className="h-8 px-2 text-blue-700 hover:text-blue-900"
                    title="Copy job posting link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleViewJob}
                    className="h-8 px-2 text-blue-700 hover:text-blue-900"
                    title="Preview job posting"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <p className="text-xs">
                {copied ? 'Link copied to clipboard!' : 'Share this professional job posting link with candidates.'}
              </p>
              {success && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    💡 You can now edit the job details below and click "Save Changes" to update the job posting.
                  </p>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Save Success Display */}
      {saveSuccess && (
        <Alert className="border-blue-200 bg-blue-50">
          <Check className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <p className="font-semibold">Job posting updated successfully!</p>
            <p className="text-xs">Your changes have been saved to the job posting.</p>
          </AlertDescription>
        </Alert>
      )}
      
      {/* File Upload Area */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <CardTitle className="flex items-center space-x-3 text-gray-800">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span className="text-lg font-semibold">Job Description Upload</span>
              <p className="text-sm text-gray-600 font-normal">Upload your job description for automatic processing</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              dragActive
                ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'  // Enhanced drag active state
                : selectedFile
                ? 'border-green-500 bg-green-50 shadow-md'  // Enhanced selected file state
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'  // Enhanced default state
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-green-200 rounded-full mx-auto flex items-center justify-center">
                  <FileText className="w-8 h-8 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">{selectedFile.name}</p>
                  <p className="text-sm text-green-700">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex space-x-2 justify-center">
                  <Button
                    onClick={handleJDUpload}
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Processing...' : 'Upload JD & Auto-Fill'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setShowForm(false);
                      setFormData({
                        jobTitle: '',
                        jobLocation: '',
                        jobSummary: '',
                        keyResponsibilities: '',
                        qualifications: ''
                      });
                    }}
                    className="text-green-700 hover:bg-green-200"
                  >
                    Remove file
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mx-auto flex items-center justify-center shadow-lg">
                  <Upload className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-gray-900">
                    Upload Job Description
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Drag & drop or click to select a file for auto-fill
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">PDF</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">DOC</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">DOCX</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">TXT</span>
                    <span className="text-gray-400">•</span>
                    <span>Max 10MB</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  variant="outline"
                  onClick={handleFileInputClick}
                  className="cursor-pointer bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Select File
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Job Posting Form */}
      {(showForm || success || jobId) && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-gray-800">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <span className="text-lg font-semibold">
                  {success || jobId ? 'Edit Job Details' : 'Job Details Form'}
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  {autoFillData && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      ✨ Auto-filled from JD
                    </span>
                  )}
                  {(success || jobId) && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      ✏️ Editable
                    </span>
                  )}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Job Title */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Job Title *
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Job Location */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Job Location
              </label>
              <input
                type="text"
                value={formData.jobLocation}
                onChange={(e) => handleInputChange('jobLocation', e.target.value)}
                placeholder="e.g., Remote, Dubai, UAE"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Job Summary */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Job Summary
              </label>
              <textarea
                value={formData.jobSummary}
                onChange={(e) => handleInputChange('jobSummary', e.target.value)}
                placeholder="Brief overview of the role and company..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
              />
            </div>

            {/* Key Responsibilities */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Key Responsibilities
              </label>
              <textarea
                value={formData.keyResponsibilities}
                onChange={(e) => handleInputChange('keyResponsibilities', e.target.value)}
                placeholder="• Develop and maintain software applications&#10;• Collaborate with cross-functional teams&#10;• Participate in code reviews..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
              />
            </div>

            {/* Qualifications */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Qualifications & Requirements
              </label>
              <textarea
                value={formData.qualifications}
                onChange={(e) => handleInputChange('qualifications', e.target.value)}
                placeholder="• Bachelor's degree in Computer Science&#10;• 3+ years of experience&#10;• Proficiency in React, Node.js..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Submit Buttons */}
      <div className="bg-white border-t border-gray-200 pt-6 mt-8">
        <div className="flex justify-end space-x-4">
          <Button 
            variant="outline" 
            onClick={onSuccess}
            className="px-6 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            Cancel
          </Button>
          
          {/* Save button - only show after job is created or when editing */}
          {(success || jobId) && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          
          {/* Post Job button - only show if no job created yet and not editing */}
          {!success && !jobId && (
            <Button
              onClick={handleSubmit}
              disabled={(!selectedFile && !showForm) || (showForm && !formData.jobTitle.trim()) || isCreatingJob || isProcessing}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Briefcase className="w-5 h-5 mr-2" />
              {isCreatingJob ? 'Creating...' : isProcessing ? 'Processing...' : 'Post Job'}
            </Button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}