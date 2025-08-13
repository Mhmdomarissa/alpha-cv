'use client';

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudArrowUpIcon, 
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Button } from './ui/Button';
import { Progress } from './ui/Progress';
import { Badge } from './ui/Badge';
import { formatFileSize } from '@/lib/utils';
import { config } from '@/lib/config';
import { useLoadingState } from '@/hooks/useLoadingState';
import toast from 'react-hot-toast';

interface FileWithPreview extends File {
  preview?: string;
  id?: string;
  progress?: number;
  status?: 'uploading' | 'success' | 'error' | 'validating' | 'retry';
  error?: string;
  retryCount?: number;
  uploadStartTime?: Date;
}

interface ValidationRule {
  validate: (file: File) => boolean | Promise<boolean>;
  message: string;
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileRemove?: (fileId: string) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  title?: string;
  description?: string;
  uploadProgress?: Record<string, number>;
  uploadStatus?: Record<string, 'uploading' | 'success' | 'error'>;
  className?: string;
  validateFiles?: boolean;
  customValidation?: ValidationRule[];
}

const FileUpload = ({
  onFilesSelected,
  onFileRemove,
  accept = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'text/plain': ['.txt'],
    'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  },
  maxFiles = config.upload.maxFiles,
  maxSize = config.upload.maxFileSize,
  multiple = true,
  title = 'Upload Documents',
  description = 'Drag and drop your files here, or click to browse',
  uploadProgress = {},
  uploadStatus = {},
  className = '',
  validateFiles = true,
  customValidation = [],
}: FileUploadProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);



  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Handle rejected files
    rejectedFiles.forEach((rejection) => {
      const { file, errors } = rejection;
      errors.forEach((error) => {
        if (error.code === 'file-too-large') {
          toast.error(`File ${file.name} is too large. Maximum size is ${formatFileSize(maxSize)}`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`File ${file.name} is not a supported format`);
        } else if (error.code === 'too-many-files') {
          toast.error(`Too many files. Maximum allowed is ${maxFiles}`);
        } else {
          toast.error(`Error with file ${file.name}: ${error.message}`);
        }
      });
    });

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const newFiles = acceptedFiles.map((file) => {
        // Preserve the original File object by adding properties directly to it
        // instead of spreading it into a new object
        const enhancedFile = file as File & { id?: string; preview?: string };
        enhancedFile.id = Math.random().toString(36).substring(2);
        enhancedFile.preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        return enhancedFile;
      });
      setFiles((prev) => [...prev, ...newFiles]);
      onFilesSelected(newFiles);
      toast.success(`${acceptedFiles.length} file(s) added successfully`);
    }
  }, [maxFiles, maxSize, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles: multiple ? maxFiles : 1,
    maxSize,
    multiple,
  });

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
    onFileRemove?.(fileId);
    toast.success('File removed');
  };

  const getFileIcon = (file: File) => {
    const fileType = file.type || '';
    const fileName = file.name || '';
    
    if (fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document') || fileName.toLowerCase().includes('.doc')) return '📝';
    if (fileType.includes('text') || fileName.toLowerCase().endsWith('.txt')) return '📄';
    if (fileType.includes('image') || fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/)) return '🖼️';
    return '📁';
  };

  const getStatusIcon = (fileId: string) => {
    const status = uploadStatus[fileId];
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-success-600" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-error-600" />;
      case 'uploading':
        return (
          <div className="h-5 w-5">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">{title}</h3>
        <p className="text-sm text-secondary-600">{description}</p>
      </div>

      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
          ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-secondary-300 hover:border-primary-400 hover:bg-secondary-50'}
          ${isDragReject ? 'border-error-500 bg-error-50' : ''}
        `}
      >
        <input 
          {...getInputProps()} 
          id="file-upload-input"
          name="fileUpload"
          aria-label={`Upload ${accept ? Object.keys(accept).join(', ') : 'files'}`}
        />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
          
          {isDragActive ? (
            <p className="text-lg font-medium text-primary-600">
              {isDragReject ? 'Some files are not supported' : 'Drop files here...'}
            </p>
          ) : (
            <div>
              <p className="text-lg font-medium text-secondary-900 mb-2">
                Drag and drop files here
              </p>
              <p className="text-sm text-secondary-600 mb-4">
                or <span className="text-primary-600 font-medium">browse files</span>
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" size="sm">PDF</Badge>
                <Badge variant="outline" size="sm">DOCX</Badge>
                <Badge variant="outline" size="sm">TXT</Badge>
                <Badge variant="outline" size="sm">Images</Badge>
              </div>
              <p className="text-xs text-secondary-500">
                Max {maxFiles} files, up to {formatFileSize(maxSize)} each
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6"
          >
            <h4 className="text-sm font-medium text-secondary-900 mb-3">
              Uploaded Files ({files.length})
            </h4>
            <div className="space-y-3">
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-3 bg-white border border-secondary-200 rounded-lg hover:shadow-soft transition-shadow"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-2xl">{getFileIcon(file)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {file.name || 'Unknown file'}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {file.size ? formatFileSize(file.size) : 'Unknown size'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {uploadProgress[file.id!] !== undefined && (
                      <div className="w-24">
                        <Progress
                          value={uploadProgress[file.id!]}
                          size="sm"
                          variant={uploadStatus[file.id!] === 'error' ? 'error' : 'default'}
                        />
                      </div>
                    )}
                    
                    {getStatusIcon(file.id!)}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id!)}
                      className="h-8 w-8 text-secondary-400 hover:text-error-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;