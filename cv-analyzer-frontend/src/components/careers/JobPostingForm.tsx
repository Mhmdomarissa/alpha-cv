'use client';

import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Check } from 'lucide-react';
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
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess(`Job posting created successfully! Public link: ${result.public_link}`);
      setSelectedFile(null);
      
      // Auto-copy link to clipboard
      try {
        await navigator.clipboard.writeText(result.public_link);
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
      
      // Close form after delay
      setTimeout(() => {
        onSuccess();
      }, 2000);
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
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* File Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary-400 bg-primary-50'
                : selectedFile
                ? 'border-green-400 bg-green-50'
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
                <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                  <FileText className="w-8 h-8 text-green-600" />
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
                >
                  Remove file
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center">
                  <Upload className="w-8 h-8 text-neutral-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    Upload Job Description
                  </p>
                  <p className="text-neutral-600">
                    Drag & drop or click to select a file
                  </p>
                  <p className="text-sm text-neutral-500 mt-2">
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
                <label htmlFor="file-upload">
                  <Button variant="outline" className="cursor-pointer">
                    Select File
                  </Button>
                </label>
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
          className="bg-primary-600 hover:bg-primary-700"
        >
          {isCreatingJob ? 'Creating...' : 'Create Job Posting'}
        </Button>
      </div>
    </div>
  );
}
