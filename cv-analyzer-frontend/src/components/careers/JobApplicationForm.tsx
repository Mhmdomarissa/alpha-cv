'use client';
import React, { useState, useRef } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle,
  Send
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card-enhanced';

interface JobApplicationFormProps {
  jobToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function JobApplicationForm({ 
  jobToken, 
  onSuccess, 
  onCancel 
}: JobApplicationFormProps) {
  const { submitApplication, isSubmittingApplication, error, clearError } = useCareersStore();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Create a ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!selectedFile) {
      errors.file = 'CV file is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
    clearError();
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setFormErrors(prev => ({ 
        ...prev, 
        file: 'Please upload a PDF, DOC, DOCX, or TXT file' 
      }));
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setFormErrors(prev => ({ 
        ...prev, 
        file: 'File size must be less than 10MB' 
      }));
      return;
    }
    
    setSelectedFile(file);
    setFormErrors(prev => ({ ...prev, file: '' }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Function to handle file input click
  const handleFileInputClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const result = await submitApplication(
      jobToken,
      formData.name,
      formData.email,
      formData.phone || undefined,
      selectedFile!
    );
    
    if (result) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 3000);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Application Submitted!
          </h3>
          <p className="text-green-800 mb-4">
            Thank you for your interest. We'll review your application and get back to you soon.
          </p>
          <Button onClick={onSuccess} className="bg-green-600 hover:bg-green-700">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-neutral-900">Personal Information</h3>
        
        <div>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
            <Input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`pl-10 ${formErrors.name ? 'border-red-500' : ''}`}
            />
          </div>
          {formErrors.name && (
            <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
          )}
        </div>
        
        <div>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
            <Input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`pl-10 ${formErrors.email ? 'border-red-500' : ''}`}
            />
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
          )}
        </div>
        
        <div>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
            <Input
              type="tel"
              placeholder="Phone Number (Optional)"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>
      
      {/* CV Upload */}
      <div className="space-y-4">
        <h3 className="font-semibold text-neutral-900">Upload CV/Resume</h3>
        
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-primary-400 bg-primary-50'
              : selectedFile
              ? 'border-green-400 bg-green-50'
              : formErrors.file
              ? 'border-red-400 bg-red-50'
              : 'border-neutral-300 hover:border-neutral-400'
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
              <div className="w-12 h-12 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">{selectedFile.name}</p>
                <p className="text-sm text-green-700">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                Remove file
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-neutral-100 rounded-full mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6 text-neutral-600" />
              </div>
              <div>
                <p className="font-medium text-neutral-900">Upload your CV</p>
                <p className="text-sm text-neutral-600">
                  Drag & drop or click to select
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  PDF, DOC, DOCX, TXT (max 10MB)
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
                id="cv-upload"
                ref={fileInputRef}
              />
              <Button 
                type="button" 
                variant="outline" 
                className="cursor-pointer"
                onClick={handleFileInputClick}
              >
                Select File
              </Button>
            </div>
          )}
        </div>
        
        {formErrors.file && (
          <p className="text-sm text-red-600">{formErrors.file}</p>
        )}
      </div>
      
      {/* Submit Buttons */}
      <div className="flex space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmittingApplication}
          className="flex-1 bg-primary-600 hover:bg-primary-700"
        >
          {isSubmittingApplication ? (
            'Submitting...'
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Submit Application
            </>
          )}
        </Button>
      </div>
    </form>
  );
}