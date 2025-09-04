'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, CheckCircle, AlertCircle, Zap, Brain, Database, Target, Clock, Users } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { ProgressBar, LoadingSpinner } from '@/components/ui/loading';
import FileDrop from './FileDrop';
import { formatBytes } from '@/lib/utils';

export default function UploadPanel() {
  const {
    uploadCVs,
    uploadJD,
    loadingStates,
    cvs,
    jds,
    loadCVs,
    loadJDs,
  } = useAppStore();

  const [selectedCVs, setSelectedCVs] = useState<File[]>([]);
  const [selectedJD, setSelectedJD] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [processingStage, setProcessingStage] = useState<string>('');

  const isUploading = loadingStates.upload.isLoading;
  const uploadError = loadingStates.upload.error;

  // Load existing documents for stats
  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);

  const handleCVFilesSelected = (files: File[]) => {
    setSelectedCVs(prev => [...prev, ...files]);
  };

  const handleJDFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedJD(files[0]);
    }
  };

  const removeCVFile = (index: number) => {
    setSelectedCVs(prev => prev.filter((_, i) => i !== index));
  };

  const removeJDFile = () => {
    setSelectedJD(null);
  };

  const simulateProgress = (filename: string, duration: number = 3000) => {
    setUploadProgress(prev => ({ ...prev, [filename]: 0 }));
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[filename] || 0;
        if (current >= 100) {
          clearInterval(interval);
          return prev;
        }
        return { ...prev, [filename]: Math.min(current + Math.random() * 15, 100) };
      });
    }, 100);
  };

  const handleUploadCVs = async () => {
    if (selectedCVs.length > 0) {
      setProcessingStage('Parsing documents...');
      
      // Simulate progress for each file
      selectedCVs.forEach(file => simulateProgress(file.name));
      
      try {
        await uploadCVs(selectedCVs);
        setProcessingStage('Extraction complete!');
        setSelectedCVs([]);
        setUploadProgress({});
        
        // Refresh CV list
        setTimeout(() => {
          loadCVs();
          setProcessingStage('');
        }, 1000);
      } catch (error) {
        setProcessingStage('');
        setUploadProgress({});
      }
    }
  };

  const handleUploadJD = async () => {
    if (selectedJD) {
      setProcessingStage('Analyzing job requirements...');
      simulateProgress(selectedJD.name);
      
      try {
        await uploadJD(selectedJD);
        setProcessingStage('Analysis complete!');
        setSelectedJD(null);
        setUploadProgress({});
        
        // Refresh JD list
        setTimeout(() => {
          loadJDs();
          setProcessingStage('');
        }, 1000);
      } catch (error) {
        setProcessingStage('');
        setUploadProgress({});
      }
    }
  };

  const clearAll = () => {
    setSelectedCVs([]);
    setSelectedJD(null);
  };

  return (
    <div className="space-y-8">
      {/* Performance Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Total CVs</p>
              <p className="text-2xl font-bold text-neutral-900">{cvs.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent-100 rounded-lg">
              <Target className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Job Descriptions</p>
              <p className="text-2xl font-bold text-neutral-900">{jds.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success-100 rounded-lg">
              <Clock className="w-6 h-6 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Processing</p>
              <p className="text-2xl font-bold text-neutral-900">
                {selectedCVs.length + (selectedJD ? 1 : 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-warning-100 rounded-lg">
              <Database className="w-6 h-6 text-warning-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Ready to Match</p>
              <p className="text-2xl font-bold text-neutral-900">
                {cvs.length > 0 && jds.length > 0 ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Processing Status */}
      {(isUploading || processingStage) && (
        <Card className="border-primary-200 bg-primary-50/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <LoadingSpinner size="lg" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary-900 mb-2">
                  {processingStage || 'Processing files...'}
                </h3>
                <div className="space-y-3">
                  {Object.entries(uploadProgress).map(([filename, progress]) => (
                    <div key={filename} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-neutral-700">{filename}</span>
                        <span className="text-neutral-500">{Math.round(progress)}%</span>
                      </div>
                      <ProgressBar value={progress} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* JD Upload */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-accent-100 rounded-lg">
                  <Target className="h-5 w-5 text-accent-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Job Description</h3>
                  <p className="text-sm text-neutral-500 font-normal">Define your requirements</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileDrop
                onFilesAccepted={handleJDFileSelected}
                title="Upload Job Description"
                description="Upload a single job description file"
                multiple={false}
                maxFiles={1}
              />

              {/* Selected JD Preview */}
              {selectedJD && (
                <Card className="border-accent-200 bg-accent-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-100 rounded-lg">
                          <FileText className="h-6 w-6 text-accent-600" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{selectedJD.name}</p>
                          <p className="text-sm text-neutral-500">
                            {formatBytes(selectedJD.size)} • {selectedJD.type.split('/').pop()?.toUpperCase()}
                          </p>
                          <p className="text-xs text-accent-600 font-medium mt-1">
                            Ready for AI analysis
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeJDFile}
                        disabled={isUploading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* JD Upload Button */}
              <Button
                onClick={handleUploadJD}
                disabled={!selectedJD || isUploading}
                variant="primary"
                size="lg"
                className="w-full"
                loading={isUploading && !!selectedJD}
              >
                <Brain className="h-5 w-5 mr-2" />
                Analyze Job Requirements
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* CV Upload */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Users className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Candidate CVs</h3>
                  <p className="text-sm text-neutral-500 font-normal">Upload resumes for analysis</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileDrop
                onFilesAccepted={handleCVFilesSelected}
                title="Upload CVs/Resumes"
                description="Upload multiple CV files for processing"
                multiple={true}
                maxFiles={10}
              />

              {/* Selected CVs Preview */}
              {selectedCVs.length > 0 && (
                <Card className="border-primary-200 bg-primary-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-neutral-900">
                        Selected Files ({selectedCVs.length})
                      </h4>
                      <Badge variant="secondary" className="bg-primary-100 text-primary-700">
                        {formatBytes(selectedCVs.reduce((acc, file) => acc + file.size, 0))} total
                      </Badge>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedCVs.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-primary-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-100 rounded-lg">
                              <FileText className="h-5 w-5 text-primary-600" />
                            </div>
                            <div>
                              <p className="font-medium text-neutral-900">{file.name}</p>
                              <p className="text-sm text-neutral-500">
                                {formatBytes(file.size)} • {file.type.split('/').pop()?.toUpperCase()}
                              </p>
                              <p className="text-xs text-primary-600 font-medium mt-1">
                                Ready for processing
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCVFile(index)}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CV Upload Button */}
              <Button
                onClick={handleUploadCVs}
                disabled={selectedCVs.length === 0 || isUploading}
                variant="primary"
                size="lg"
                className="w-full"
                loading={isUploading && selectedCVs.length > 0}
              >
                <Zap className="h-5 w-5 mr-2" />
                Process {selectedCVs.length} CV{selectedCVs.length !== 1 ? 's' : ''}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions & Status */}
      <Card className="border-neutral-200 bg-gradient-to-r from-neutral-50 to-primary-50/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {!isUploading && !processingStage && (selectedCVs.length > 0 || selectedJD) && (
                <div className="flex items-center gap-2 text-success-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Files ready for processing</span>
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 text-error-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{uploadError}</span>
                </div>
              )}

              {!isUploading && !processingStage && selectedCVs.length === 0 && !selectedJD && (
                <div className="flex items-center gap-2 text-neutral-500">
                  <Upload className="h-5 w-5" />
                  <span>Select files to get started</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={clearAll}
                disabled={isUploading || (selectedCVs.length === 0 && !selectedJD)}
                size="md"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>

              {cvs.length > 0 && jds.length > 0 && (
                <Badge variant="default" className="bg-success-600 text-white px-3 py-1">
                  Ready to Match
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
