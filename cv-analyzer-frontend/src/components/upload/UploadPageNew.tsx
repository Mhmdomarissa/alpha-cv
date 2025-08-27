'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X,
  Eye,
  Download,
  ArrowRight,
  Loader
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface FilePreview {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: {
    name?: string;
    jobTitle?: string;
    years?: string;
    skills?: string[];
    responsibilities?: string[];
  };
  error?: string;
}

export default function UploadPageNew() {
  const { uploadCVs, uploadJD, loadingStates, setCurrentTab } = useAppStore();
  
  const [cvFiles, setCVFiles] = useState<FilePreview[]>([]);
  const [jdFiles, setJDFiles] = useState<FilePreview[]>([]);
  
  const isProcessing = loadingStates.upload.isLoading;

  // CV Drop Zone
  const onCVDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
    }));
    setCVFiles(prev => [...prev, ...newFiles]);
  }, []);

  const {
    getRootProps: getCVRootProps,
    getInputProps: getCVInputProps,
    isDragActive: isCVDragActive,
    isDragReject: isCVDragReject,
  } = useDropzone({
    onDrop: onCVDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // JD Drop Zone
  const onJDDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
    }));
    setJDFiles(prev => [...prev, ...newFiles]);
  }, []);

  const {
    getRootProps: getJDRootProps,
    getInputProps: getJDInputProps,
    isDragActive: isJDDragActive,
    isDragReject: isJDDragReject,
  } = useDropzone({
    onDrop: onJDDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const processFiles = async () => {
    // Process JD files first
    for (const jdFile of jdFiles.filter(f => f.status === 'pending')) {
      setJDFiles(prev => prev.map(f => 
        f.id === jdFile.id ? { ...f, status: 'processing' } : f
      ));
      
      try {
        await uploadJD(jdFile.file);
        setJDFiles(prev => prev.map(f => 
          f.id === jdFile.id 
            ? { 
                ...f, 
                status: 'completed',
                extractedData: {
                  jobTitle: 'JD Processed',
                  years: 'Requirements extracted',
                  skills: ['JD uploaded'],
                  responsibilities: ['Data available in database'],
                }
              } 
            : f
        ));
      } catch (error) {
        setJDFiles(prev => prev.map(f => 
          f.id === jdFile.id 
            ? { 
                ...f, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Processing failed'
              } 
            : f
        ));
      }
    }

    // Process CV files
    for (const cvFile of cvFiles.filter(f => f.status === 'pending')) {
      setCVFiles(prev => prev.map(f => 
        f.id === cvFile.id ? { ...f, status: 'processing' } : f
      ));
      
      try {
        await uploadCVs([cvFile.file]);
        setCVFiles(prev => prev.map(f => 
          f.id === cvFile.id 
            ? { 
                ...f, 
                status: 'completed',
                extractedData: {
                  name: 'CV Processed',
                  jobTitle: 'Data extracted successfully',
                  years: 'Processing complete',
                  skills: ['CV uploaded'],
                  responsibilities: ['Data available in database'],
                }
              } 
            : f
        ));
      } catch (error) {
        setCVFiles(prev => prev.map(f => 
          f.id === cvFile.id 
            ? { 
                ...f, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Processing failed'
              } 
            : f
        ));
      }
    }
  };

  const removeFile = (id: string, type: 'cv' | 'jd') => {
    if (type === 'cv') {
      setCVFiles(prev => prev.filter(f => f.id !== id));
    } else {
      setJDFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const clearAll = () => {
    setCVFiles([]);
    setJDFiles([]);
  };

  const totalFiles = cvFiles.length + jdFiles.length;
  const completedFiles = cvFiles.filter(f => f.status === 'completed').length + 
                        jdFiles.filter(f => f.status === 'completed').length;
  const canContinue = totalFiles > 0 && completedFiles > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="heading-lg">Upload Files</h1>
        <p className="text-lg mt-2" style={{ color: 'var(--gray-600)' }}>
          Step 1: Upload Your Documents
        </p>
        <p className="text-base mt-1" style={{ color: 'var(--gray-500)' }}>
          Upload CVs and job descriptions to get started with AI-powered matching
        </p>
      </div>

      {/* Upload Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CV Upload Zone */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <Users className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <h3 className="heading-sm">Candidate CVs</h3>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                Upload resumes for processing and matching
              </p>
            </div>
          </div>

          <div
            {...getCVRootProps()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
            style={{
              borderColor: isCVDragReject 
                ? 'var(--red-500)' 
                : isCVDragActive 
                  ? 'var(--primary-500)' 
                  : 'var(--gray-300)',
              backgroundColor: isCVDragReject 
                ? 'var(--red-50)' 
                : isCVDragActive 
                  ? 'var(--primary-50)' 
                  : 'white',
            }}
          >
            <input {...getCVInputProps()} />
            <div className="space-y-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--gray-100)' }}
              >
                <Upload className="w-8 h-8" style={{ color: 'var(--gray-400)' }} />
              </div>
              <div>
                <h4 className="heading-sm">Drop CV files here</h4>
                <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
                  (PDF, DOCX, TXT)
                </p>
              </div>
              <div className="text-xs" style={{ color: 'var(--gray-400)' }}>
                <p>Drag & drop files here, or click to browse</p>
                <p className="mt-1">Max 10 files, 10MB each</p>
              </div>
              <button className="btn-secondary">
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {/* JD Upload Zone */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <FileText className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
            </div>
            <div>
              <h3 className="heading-sm">Job Descriptions</h3>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                Upload job requirements for matching
              </p>
            </div>
          </div>

          <div
            {...getJDRootProps()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
            style={{
              borderColor: isJDDragReject 
                ? 'var(--red-500)' 
                : isJDDragActive 
                  ? 'var(--green-500)' 
                  : 'var(--gray-300)',
              backgroundColor: isJDDragReject 
                ? 'var(--red-50)' 
                : isJDDragActive 
                  ? 'var(--green-50)' 
                  : 'white',
            }}
          >
            <input {...getJDInputProps()} />
            <div className="space-y-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--gray-100)' }}
              >
                <Upload className="w-8 h-8" style={{ color: 'var(--gray-400)' }} />
              </div>
              <div>
                <h4 className="heading-sm">Drop JD files here</h4>
                <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
                  (PDF, DOCX, TXT)
                </p>
              </div>
              <div className="text-xs" style={{ color: 'var(--gray-400)' }}>
                <p>Drag & drop files here, or click to browse</p>
                <p className="mt-1">Max 5 files, 10MB each</p>
              </div>
              <button className="btn-secondary">
                Browse Files
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Queue */}
      {totalFiles > 0 && (
        <div className="card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--yellow-50)' }}
              >
                <Clock className="w-5 h-5" style={{ color: 'var(--yellow-600)' }} />
              </div>
              <div>
                <h3 className="heading-sm">Processing Queue</h3>
                <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                  {completedFiles} of {totalFiles} files processed
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={processFiles}
                disabled={isProcessing || totalFiles === 0}
                className="btn-primary"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Extract All
                  </>
                )}
              </button>
              <button
                onClick={clearAll}
                disabled={isProcessing}
                className="btn-outline"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* JD Files */}
            {jdFiles.map((file) => (
              <div 
                key={file.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: 'var(--gray-50)' }}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {file.status === 'completed' && (
                      <CheckCircle className="w-5 h-5" style={{ color: 'var(--green-500)' }} />
                    )}
                    {file.status === 'processing' && (
                      <Loader className="w-5 h-5 animate-spin" style={{ color: 'var(--yellow-500)' }} />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5" style={{ color: 'var(--red-500)' }} />
                    )}
                    {file.status === 'pending' && (
                      <Clock className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                    )}
                  </div>
                  <FileText className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
                  <div>
                    <div className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>
                      {file.file.name}
                    </div>
                    {file.status === 'completed' && file.extractedData && (
                      <div className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        {file.extractedData.jobTitle} • {file.extractedData.years} experience
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="text-xs" style={{ color: 'var(--red-600)' }}>
                        {file.error}
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <div className="text-xs" style={{ color: 'var(--yellow-600)' }}>
                        Extracting requirements...
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {(file.file.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    onClick={() => removeFile(file.id, 'jd')}
                    disabled={file.status === 'processing'}
                    className="p-1 rounded hover:bg-red-50"
                    style={{ color: 'var(--gray-400)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* CV Files */}
            {cvFiles.map((file) => (
              <div 
                key={file.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: 'var(--gray-50)' }}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {file.status === 'completed' && (
                      <CheckCircle className="w-5 h-5" style={{ color: 'var(--green-500)' }} />
                    )}
                    {file.status === 'processing' && (
                      <Loader className="w-5 h-5 animate-spin" style={{ color: 'var(--yellow-500)' }} />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5" style={{ color: 'var(--red-500)' }} />
                    )}
                    {file.status === 'pending' && (
                      <Clock className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                    )}
                  </div>
                  <Users className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                  <div>
                    <div className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>
                      {file.file.name}
                    </div>
                    {file.status === 'completed' && file.extractedData && (
                      <div className="text-xs" style={{ color: 'var(--gray-600)' }}>
                        {file.extractedData.name} • {file.extractedData.jobTitle} • {file.extractedData.years} years
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="text-xs" style={{ color: 'var(--red-600)' }}>
                        {file.error}
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <div className="text-xs" style={{ color: 'var(--yellow-600)' }}>
                        Extracting candidate info...
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {(file.file.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    onClick={() => removeFile(file.id, 'cv')}
                    disabled={file.status === 'processing'}
                    className="p-1 rounded hover:bg-red-50"
                    style={{ color: 'var(--gray-400)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {canContinue && (
        <div className="card-simple">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--green-500)' }} />
              <div>
                <h4 className="font-medium" style={{ color: 'var(--gray-900)' }}>
                  Documents processed successfully!
                </h4>
                <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                  {completedFiles} files ready for review and matching
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCurrentTab('database')}
                className="btn-secondary"
              >
                <Eye className="w-4 h-4" />
                Review Database
              </button>
              <button
                onClick={() => setCurrentTab('match')}
                className="btn-primary"
              >
                Start Matching
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
