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
  jobData?: {
    years_of_experience?: string | number;
    job_title?: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function JobApplicationForm({ 
  jobToken, 
  jobData,
  onSuccess, 
  onCancel 
}: JobApplicationFormProps) {
  const { submitApplication, isSubmittingApplication, error, clearError } = useCareersStore();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    expectedSalary: '',
    yearsOfExperience: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [experienceWarning, setExperienceWarning] = useState<{
    show: boolean;
    required: number;
    candidate: number;
    message: string;
  } | null>(null);
  
  // Create a ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    } else if (!/^[a-zA-Z\s\-'\.]+$/.test(formData.name.trim())) {
      errors.name = 'Name can only contain letters, spaces, hyphens, apostrophes, and periods';
    } else if (formData.name.trim().split(' ').length < 2) {
      errors.name = 'Please enter your full name (first and last name)';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Invalid email format';
      } else {
        // Check for fake email patterns
        const fakeEmailPatterns = [
          /^test@/i,
          /^fake@/i,
          /^dummy@/i,
          /^example@/i,
          /^sample@/i,
          /@test\./i,
          /@fake\./i,
          /@dummy\./i,
          /@example\./i,
          /@sample\./i,
          /123@/,
          /abc@/i,
          /xyz@/i,
          /@123\./,
          /@abc\./i,
          /@xyz\./i
        ];
        
        if (fakeEmailPatterns.some(pattern => pattern.test(formData.email))) {
          errors.email = 'Please enter a valid business email address';
        }
        
        // Check for common disposable email domains
        const disposableDomains = [
          '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
          'yopmail.com', 'temp-mail.org', 'throwaway.email', 'getnada.com'
        ];
        
        const emailDomain = formData.email.split('@')[1]?.toLowerCase();
        if (disposableDomains.includes(emailDomain)) {
          errors.email = 'Please use a permanent email address, not a temporary one';
        }
      }
    }
    
    // Phone validation
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      // Remove all non-digit characters for validation
      const phoneDigits = formData.phone.replace(/\D/g, '');
      
      // Check for fake phone patterns
      const fakePhonePatterns = [
        /^12345+$/,           // 12345, 123456, etc.
        /^00000+$/,           // 00000, 000000, etc.
        /^11111+$/,           // 11111, 111111, etc.
        /^22222+$/,           // 22222, 222222, etc.
        /^33333+$/,           // 33333, 333333, etc.
        /^44444+$/,           // 44444, 444444, etc.
        /^55555+$/,           // 55555, 555555, etc.
        /^66666+$/,           // 66666, 666666, etc.
        /^77777+$/,           // 77777, 777777, etc.
        /^88888+$/,           // 88888, 888888, etc.
        /^99999+$/,           // 99999, 999999, etc.
        /^1234567890$/,       // 1234567890
        /^0987654321$/,       // 0987654321
        /^0123456789$/        // 0123456789
      ];
      
      if (fakePhonePatterns.some(pattern => pattern.test(phoneDigits))) {
        errors.phone = 'Please enter a valid phone number';
      } else if (phoneDigits.length < 7) {
        errors.phone = 'Phone number must be at least 7 digits long';
      } else if (phoneDigits.length > 15) {
        errors.phone = 'Phone number cannot be longer than 15 digits';
      } else if (!/^[+]?[\d\s\-\(\)]+$/.test(formData.phone)) {
        errors.phone = 'Phone number can only contain digits, spaces, hyphens, parentheses, and + sign';
      }
    }
    
    // Expected salary validation
    if (!formData.expectedSalary.trim()) {
      errors.expectedSalary = 'Expected salary is required';
    } else {
      const salary = parseFloat(formData.expectedSalary);
      if (isNaN(salary) || salary <= 0) {
        errors.expectedSalary = 'Expected salary must be a positive number';
      }
    }
    
    // Years of experience validation
    if (!formData.yearsOfExperience.trim()) {
      errors.yearsOfExperience = 'Years of experience is required';
    } else {
      const experience = parseFloat(formData.yearsOfExperience);
      if (isNaN(experience) || experience < 0) {
        errors.yearsOfExperience = 'Years of experience must be a non-negative number';
      }
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
    
    // Check experience requirements when years of experience changes
    if (field === 'yearsOfExperience' && jobData?.years_of_experience) {
      checkExperienceRequirements(value);
    }
  };

  const checkExperienceRequirements = (experienceValue: string) => {
    if (!jobData?.years_of_experience || !experienceValue) return;
    
    const candidateExperience = parseFloat(experienceValue);
    if (isNaN(candidateExperience)) return;
    
    // Extract required experience from job data
    let requiredExperience = 0;
    if (typeof jobData.years_of_experience === 'number') {
      requiredExperience = jobData.years_of_experience;
    } else if (typeof jobData.years_of_experience === 'string') {
      // Extract number from string like "5 years" or "3-5 years"
      const numbers = jobData.years_of_experience.match(/\d+(?:\.\d+)?/);
      if (numbers) {
        requiredExperience = parseFloat(numbers[0]);
      }
    }
    
    if (candidateExperience < requiredExperience) {
      setExperienceWarning({
        show: true,
        required: requiredExperience,
        candidate: candidateExperience,
        message: `This job requires ${requiredExperience} years of experience, but you have ${candidateExperience} years.`
      });
    } else {
      setExperienceWarning(null);
    }
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
      formData.phone,
      parseFloat(formData.expectedSalary),
      parseFloat(formData.yearsOfExperience),
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
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`pl-10 ${formErrors.phone ? 'border-red-500' : ''}`}
            />
          </div>
          {formErrors.phone && (
            <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>
          )}
        </div>
        
        <div>
          <div className="relative">
            <span className="absolute left-3 top-3 text-neutral-500 font-semibold">AED</span>
            <Input
              type="number"
              placeholder="Expected Salary per month"
              value={formData.expectedSalary}
              onChange={(e) => handleInputChange('expectedSalary', e.target.value)}
              className={`pl-12 ${formErrors.expectedSalary ? 'border-red-500' : ''}`}
              min="0"
              step="0.01"
            />
          </div>
          {formErrors.expectedSalary && (
            <p className="text-sm text-red-600 mt-1">{formErrors.expectedSalary}</p>
          )}
        </div>
        
        <div>
          <div className="relative">
            <span className="absolute left-3 top-3 text-neutral-500 font-semibold">Yrs</span>
            <Input
              type="number"
              placeholder="Years of Experience"
              value={formData.yearsOfExperience}
              onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
              className={`pl-12 ${formErrors.yearsOfExperience ? 'border-red-500' : ''}`}
              min="0"
              step="0.1"
            />
          </div>
          {formErrors.yearsOfExperience && (
            <p className="text-sm text-red-600 mt-1">{formErrors.yearsOfExperience}</p>
          )}
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
      
      {/* Experience Warning Popup */}
      {experienceWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Experience Requirement Notice</h3>
            </div>
            <p className="text-gray-700 mb-6">
              {experienceWarning.message}
            </p>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExperienceWarning(null)}
                className="flex-1"
              >
                Edit Experience
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setExperienceWarning(null);
                  // Continue with application despite warning
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                Apply Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
      
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