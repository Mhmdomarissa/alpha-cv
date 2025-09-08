'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface FileDropProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  title: string;
  description: string;
  className?: string;
  multiple?: boolean;
}

export default function FileDrop({
  onFilesAccepted,
  accept = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'text/plain': ['.txt'],
    'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'],
  },
  maxFiles = 200,
  maxSize = 10 * 1024 * 1024, // 10MB
  title,
  description,
  className,
  multiple = true,
}: FileDropProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept,
    maxFiles: multiple ? maxFiles : 1,
    maxSize,
    multiple,
  });

  const hasRejectedFiles = fileRejections.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      <Card
        {...getRootProps()}
        className={cn(
          'cursor-pointer transition-colors border-2 border-dashed',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <input {...getInputProps()} />
          
          <div className="mb-4">
            {isDragReject ? (
              <AlertCircle className="h-12 w-12 text-destructive" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{description}</p>

          {isDragActive ? (
            <p className="text-sm font-medium text-primary">
              {isDragReject ? 'Some files are not supported' : 'Drop files here...'}
            </p>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Drag & drop files here, or click to browse</p>
              <p className="mt-1">
                Supports: PDF, DOCX, DOC, TXT, Images
              </p>
              <p className="mt-1">
                Max {multiple ? `${maxFiles} files` : '1 file'}, {Math.round(maxSize / (1024 * 1024))}MB each
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejected Files */}
      {hasRejectedFiles && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                Some files were rejected:
              </span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {fileRejections.map(({ file, errors }) => (
                <li key={file.name} className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  <span>{file.name}</span>
                  <span className="text-destructive">
                    ({errors.map((e: any) => e.message).join(', ')})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
