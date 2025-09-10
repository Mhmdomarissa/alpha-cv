import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Check, ExternalLink, Copy, Wand2, Edit3, Briefcase } from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { api } from '@/lib/api';

interface JobPostingFormProps {
  onSuccess: () => void;
}

export default function JobPostingForm({ onSuccess }: JobPostingFormProps) {
  const { createJobPosting, isCreatingJob, error, clearError } = useCareersStore();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState<{link: string, token: string} | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    jobTitle: '',
    jobLocation: '',
    jobSummary: '',
    keyResponsibilities: '',
    qualifications: ''
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
  
  const handleSubmit = async () => {
    if (!selectedFile && Object.values(formData).every(v => !v.trim())) {
      return; // No file and no form data
    }
    
    // If we have form data, create a job posting with form data
    if (showForm && Object.values(formData).some(v => v.trim())) {
      try {
        // Create job posting with form data - you can integrate this with your backend
        const jobPostingData = {
          ...formData,
          originalFile: selectedFile
        };
        
        // For now, still use the existing method but we could enhance the backend later
        if (selectedFile) {
          const result = await createJobPosting(selectedFile);
          if (result) {
            setSuccess({ 
              link: result.public_link, 
              token: result.public_token 
            });
            setSelectedFile(null);
            setFormData({
              jobTitle: '',
              jobLocation: '',
              jobSummary: '',
              keyResponsibilities: '',
              qualifications: ''
            });
            setShowForm(false);
            
            // Close form after delay
            setTimeout(() => {
              onSuccess();
            }, 5000);
          }
        }
      } catch (error) {
        console.error('Failed to create job posting:', error);
      }
    } else {
      // Original flow for file-only submissions
      if (selectedFile) {
        const result = await createJobPosting(selectedFile);
        if (result) {
          setSuccess({ 
            link: result.public_link, 
            token: result.public_token 
          });
          setSelectedFile(null);
          
          // Close form after delay
          setTimeout(() => {
            onSuccess();
          }, 5000);
        }
      }
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
    <div id="job-posting-form" className="space-y-6 scroll-mt-20">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Success Display */}
      {success && (
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
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Job Description Upload</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-100'  // Enhanced drag active state
                : selectedFile
                ? 'border-green-500 bg-green-100'  // Enhanced selected file state
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'  // Enhanced default state
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
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    Upload Job Description
                  </p>
                  <p className="text-gray-600">
                    Drag & drop or click to select a file for auto-fill
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports PDF, DOC, DOCX, TXT (max 10MB)
                  </p>
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
                  className="cursor-pointer bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Select File
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Job Posting Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5 text-green-600" />
              <span>Job Details Form</span>
              {autoFillData && (
                <span className="auto-fill-badge">
                  Auto-filled from JD
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="enhanced-input w-full"
              />
            </div>

            {/* Job Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Location
              </label>
              <input
                type="text"
                value={formData.jobLocation}
                onChange={(e) => handleInputChange('jobLocation', e.target.value)}
                placeholder="e.g., Remote, Dubai, UAE"
                className="enhanced-input w-full"
              />
            </div>

            {/* Job Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Summary
              </label>
              <textarea
                value={formData.jobSummary}
                onChange={(e) => handleInputChange('jobSummary', e.target.value)}
                placeholder="Brief overview of the role and company..."
                rows={4}
                className="enhanced-textarea w-full resize-vertical"
              />
            </div>

            {/* Key Responsibilities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Responsibilities
              </label>
              <textarea
                value={formData.keyResponsibilities}
                onChange={(e) => handleInputChange('keyResponsibilities', e.target.value)}
                placeholder="• Develop and maintain software applications&#10;• Collaborate with cross-functional teams&#10;• Participate in code reviews..."
                rows={6}
                className="enhanced-textarea w-full resize-vertical"
              />
            </div>

            {/* Qualifications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qualifications & Requirements
              </label>
              <textarea
                value={formData.qualifications}
                onChange={(e) => handleInputChange('qualifications', e.target.value)}
                placeholder="• Bachelor's degree in Computer Science&#10;• 3+ years of experience&#10;• Proficiency in React, Node.js..."
                rows={6}
                className="enhanced-textarea w-full resize-vertical"
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={(!selectedFile && !showForm) || (showForm && !formData.jobTitle.trim()) || isCreatingJob || isProcessing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isCreatingJob ? 'Creating...' : isProcessing ? 'Processing...' : 'Post Job'}
        </Button>
      </div>
    </div>
  );
}