import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Check, ExternalLink, Copy } from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Button } from '@/components/ui/button-enhanced';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card-enhanced';

interface JobPostingFormProps {
  onSuccess: () => void;
}

export default function JobPostingForm({ onSuccess }: JobPostingFormProps) {
  const { createJobPosting, isCreatingJob, error, clearError } = useCareersStore();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState<{link: string, token: string} | null>(null);
  const [copied, setCopied] = useState(false);
  
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
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedFile) return;
    
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
  };
  
  const handleViewJob = () => {
    if (success?.link) {
      window.open(success.link, '_blank');
    }
  };
  
  const handleCopyLink = async () => {
    if (success?.link) {
      try {
        await navigator.clipboard.writeText(success.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy link:', error);
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
    <div className="space-y-6">
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
            <div className="space-y-2">
              <p>Job posting created successfully!</p>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Public Link:</span>
                <span className="text-sm bg-green-100 px-2 py-1 rounded truncate max-w-xs">
                  {success.link}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCopyLink}
                  className="h-8 px-2 text-green-700 hover:text-green-900"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleViewJob}
                  className="h-8 px-2 text-green-700 hover:text-green-900"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs">
                {copied ? 'Link copied to clipboard!' : 'Click the copy icon to copy the link to clipboard.'}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* File Upload Area */}
      <Card>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="text-green-700 hover:bg-green-200"
                >
                  Remove file
                </Button>
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
                    Drag & drop or click to select a file
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
      
      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || isCreatingJob}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isCreatingJob ? 'Creating...' : 'Create Job Posting'}
        </Button>
      </div>
    </div>
  );
}