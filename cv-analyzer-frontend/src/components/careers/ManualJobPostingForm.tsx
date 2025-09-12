import React, { useState, useEffect } from 'react';
import { Edit3, AlertCircle, Check, ExternalLink, Copy, Save, X } from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { useToast, ToastContainer } from '@/components/ui/toast';

interface ManualJobPostingFormProps {
  onSuccess: () => void;
  jobId?: string; // For editing existing jobs
  publicToken?: string; // For preserving the public token when editing
  initialData?: {
    jobTitle: string;
    jobLocation: string;
    jobSummary: string;
    keyResponsibilities: string;
    qualifications: string;
    companyName: string;
    additionalInfo: string;
  };
}

function ManualJobPostingForm({ onSuccess, jobId, publicToken, initialData }: ManualJobPostingFormProps) {
  const { createManualJobPosting, isCreatingJob, error, clearError } = useCareersStore();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
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
    qualifications: initialData?.qualifications || '',
    companyName: initialData?.companyName || '',
    additionalInfo: initialData?.additionalInfo || ''
  });
  
  // Auto-scroll to form when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      const formElement = document.getElementById('manual-job-posting-form');
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
    
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
  
  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        company_name: formData.companyName || undefined,
        additional_info: formData.additionalInfo || undefined,
      };

      const result = await api.updateJobPosting(currentJobId, updateData);

      if (result.success) {
        setSaveSuccess(true);
        console.log('About to show success toast for save');
        showSuccess('Changes Saved Successfully!', 'Your job posting has been updated.');
        console.log('Success toast called for save');
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
    console.log('🔄 ManualJobPostingForm handleSubmit called - checking for duplicates...');
    
    if (!formData.jobTitle.trim()) {
      return; // Job title is required
    }
    
    // Check if already processing
    if (isCreatingJob) {
      console.log('⚠️ Already creating job, preventing duplicate submission');
      return;
    }
    
    console.log('✅ Starting manual job creation process...');
    
    try {
      const result = await createManualJobPosting(formData);
      
      if (result) {
        setSuccess({ 
          link: result.public_link, 
          token: result.public_token,
          jobId: result.job_id
        });
        
        console.log('About to show success toast for job posting');
        showSuccess('Job Posted Successfully!', 'Your job posting is now live and ready to receive applications.');
        console.log('Success toast called for job posting');
        
        // Close form after delay
        setTimeout(() => {
          onSuccess();
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to create manual job posting:', error);
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

  
  
  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div id="manual-job-posting-form" className="space-y-6 scroll-mt-20">
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
                    className="h-8 px-2 text-blue-700 hover:text-blue-700"
                    title="Copy job posting link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleViewJob}
                    className="h-8 px-2 text-blue-700 hover:text-blue-700"
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
      
      {/* Manual Job Posting Form */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
          <CardTitle className="flex items-center space-x-3 text-gray-800">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <span className="text-lg font-semibold">
                {success || jobId ? 'Edit Job Details' : 'Manual Job Posting Form'}
              </span>
              <div className="flex items-center space-x-2 mt-1">
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
          {/* Company Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="e.g., Alpha Data Recruitment"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500"
            />
          </div>

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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
            />
          </div>

          {/* Additional Information */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              Additional Information
            </label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
              placeholder="Any additional details about the position, benefits, or company culture..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-gray-900 placeholder-gray-500 resize-none"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Submit Buttons */}
      <div className="bg-white border-t border-gray-200 pt-6 mt-8">
        <div className="flex justify-end space-x-4">
          <Button 
            variant="outline" 
            onClick={onSuccess}
            className="px-6 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <X className="w-5 h-5 mr-2" />
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
              disabled={!formData.jobTitle.trim() || isCreatingJob}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit3 className="w-5 h-5 mr-2" />
              {isCreatingJob ? 'Creating...' : 'Post Job'}
            </Button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default ManualJobPostingForm;