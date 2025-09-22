'use client';
import React, { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Loader,
  Play,
  Eye,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useUploadQueue } from '@/stores/uploadQueue';
import { api } from '@/lib/api';
/**
 * UploadPageNew
 * - Uses a persisted Zustand queue (useUploadQueue) so items don't "disappear" on navigation.
 * - Processes JD files first, then CV files.
 * - After successful uploads, refreshes DB lists and enables "Start Matching".
 */
export default function UploadPageNew() {
  const {
    loadingStates,
    setCurrentTab,
    loadCVs,
    loadJDs,
    cvs,
    jds,
    selectedCVs,
    selectedJD,
    selectAllCVs,
    selectJD,
    selectCV,
    runMatch,
    deselectAllCVs,
  } = useAppStore();
  const { items, addMany, update, remove, clearAll } = useUploadQueue();
  const isUploading = loadingStates.upload.isLoading;
  // Split queue by kind
  const cvItems = useMemo(() => items.filter((i) => i.kind === 'cv'), [items]);
  const jdItems = useMemo(() => items.filter((i) => i.kind === 'jd'), [items]);
  // Counts
  const totalFiles = items.length;
  const completedCVs = cvItems.filter((f) => f.status === 'completed').length;
  const completedJDs = jdItems.filter((f) => f.status === 'completed').length;
  const completedFiles = completedCVs + completedJDs;
  // DB availability vs local completion (to enable next step)
  const hasDBData = (cvs?.length ?? 0) > 0 && (jds?.length ?? 0) > 0;
  const hasLocalCompletedBoth = completedCVs > 0 && completedJDs > 0;
  const canContinue = hasDBData || hasLocalCompletedBoth;
  
  /* --------------------------------- Duplicates Detection --------------------------------- */
  const hasDuplicates = useMemo(() => {
    const fileMap = new Map<string, boolean>();
    
    for (const item of items) {
      const key = `${item.kind}-${item.name}`;
      if (fileMap.has(key)) {
        return true;
      }
      fileMap.set(key, true);
    }
    return false;
  }, [items]);
  
  const removeDuplicates = useCallback(() => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    
    // First pass: identify duplicates
    for (const item of items) {
      const key = `${item.kind}-${item.name}`;
      if (seen.has(key)) {
        duplicates.push(item.id);
      } else {
        seen.set(key, item.id);
      }
    }
    
    // Remove duplicates
    if (duplicates.length > 0) {
      if (confirm(`Remove ${duplicates.length} duplicate file(s)?`)) {
        duplicates.forEach(id => remove(id));
      }
    }
  }, [items, remove]);
  
  /* --------------------------------- Dropzones --------------------------------- */
  const onCVDrop = useCallback((accepted: File[]) => addMany('cv', accepted), [addMany]);
  const onJDDrop = useCallback((accepted: File[]) => addMany('jd', accepted), [addMany]);
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
    maxFiles: 200,
    maxSize: 10 * 1024 * 1024,
  });
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
    maxSize: 10 * 1024 * 1024,
  });
  /* ----------------------------- Processing uploads ----------------------------- */
  const processFiles = async () => {
    // Process JD files first
    for (const f of jdItems.filter((x) => x.status === 'pending' && !!x.file)) {
      update(f.id, { status: 'processing', error: undefined });
      try {
        console.log(`Uploading JD: ${f.file?.name}`);
        const response = await api.uploadJD(f.file as File);
        console.log('JD upload response:', response);
        
        // Extract the ID from the response - handle different response formats
        let dbId: string | undefined = undefined;
        if (response && response.jd_id) {
          dbId = response.jd_id;
        } else if (response && response.cv_id) {
          dbId = response.cv_id;
        }
        
        console.log(`Extracted JD dbId: ${dbId}`);
        
        update(f.id, {
          status: 'completed',
          extractedData: {
            jobTitle: 'JD Processed',
            years: 'Requirements extracted',
            skills: ['JD uploaded'],
            responsibilities: ['Data available in database'],
          },
          dbId: dbId, // Store the database ID
        });
      } catch (err: any) {
        console.error('JD upload error:', err);
        update(f.id, {
          status: 'error',
          error: err?.message || 'Processing failed',
        });
      }
    }
    // Then CV files
    for (const f of cvItems.filter((x) => x.status === 'pending' && !!x.file)) {
      update(f.id, { status: 'processing', error: undefined });
      try {
        console.log(`Uploading CV: ${f.file?.name}`);
        const response = await api.uploadCV(f.file as File);
        console.log('CV upload response:', response);
        
        // Extract the ID from the response - handle different response formats
        let dbId: string | undefined = undefined;
        if (response && response.cv_id) {
          dbId = response.cv_id;
        } else if (response && response.jd_id) {
          dbId = response.jd_id;
        }
        
        console.log(`Extracted CV dbId: ${dbId}`);
        
        update(f.id, {
          status: 'completed',
          extractedData: {
            name: 'CV Processed',
            jobTitle: 'Data extracted successfully',
            years: 'Processing complete',
            skills: ['CV uploaded'],
            responsibilities: ['Data available in database'],
          },
          dbId: dbId, // Store the database ID
        });
      } catch (err: any) {
        console.error('CV upload error:', err);
        update(f.id, {
          status: 'error',
          error: err?.message || 'Processing failed',
        });
      }
    }
    // Refresh DB lists
    await loadCVs();
    await loadJDs();
  };
  /* ----------------------- Match Only Uploaded Files ----------------------- */
  const handleMatchUploadedOnly = async () => {
    console.log("=== handleMatchUploadedOnly called ===");
    
    // Get completed items with database IDs
    const completedJDs = jdItems.filter(f => f.status === 'completed' && f.dbId);
    const completedCVs = cvItems.filter(f => f.status === 'completed' && f.dbId);
    console.log("Completed JDs with dbId:", completedJDs);
    console.log("Completed CVs with dbId:", completedCVs);
    // Fallback: if no items have dbId, try to match by filename
    if (completedJDs.length === 0 && completedCVs.length === 0) {
      console.log("No items with dbId, trying filename fallback");
      
      const completedJDsNoId = jdItems.filter(f => f.status === 'completed');
      const completedCVsNoId = cvItems.filter(f => f.status === 'completed');
      
      if (completedJDsNoId.length === 0) {
        alert('No completed Job Descriptions to match');
        return;
      }
      if (completedCVsNoId.length === 0) {
        alert('No completed CVs to match');
        return;
      }
      // Try to find matching documents in the database by filename
      const jdFilename = completedJDsNoId[0].name;
      const cvFilenames = completedCVsNoId.map(f => f.name);
      console.log("Looking for JD by filename:", jdFilename);
      console.log("Looking for CVs by filenames:", cvFilenames);
      // Find JD in database by filename
      const jdInDB = jds.find(jd => jd.filename === jdFilename);
      if (!jdInDB) {
        alert(`Could not find Job Description "${jdFilename}" in the database`);
        return;
      }
      console.log("Found JD in DB:", jdInDB);
      // Find CVs in database by filename
      const cvIdsInDB: string[] = [];
      for (const cvFilename of cvFilenames) {
        const cvInDB = cvs.find(cv => cv.filename === cvFilename);
        if (cvInDB) {
          cvIdsInDB.push(cvInDB.id);
          console.log(`Found CV in DB: ${cvFilename} -> ${cvInDB.id}`);
        }
      }
      if (cvIdsInDB.length === 0) {
        alert('Could not find any uploaded CVs in the database');
        return;
      }
      // Set selections in the store
      selectJD(jdInDB.id);
      deselectAllCVs(); // Clear existing selections
      cvIdsInDB.forEach(id => selectCV(id)); // Select only uploaded CVs
      console.log("Selected JD ID:", jdInDB.id);
      console.log("Selected CV IDs:", cvIdsInDB);
      // Run matching and navigate to results
      await runMatch();
      setCurrentTab('match');
      return;
    }
    // Original logic for when we have dbIds
    if (completedJDs.length === 0) {
      alert('No completed Job Descriptions to match');
      return;
    }
    if (completedCVs.length === 0) {
      alert('No completed CVs to match');
      return;
    }
    // Use the first completed JD
    const jdId = completedJDs[0].dbId;
    const cvIds = completedCVs.map(f => f.dbId).filter(Boolean) as string[];
    console.log("Selected JD ID:", jdId);
    console.log("Selected CV IDs:", cvIds);
    // Set selections in the store
    selectJD(jdId || null);
    deselectAllCVs(); // Clear existing selections
    cvIds.forEach(id => selectCV(id)); // Select only uploaded CVs
    // Run matching and navigate to results
    await runMatch();
    setCurrentTab('match');
  };
  /* ---------------------------------- UI utils ---------------------------------- */
  const removeFile = (id: string) => {
    console.log(`Removing file with ID: ${id} from queue`);
    remove(id);
  };
  
  const sizeMB = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0.0';
    return (bytes / 1024 / 1024).toFixed(1);
  };
  
  const anyProcessing = items.some((f) => f.status === 'processing');
  
  // Helper to get status text for files
  const getStatusText = (file: any) => {
    if (file.status === 'completed') {
      return file.extractedData ? 
        `${file.extractedData.name || file.extractedData.jobTitle || 'Processed'} • ${file.extractedData.years || ''}` : 
        'Processed';
    }
    if (file.status === 'error') {
      return `Error: ${file.error || 'Processing failed'}`;
    }
    if (file.status === 'processing') {
      return file.kind === 'cv' ? 'Extracting candidate info...' : 'Extracting requirements...';
    }
    return 'Not extracted';
  };
  
  // Helper to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--green-600)';
      case 'error': return 'var(--red-600)';
      case 'processing': return 'var(--yellow-600)';
      default: return 'var(--gray-600)';
    }
  };
  
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
                <p className="mt-1">Max 200 files, 10MB each</p>
              </div>
              <button className="btn-secondary">Browse Files</button>
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
              <button className="btn-secondary">Browse Files</button>
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
                disabled={isUploading}
                className="btn-primary"
              >
                {isUploading ? (
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
              
              {hasDuplicates && (
                <button
                  onClick={removeDuplicates}
                  disabled={isUploading || anyProcessing}
                  className="btn-outline"
                  title="Remove duplicate files"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Duplicates
                </button>
              )}
              
              <button onClick={clearAll} disabled={isUploading || anyProcessing} className="btn-outline">
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
          
          {/* Duplicate warning */}
          {hasDuplicates && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Duplicate files detected</p>
                <p className="text-sm text-yellow-700">
                  You have uploaded the same file multiple times. Use "Remove Duplicates" to keep only the first occurrence of each file.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {/* JD Files */}
            {jdItems.map((file) => (
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
                      {file.name}
                    </div>
                    <div className="text-xs" style={{ color: getStatusColor(file.status) }}>
                      {getStatusText(file)}
                      {file.dbId && <span className="ml-2 text-green-600">(ID: {file.dbId?.substring(0, 8)}...)</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {sizeMB(file.size)}MB
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
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
            {cvItems.map((file) => (
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
                      {file.name}
                    </div>
                    <div className="text-xs" style={{ color: getStatusColor(file.status) }}>
                      {getStatusText(file)}
                      {file.dbId && <span className="ml-2 text-green-600">(ID: {file.dbId?.substring(0, 8)}...)</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs" style={{ color: 'var(--gray-500)' }}>
                    {sizeMB(file.size)}MB
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
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
      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="card-simple bg-yellow-50 border-yellow-200">
          <h4 className="font-medium text-yellow-800">Debug Info:</h4>
          <p className="text-sm text-yellow-700">
            Queue items: {items.length} (JDs: {jdItems.length}, CVs: {cvItems.length})
          </p>
          <p className="text-sm text-yellow-700">
            Completed JDs with dbId: {jdItems.filter(f => f.status === 'completed' && f.dbId).length}
          </p>
          <p className="text-sm text-yellow-700">
            Completed CVs with dbId: {cvItems.filter(f => f.status === 'completed' && f.dbId).length}
          </p>
          <p className="text-sm text-yellow-700">
            Has duplicates: {hasDuplicates ? 'Yes' : 'No'}
          </p>
          <details className="mt-2">
            <summary className="text-sm font-medium text-yellow-800 cursor-pointer">Queue Details</summary>
            <pre className="text-xs mt-1 p-2 bg-yellow-100 rounded overflow-auto max-h-40">
              {JSON.stringify(items, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {/* Next Steps */}
      {canContinue && (
        <div className="card-simple">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--green-500)' }} />
              <div>
                <h4 className="font-medium" style={{ color: 'var(--gray-900)' }}>
                  Documents ready!
                </h4>
                <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                  {hasDBData
                    ? `Database has ${cvs.length} CV(s) and ${jds.length} JD(s).`
                    : `${completedFiles} file(s) uploaded and processed`}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setCurrentTab('database')} 
                className="btn-secondary w-full sm:w-auto"
              >
                <Eye className="w-4 h-4" />
                Review Database
              </button>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={handleMatchUploadedOnly}
                  className="btn-primary w-full sm:w-auto"
                  disabled={loadingStates.matching?.isLoading || !(jdItems.some(f => f.status === 'completed') || cvItems.some(f => f.status === 'completed'))}
                  title="Match only the files uploaded in this session"
                >
                  <Play className="w-4 h-4" />
                  {loadingStates.matching?.isLoading ? 'Matching...' : 'Match Uploaded Files'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/**
 * NOTE:
 * This component expects a persisted upload-queue store at:
 *   `@/stores/uploadQueue`
 * with the API:
 *   - items: { id, name, size?, status: 'pending'|'processing'|'completed'|'error', error?, extractedData?, file?, kind: 'cv'|'jd', dbId? }[]
 *   - addMany(kind: 'cv'|'jd', files: File[]): void
 *   - update(id: string, patch: Partial<Item>): void
 *   - remove(id: string): void
 *   - clearAll(): void
 * See the store implementation I outlined earlier for a drop-in version.
 */