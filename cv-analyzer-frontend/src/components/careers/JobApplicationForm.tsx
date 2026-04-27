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
  Send,
  X,
  Briefcase,
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="rounded-xl border-red-100 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Personal Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 tracking-tight">Personal Details</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`pl-11 h-12 rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white transition-all ${formErrors.name ? 'border-red-300 ring-red-50' : 'focus:ring-blue-100'}`}
                />
              </div>
              {formErrors.name && (
                <p className="text-[11px] font-medium text-red-500 mt-1 ml-1">{formErrors.name}</p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  type="email"
                  placeholder="john@company.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`pl-11 h-12 rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white transition-all ${formErrors.email ? 'border-red-300 ring-red-50' : 'focus:ring-blue-100'}`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] font-medium text-red-500 mt-1 ml-1">{formErrors.email}</p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
              <div className="relative group">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  type="tel"
                  placeholder="+971 50 123 4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`pl-11 h-12 rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white transition-all ${formErrors.phone ? 'border-red-300 ring-red-50' : 'focus:ring-blue-100'}`}
                />
              </div>
              {formErrors.phone && (
                <p className="text-[11px] font-medium text-red-500 mt-1 ml-1">{formErrors.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Professional Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 tracking-tight">Professional Info</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Expected Monthly Salary (AED)</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-gray-400 group-focus-within:text-purple-500 transition-colors">AED</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 15000"
                  value={formData.expectedSalary}
                  onChange={(e) => handleInputChange('expectedSalary', e.target.value)}
                  className={`pl-14 h-12 rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white transition-all ${formErrors.expectedSalary ? 'border-red-300 ring-red-50' : 'focus:ring-purple-100'}`}
                />
              </div>
              {formErrors.expectedSalary && (
                <p className="text-[11px] font-medium text-red-500 mt-1 ml-1">{formErrors.expectedSalary}</p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Years of Experience</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-gray-400 group-focus-within:text-purple-500 transition-colors">YRS</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 5"
                  value={formData.yearsOfExperience}
                  onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
                  className={`pl-14 h-12 rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white transition-all ${formErrors.yearsOfExperience ? 'border-red-300 ring-red-50' : 'focus:ring-purple-100'}`}
                />
              </div>
              {formErrors.yearsOfExperience && (
                <p className="text-[11px] font-medium text-red-500 mt-1 ml-1">{formErrors.yearsOfExperience}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* CV Upload - Full Width */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <Upload className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900 tracking-tight">Upload CV / Resume</h3>
        </div>
        
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 group ${
            dragActive
              ? 'border-blue-400 bg-blue-50/50'
              : selectedFile
              ? 'border-green-400 bg-green-50/30'
              : formErrors.file
              ? 'border-red-400 bg-red-50/30'
              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'
          }`}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="flex items-center justify-center gap-6">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center shadow-inner">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">{selectedFile.name}</p>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-2 text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove file
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Drop your resume here</p>
                <p className="text-xs font-medium text-gray-500 mt-1">
                  Drag and drop or <span className="text-blue-600 hover:underline cursor-pointer" onClick={handleFileInputClick}>browse files</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">
                  PDF, DOCX, or TXT (MAX 10MB)
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
                className="h-10 px-6 rounded-xl border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-white hover:border-gray-300 transition-all shadow-sm"
                onClick={handleFileInputClick}
              >
                Choose File
              </Button>
            </div>
          )}
        </div>
        
        {formErrors.file && (
          <p className="text-[11px] font-medium text-red-500 ml-1">{formErrors.file}</p>
        )}
      </div>

      {/* Experience Warning Popup - Enhanced */}
      {experienceWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-amber-100 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Requirement Match</h3>
            <p className="text-gray-600 leading-relaxed mb-8">
              This role typically requires <span className="font-bold text-gray-900">{experienceWarning.required} years</span>. 
              You've listed <span className="font-bold text-gray-900">{experienceWarning.candidate} years</span>. 
              Would you like to proceed or update your experience?
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExperienceWarning(null)}
                className="flex-1 h-12 rounded-xl border-gray-200 font-bold"
              >
                Edit Info
              </Button>
              <Button
                type="button"
                onClick={() => setExperienceWarning(null)}
                className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-900/10"
              >
                Proceed
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Submit Buttons */}
      <div className="flex items-center gap-4 pt-6 border-t border-gray-100">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="px-8 h-12 rounded-xl font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmittingApplication}
          className="flex-1 bg-gradient-primary text-white h-12 rounded-xl font-bold shadow-xl shadow-blue-900/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isSubmittingApplication ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Submitting...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Send className="w-4 h-4 text-white" />
              <span>Submit Application</span>
            </div>
          )}
        </Button>
      </div>
    </form>
  );
}