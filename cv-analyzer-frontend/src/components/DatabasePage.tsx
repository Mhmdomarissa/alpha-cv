'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  CalendarIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { formatFileSize, truncateText } from '@/lib/utils';
import { CV, JobDescription } from '@/lib/api';
import toast from 'react-hot-toast';

// Detailed Item Modal Component
const DetailedItemModal = ({ item, onClose }: { item: CV | JobDescription, onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'raw' | 'processed'>('overview');
  
  const isCV = 'full_name' in item; // Check if it's a CV
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="border-0 shadow-none h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between">
          <div>
            <span className="text-lg">{item.filename}</span>
            {isCV && (item as CV).full_name && (
              <span className="text-sm text-secondary-600 ml-2">({(item as CV).full_name})</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-secondary-100"
          >
            ✕
          </Button>
        </CardTitle>
        <CardDescription>
          Uploaded on {formatDate(item.upload_date)} • 
          {item.file_size ? ` ${formatFileSize(item.file_size)}` : ' Unknown size'}
        </CardDescription>
      </CardHeader>
      
      {/* Tab Navigation */}
      <div className="border-b bg-secondary-50">
        <div className="flex space-x-4 px-6 py-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'overview' 
                ? 'bg-primary-500 text-white' 
                : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
            }`}
          >
            Overview
          </button>
          {((isCV && (item as CV).extracted_text) || (!isCV && (item as JobDescription).extracted_text)) && (
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'raw' 
                  ? 'bg-primary-500 text-white' 
                  : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
              }`}
            >
              Raw Extracted Data
            </button>
          )}
          {((isCV && (item as CV).structured_info && Object.keys((item as CV).structured_info).length > 0) || 
            (!isCV && (item as JobDescription).structured_info && Object.keys((item as JobDescription).structured_info).length > 0)) && (
            <button
              onClick={() => setActiveTab('processed')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'processed' 
                  ? 'bg-primary-500 text-white' 
                  : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
              }`}
            >
              GPT Processed Data
            </button>
          )}
        </div>
      </div>

      <CardContent className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {isCV ? (
              // CV Overview
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Personal Information</h3>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {(item as CV).full_name || 'Not provided'}</div>
                    <div><strong>Email:</strong> {(item as CV).email || 'Not provided'}</div>
                    <div><strong>Phone:</strong> {(item as CV).phone || 'Not provided'}</div>
                    <div><strong>Current Position:</strong> {(item as CV).job_title || 'Not specified'}</div>
                    <div><strong>Experience:</strong> {(item as CV).years_of_experience || 'Not specified'}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Professional Details</h3>
                  <div className="space-y-2">
                    <div><strong>Education:</strong> {(item as CV).education || 'Not specified'}</div>
                    <div><strong>Summary:</strong> 
                      <div className="mt-1 text-sm text-secondary-700">
                        {(item as CV).summary || 'Not provided'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {(item as CV).skills && (item as CV).skills !== 'Not specified' && (
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="font-semibold text-lg">Skills</h3>
                    <div className="bg-secondary-50 rounded-lg p-4">
                      <div className="text-sm text-secondary-700">
                        {(item as CV).skills}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // JD Overview
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Position Details</h3>
                  <div className="space-y-2">
                    <div><strong>Job Title:</strong> {(item as JobDescription).job_title || 'Not specified'}</div>
                    <div><strong>Experience Required:</strong> {(item as JobDescription).years_of_experience || 'Not specified'}</div>
                    <div><strong>Education:</strong> {(item as JobDescription).education || 'Not specified'}</div>
                    <div><strong>Summary:</strong> 
                      <div className="mt-1 text-sm text-secondary-700">
                        {(item as JobDescription).summary || 'Not provided'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {(item as JobDescription).skills && (item as JobDescription).skills !== 'Not specified' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Required Skills</h3>
                    <div className="bg-secondary-50 rounded-lg p-4">
                      <div className="text-sm text-secondary-700">
                        {(item as JobDescription).skills}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Raw Extracted Text</h3>
            
            {/* Check if the extracted text looks like structured data */}
            {(() => {
              const extractedText = isCV 
                ? ((item as CV).extracted_text || 'No raw data available')
                : ((item as JobDescription).extracted_text || 'No raw data available');
              
              const looksLikeStructuredData = extractedText.includes('Job Title:') && 
                                             extractedText.includes('Experience:') && 
                                             extractedText.includes('Skills:');
              
              return (
                <>
                  {looksLikeStructuredData && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-600">⚠️</span>
                        <span className="text-yellow-800 text-sm font-medium">
                          Notice: This appears to be processed data instead of raw extracted text
                        </span>
                      </div>
                      <p className="text-yellow-700 text-xs mt-1">
                        The raw extracted text field contains structured data. This may have occurred during upload processing.
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-secondary-50 rounded-lg p-4 max-h-96 overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm text-secondary-700">
                      {extractedText}
                    </pre>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'processed' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">GPT Processed Data</h3>
            <div className="bg-secondary-50 rounded-lg p-4 max-h-96 overflow-auto">
              <pre className="whitespace-pre-wrap text-sm text-secondary-700">
                {isCV 
                  ? (JSON.stringify((item as CV).structured_info, null, 2) || 'No processed data available')
                  : (JSON.stringify((item as JobDescription).structured_info, null, 2) || 'No processed data available')
                }
              </pre>
            </div>
          </div>
        )}
      </CardContent>

      <div className="border-t p-6">
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary">
            Export Data
          </Button>
        </div>
      </div>
    </Card>
  );
};

const DatabasePage = () => {

  const { 
    cvs, 
    jobDescriptions, 
    setCVs, 
    setJobDescriptions, 
    setCurrentTab,
    isLoading,
    setLoading,
    hasLoadedDatabaseData,
    setHasLoadedDatabaseData
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'cvs' | 'jds'>('cvs');
  const [selectedItem, setSelectedItem] = useState<CV | JobDescription | null>(null);
  const [showedToast] = useState(false);
  const isLoadingRef = useRef(false);



  const loadData = useCallback(async () => {
    // Enhanced guard against multiple concurrent calls
    if (isLoadingRef.current) {
      console.log('🔄 Skipping loadData - already loading', {
        isLoadingRef: isLoadingRef.current,
        hasLoadedData,
        isLoading
      });
      return;
    }
    
    console.log('🔄 DatabasePage: Starting to load real data...');
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      // 🚀 FORCE LOAD - DIRECT BACKEND CALL
      console.log('🚀 [FORCE LOAD] Using direct backend route...');
      const response = await fetch('/api/force-load');
      const data = await response.json();
      
      console.log('🚀 [FORCE LOAD] Response:', data);
      
      if (data.success) {
        const realCVs = data.cvs || [];
        const realJDs = data.jds || [];
        
        console.log('🚀 [FORCE LOAD] Setting state:', { cvs: realCVs.length, jds: realJDs.length });
        setCVs(realCVs);
        setJobDescriptions(realJDs);
        
        toast.success(`🎉 LOADED: ${realCVs.length} CVs and ${realJDs.length} JDs!`);
        
        // Set loading complete flags to prevent re-loading
        setHasLoadedDatabaseData(true);
        console.log('🚀 [FORCE LOAD] SUCCESS! hasLoadedDatabaseData set to true');
      } else {
        throw new Error(data.error || 'Failed to load data');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load database content. Using demo data.');
      
      // Mock CVs for demonstration
      const mockCVs: CV[] = [
        {
          id: 'cv-1',
          filename: 'John_Doe_Resume.pdf',
          content: 'Experienced software engineer with 5+ years in full-stack development...',
          upload_date: new Date().toISOString(),
          file_size: 1024 * 256,
          processed: true,
          full_name: 'John Doe',
          job_title: 'Software Engineer',
          email: 'john.doe@email.com',
          phone: '+1-234-567-8900',
          years_of_experience: '5 years',
          skills: 'JavaScript, React, Node.js, Python',
          education: 'BS Computer Science',
          summary: 'Experienced software engineer',
          extracted_text: 'Experienced software engineer with 5+ years in full-stack development...',
          structured_info: { skills: ['JavaScript', 'React', 'Node.js'], experience: '5 years' }
        },
        {
          id: 'cv-2',
          filename: 'Jane_Smith_CV.pdf',
          content: 'Senior data scientist with expertise in machine learning and AI...',
          upload_date: new Date().toISOString(),
          file_size: 1024 * 300,
          processed: true,
          full_name: 'Jane Smith',
          job_title: 'Senior Data Scientist',
          email: 'jane.smith@email.com',
          phone: '+1-234-567-8901',
          years_of_experience: '7 years',
          skills: 'Python, Machine Learning, TensorFlow, SQL',
          education: 'PhD Data Science',
          summary: 'Senior data scientist',
          extracted_text: 'Senior data scientist with expertise in machine learning and AI...',
          structured_info: { skills: ['Python', 'Machine Learning', 'TensorFlow'], experience: '7 years' }
        }
      ];

      // Mock Job Descriptions for demonstration
      const mockJDs: JobDescription[] = [
        {
          id: 'jd-1',
          filename: 'Frontend_Developer_JD.pdf',
          content: 'We are seeking a frontend developer with React experience...',
          upload_date: new Date().toISOString(),
          file_size: 1024 * 128,
          processed: true,
          job_title: 'Frontend Developer',
          years_of_experience: '3+ years required',
          skills: 'React, JavaScript, CSS, HTML',
          education: 'BS Computer Science preferred',
          summary: 'Frontend developer position',
          extracted_text: 'We are seeking a frontend developer with React experience...',
          structured_info: { required_skills: ['React', 'JavaScript'], experience: '3+ years' }
        }
      ];
      
      setCVs(mockCVs);
      setJobDescriptions(mockJDs);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      console.log('🔄 [LOAD DATA] Finally block executed - flags reset');
    }
      }, [setCVs, setJobDescriptions, setLoading, setHasLoadedDatabaseData]); // Keep setter dependencies, exclude state variables



  // Load real data once on mount
  useEffect(() => {
    console.log('🔄 DatabasePage mounted, checking if data load is needed...');
    console.log(`🔄 Current state: cvs=${cvs.length}, jds=${jobDescriptions.length}`);
    console.log(`🔄 Load guards: isLoadingRef=${isLoadingRef.current}, hasLoadedDatabaseData=${hasLoadedDatabaseData}`);
    
    // Only load if we aren't currently loading AND haven't loaded data yet AND don't have data
    if (!isLoadingRef.current && !hasLoadedDatabaseData && cvs.length === 0 && jobDescriptions.length === 0) {
      console.log('🔄 Starting initial data load...');
      loadData();
    } else {
      console.log('🔄 Skipping load - already loaded or loading', {
        isLoading: isLoadingRef.current,
        hasLoadedDatabaseData: hasLoadedDatabaseData,
        hasData: cvs.length > 0 || jobDescriptions.length > 0,
        cvCount: cvs.length,
        jdCount: jobDescriptions.length
      });
    }
  }, []); // Empty dependency array for mount only

  // Listen for database refresh events from analysis completion
  useEffect(() => {
    const handleRefreshDatabase = () => {
      console.log('🔄 Received database refresh event from analysis completion');
      // Reset loading flag to allow fresh data load
      setHasLoadedDatabaseData(false);
      // Simple refresh - just call loadData, it has its own guards
      setTimeout(() => {
        console.log('🔄 Executing delayed database refresh...');
        loadData();
      }, 1500); // Small delay to ensure analysis data is saved
    };

    window.addEventListener('refreshDatabase', handleRefreshDatabase);
    return () => window.removeEventListener('refreshDatabase', handleRefreshDatabase);
  }, [setHasLoadedDatabaseData, loadData]); // Include dependencies for the refresh function

  const filteredCVs = cvs.filter(cv =>
    cv.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (cv.content || cv.summary || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredJDs = jobDescriptions.filter(jd =>
    jd.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (jd.content || jd.summary || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const deleteItem = async (id: string, type: 'cv' | 'jd') => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      // In a real implementation, you would call the delete API
      // await apiMethods.deleteCV(id) or apiMethods.deleteJD(id)
      
      if (type === 'cv') {
        setCVs(cvs.filter(cv => cv.id !== id));
      } else {
        setJobDescriptions(jobDescriptions.filter(jd => jd.id !== id));
      }
      toast.success(`${type.toUpperCase()} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete item');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="xl" text="Loading database..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Document Database
        </h1>
        <p className="text-lg text-secondary-600">
          Manage your stored CVs and job descriptions
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <Input
                  id="document-search"
                  name="documentSearch"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                  aria-label="Search documents by filename or content"
                />
              </div>

              {/* Tab Selector */}
              <div className="flex space-x-1 bg-secondary-100 p-1 rounded-lg">
                <Button
                  variant={selectedTab === 'cvs' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedTab('cvs')}
                  leftIcon={<DocumentTextIcon className="h-4 w-4" />}
                >
                  CVs ({filteredCVs.length})
                </Button>
                <Button
                  variant={selectedTab === 'jds' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedTab('jds')}
                  leftIcon={<BriefcaseIcon className="h-4 w-4" />}
                >
                  Jobs ({filteredJDs.length})
                </Button>
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                onClick={() => {
                  console.log('🔄 Manual refresh button clicked!');
                  console.log('🔄 Current counts before refresh:', { cvs: cvs.length, jds: jobDescriptions.length });
                  setHasLoadedDatabaseData(false); // Reset guard to allow reload
                  loadData();
                }}
                className="mr-3"
              >
                Refresh from Backend (CVs: {cvs.length}, JDs: {jobDescriptions.length})
              </Button>
              <Button
                variant="primary"
                leftIcon={<PlusIcon className="h-4 w-4" />}
                onClick={() => setCurrentTab('upload')}
              >
                Add Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {selectedTab === 'cvs' ? (
          filteredCVs.length > 0 ? (
            filteredCVs.map((cv, index) => (
              <motion.div
                key={cv.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-medium transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="truncate">{cv.filename}</span>
                      <Badge variant={cv.processed ? 'success' : 'warning'} size="sm">
                        {cv.processed ? 'Processed' : 'Pending'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{formatDate(cv.upload_date)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Basic CV Info */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-secondary-900">
                        {cv.full_name || 'Name not extracted'}
                      </div>
                      <div className="text-sm text-secondary-600">
                        {cv.job_title || 'Position not specified'}
                      </div>
                      <div className="text-xs text-secondary-500">
                        Experience: {cv.years_of_experience || 'Not specified'}
                      </div>
                    </div>

                    {/* Skills Preview */}
                    {cv.skills && cv.skills !== 'Not specified' && (
                      <div className="text-xs text-secondary-600">
                        <strong>Skills:</strong> {truncateText(cv.skills, 80)}
                      </div>
                    )}

                    {/* Data Status */}
                    <div className="flex items-center justify-between text-xs text-secondary-500">
                      <span>
                        {cv.extracted_text ? '✓ Raw data' : '✗ No raw data'} | 
                        {cv.structured_info && Object.keys(cv.structured_info).length > 0 ? ' ✓ Processed' : ' ✗ Not processed'}
                      </span>
                      <DocumentTextIcon className="h-4 w-4" />
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<EyeIcon className="h-4 w-4" />}
                        onClick={() => setSelectedItem(cv)}
                        className="flex-1"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<TrashIcon className="h-4 w-4" />}
                        onClick={() => deleteItem(cv.id, 'cv')}
                        className="text-error-600 hover:text-error-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <DocumentTextIcon className="mx-auto h-16 w-16 text-secondary-400 mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                No CVs Found
              </h3>
              <p className="text-secondary-600 mb-6">
                {searchTerm ? 'No CVs match your search criteria.' : 'Click "Refresh from Backend" to load existing data or upload new CVs.'}
              </p>
              <div className="space-x-3">
                <Button variant="outline" onClick={() => {setHasLoadedDatabaseData(false); loadData();}}>
                  Refresh from Backend
                </Button>
                <Button onClick={() => setCurrentTab('upload')}>
                  Upload CVs
                </Button>
              </div>
            </div>
          )
        ) : (
          filteredJDs.length > 0 ? (
            filteredJDs.map((jd, index) => (
              <motion.div
                key={jd.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-medium transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="truncate">{jd.filename}</span>
                      <Badge variant={jd.processed ? 'success' : 'warning'} size="sm">
                        {jd.processed ? 'Processed' : 'Pending'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{formatDate(jd.upload_date)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Basic JD Info */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-secondary-900">
                        {jd.job_title || 'Job title not extracted'}
                      </div>
                      <div className="text-xs text-secondary-500">
                        Experience: {jd.years_of_experience || 'Not specified'}
                      </div>
                    </div>

                    {/* Skills Preview */}
                    {jd.skills && jd.skills !== 'Not specified' && (
                      <div className="text-xs text-secondary-600">
                        <strong>Skills:</strong> {truncateText(jd.skills, 80)}
                      </div>
                    )}

                    {/* Data Status */}
                    <div className="flex items-center justify-between text-xs text-secondary-500">
                      <span>
                        {jd.extracted_text ? '✓ Raw data' : '✗ No raw data'} | 
                        {jd.structured_info && Object.keys(jd.structured_info).length > 0 ? ' ✓ Processed' : ' ✗ Not processed'}
                      </span>
                      <BriefcaseIcon className="h-4 w-4" />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<EyeIcon className="h-4 w-4" />}
                        onClick={() => setSelectedItem(jd)}
                        className="flex-1"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<TrashIcon className="h-4 w-4" />}
                        onClick={() => deleteItem(jd.id, 'jd')}
                        className="text-error-600 hover:text-error-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <BriefcaseIcon className="mx-auto h-16 w-16 text-secondary-400 mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                No Job Descriptions Found
              </h3>
              <p className="text-secondary-600 mb-6">
                {searchTerm ? 'No job descriptions match your search criteria.' : 'Click "Refresh from Backend" to load existing data or upload new job descriptions.'}
              </p>
              <div className="space-x-3">
                <Button variant="outline" onClick={() => {setHasLoadedDatabaseData(false); loadData();}}>
                  Refresh from Backend
                </Button>
                <Button onClick={() => setCurrentTab('upload')}>
                  Upload Job Descriptions
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Enhanced Item Detail Modal */}
      {selectedItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <DetailedItemModal 
              item={selectedItem} 
              onClose={() => setSelectedItem(null)} 
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default DatabasePage;