import axios, { AxiosInstance } from 'axios';
import { config, getApiBaseUrl } from './config';
import logger from './logger';
import { ApiErrorHandler, RequestRetryHandler } from './error-handler';

// API Types
export interface CV {
  id: string;
  filename: string;
  content: string;
  upload_date: string;
  file_size: number;
  processed: boolean;
  full_name?: string;
  job_title?: string;
  email?: string;
  phone?: string;
  years_of_experience?: string;
  skills?: string;
  education?: string;
  summary?: string;
  extracted_text?: string;
  structured_info?: Record<string, unknown>;
}

export interface JobDescription {
  id: string;
  filename: string;
  content: string;
  upload_date: string;
  file_size: number;
  processed: boolean;
  job_title?: string;
  years_of_experience?: string;
  skills?: string;
  education?: string;
  summary?: string;
  extracted_text?: string;
  structured_info?: Record<string, unknown>;
}

export interface MatchResult {
  cv_id: string;
  cv_filename: string;
  overall_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  title_score: number;
  standardized_cv?: Record<string, unknown>;
  match_details?: Record<string, unknown>;
  // Additional properties from mock data
  matching_skills?: string[];
  missing_skills?: string[];
  candidate_summary?: string;
  raw_cv_data?: string;
}

export interface AnalysisRequest {
  jd_text: string;
  cv_texts: string[];
  filenames?: string[];
}

export interface HealthStatus {
  status: string;
  qdrant: {
    connected: boolean;
    collections: number;
  };
  environment: {
    python_version: string;
    openai_configured: boolean;
  };
  version: string;
}

export interface SystemStatus {
  status: string;
  timestamp: string;
  system_stats: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    total_cvs: number;
    total_jds: number;
    processed_cvs: number;
    processed_jds: number;
  };
  services: {
    qdrant: {
      status: string;
      collections: number;
      total_vectors: number;
    };
    openai: {
      status: string;
      model: string;
    };
  };
  performance: {
    average_response_time: number;
    requests_per_minute: number;
  };
}

export interface ApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  message?: string;
}

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    logger.info(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    logger.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with enhanced error logging
api.interceptors.response.use(
  (response) => {
    logger.info(`Response received: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    const apiError = ApiErrorHandler.handleApiError(error);
    
    // Create a clean error object without undefined values
    const errorDetails: Record<string, unknown> = {};
    if (error.response?.status) errorDetails.status = error.response.status;
    if (apiError.message) errorDetails.message = apiError.message;
    if (error.config?.url) errorDetails.url = error.config.url;
    if (error.response?.statusText) errorDetails.statusText = error.response.statusText;
    if (error.code) errorDetails.code = error.code;
    
    // Only log if we have some error details
    if (Object.keys(errorDetails).length > 0) {
      logger.error('Response failed:', errorDetails);
    } else {
      logger.error('Response failed: Unknown error');
    }
    
    return Promise.reject(apiError);
  }
);

// API Methods
export const apiMethods = {
  // Health and Status
  getHealth: (): Promise<HealthStatus> =>
    api.get('/health').then(res => res.data),

  getSystemStatus: (): Promise<SystemStatus> =>
    api.get('/api/upload/system-status').then(res => res.data),

  // CV Operations
  uploadCV: (file: File): Promise<ApiResponse> => {
    console.log('📄 Uploading CV file:', file.name, file.type, file.size);
    const formData = new FormData();
    formData.append('file', file);
    
    // Use axios with relative URL for Next.js API routes
    return axios.create({
      baseURL: '', // Empty base URL for relative requests
      timeout: 90000, // 90 second timeout for file processing
    }).post('/api/jobs/upload-cv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => {
      console.log('✅ [CV UPLOAD] Next.js API route response:', {
        hasData: !!res.data,
        cvId: res.data?.cv_id,
        filename: res.data?.filename,
        hasStandardizedData: !!res.data?.standardized_data
      });
      return res.data;
    }).catch(error => {
      const errorDetails = {
        status: error.response?.status || 'unknown',
        statusText: error.response?.statusText || 'unknown',
        data: error.response?.data || {},
        message: error.message || 'unknown error',
        url: '/api/jobs/upload-cv',
        errorType: error.constructor.name,
        code: error.code || 'unknown'
      };
      console.error('❌ [CV UPLOAD] Next.js API route error details:', errorDetails);
      console.error('❌ [CV UPLOAD] Raw error response data:', error.response?.data);
      
      const responseData = error.response?.data || {};
      let errorMessage = responseData.error || error.message || 'CV upload failed';
      
      // Special handling for OpenAI API errors
      if (responseData.details?.includes('OpenAI API') || responseData.details?.includes('server_error')) {
        errorMessage = '🤖 AI processing temporarily unavailable (OpenAI server issue). Please retry in a few minutes.';
      } else if (responseData.isRetryable) {
        errorMessage = `⚠️ ${errorMessage} (Retryable)`;
      }
      
      // Create a more informative error object
      const enhancedError = {
        message: errorMessage,
        status: error.response?.status || 500,
        code: error.code || 'UPLOAD_ERROR',
        isRetryable: responseData.isRetryable || false,
        isOpenAIError: responseData.details?.includes('OpenAI API') || responseData.details?.includes('server_error'),
        details: responseData,
        extractedText: responseData.extractedText, // Include extracted text even if GPT failed
        filename: responseData.filename
      };
      
      console.error('❌ [CV UPLOAD] Enhanced error object:', enhancedError);
      throw enhancedError;
    });
  },

  getCVs: (): Promise<{ cvs: CV[] }> => 
    api.get('/api/jobs/list-cvs').then(res => res.data),

  // JD Operations
  uploadJD: (file: File): Promise<ApiResponse> => {
    console.log('📋 Uploading JD file:', file.name, file.type, file.size);
    
    // Handle text files by reading content
    if (file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          console.log('📋 Text file content length:', content.length);
          
          // Use local Next.js API route with correct baseURL
          const localApi = axios.create({
            baseURL: '',
            timeout: 60000,
          });
          
          localApi.post('/api/jobs/standardize-jd-text', { content })
            .then(res => {
              console.log('📋 Text upload response:', res.data);
              resolve(res.data);
            })
            .catch(reject);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    }
    
    // For other file types, use FormData with Next.js API route
    console.log('📋 Non-text file, using FormData upload via Next.js API route');
    const formData = new FormData();
    formData.append('file', file);
    console.log('📋 FormData created, sending to local Next.js API route: /api/jobs/standardize-jd');
    
    // Use axios with relative URL for Next.js API routes
    return axios.create({
      baseURL: '', // Empty base URL for relative requests
      timeout: 60000, // 60 second timeout for file processing
    }).post('/api/jobs/standardize-jd', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => {
      console.log('✅ [JD UPLOAD] Next.js API route response:', {
        hasData: !!res.data,
        hasStandardizedData: !!res.data?.standardized_data,
        jdId: res.data?.jd_id,
        filename: res.data?.filename
      });
      return res.data;
    }).catch(error => {
      console.error('❌ [JD UPLOAD] Next.js API route error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: '/api/jobs/standardize-jd'
      });
      
      // Create a more informative error object
      const enhancedError = {
        message: error.response?.data?.error || error.message || 'JD upload failed',
        status: error.response?.status || 500,
        code: error.code || 'UPLOAD_ERROR',
        details: error.response?.data
      };
      
      console.error('❌ [JD UPLOAD] Enhanced error object:', enhancedError);
      throw enhancedError;
    });
  },

  getJobDescriptions: (): Promise<{ jds: JobDescription[] }> => 
    api.get('/api/jobs/list-jds').then(res => res.data),

  // Analysis and Matching with Parallel Processing
  analyzeAndMatch: async (data: AnalysisRequest): Promise<{ results: MatchResult[] }> => {
    const results: MatchResult[] = [];
    
    console.log(`🚀 Processing ${data.cv_texts.length} CVs with parallel batches`);
    
    // Process CVs with optimized parallelism for faster performance
    const batchSize = 6; // Process 6 CVs at a time for better speed (increased from 3)
    console.log(`🚀 Processing ${data.cv_texts.length} CVs with parallel batches of ${batchSize}`);
    
    // Process CVs in batches
    for (let batchStart = 0; batchStart < data.cv_texts.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, data.cv_texts.length);
      const batchPromises: Promise<MatchResult>[] = [];
      
      console.log(`📦 Processing batch ${Math.floor(batchStart / batchSize) + 1}: CVs ${batchStart + 1}-${batchEnd}`);
      
      // Create promises for current batch
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(processSingleCV(i, data.cv_texts[i], data.filenames?.[i] || `CV_${i + 1}`, data.jd_text));
      }
      
      // Wait for current batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        const cvIndex = batchStart + index;
        if (result.status === 'fulfilled') {
          results.push(result.value);
          console.log(`✅ CV ${cvIndex + 1} completed successfully`);
        } else {
          console.error(`❌ CV ${cvIndex + 1} failed:`, result.reason);
          // Add fallback result for failed CV
          const filename = data.filenames?.[cvIndex] || `CV_${cvIndex + 1}`;
          results.push(calculateQuickScore(data.jd_text, data.cv_texts[cvIndex], filename));
        }
      });
      
      // Small delay between batches to avoid overwhelming the server
      if (batchEnd < data.cv_texts.length) {
        console.log(`⏸️ Waiting 500ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Sort results by overall score (highest first)
    results.sort((a, b) => b.overall_score - a.overall_score);
    
    console.log(`🎉 Completed processing all CVs. ${results.length}/${data.cv_texts.length} successful.`);
    return { results };
  },

  bulkUploadCVs: (files: File[]): Promise<ApiResponse> => {
    // Backend expects text content, not file upload
    return Promise.all(files.map(file => 
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsText(file);
      })
    )).then(async (texts) => {
      const response = await api.post('/api/jobs/bulk-upload-cvs', {
        cv_texts: texts,
        filenames: files.map(f => f.name)
      });
      return response.data;
    });
  },

  // Matching operations
  getTopMatches: (jdId: string, limit: number = 10): Promise<{ matches: MatchResult[] }> =>
    api.post('/api/jobs/cosine-top-k-match', {
      jd_id: jdId,
      top_k: limit
    }).then(res => res.data),

  getStandardizedMatch: (jdId: string, cvId: string): Promise<MatchResult> =>
    api.post('/api/jobs/standardized-match', {
      jd_id: jdId,
      cv_id: cvId
    }).then(res => res.data),
};

// Helper function to process a single CV
async function processSingleCV(index: number, cvText: string, filename: string, jdText: string): Promise<MatchResult> {
  console.log(`📄 Processing CV ${index + 1}: ${filename}`);
  
  // Retry logic for intermittent backend failures
  // let lastError: unknown;
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`⏱️ Attempting backend analysis for CV ${index + 1} (90s timeout) - Attempt ${attempt}/${maxRetries}...`);
      console.log(`📊 Sending data: JD=${jdText.length} chars, CV=${cvText.length} chars`);
      
      // Use relative URL for Next.js API routes - this will always hit the correct Next.js server
      const localApiUrl = '/api/jobs/standardize-and-match-text';
      console.log(`🔗 Calling local Next.js API route: ${localApiUrl}`);
      
      // Create fresh axios instance without base URL to ensure relative URLs work correctly
      const response = await axios.create({
        baseURL: '', // Empty base URL for relative requests
        timeout: 90000, // 90 second timeout to match backend processing time
        headers: {
          'Content-Type': 'application/json'
        }
      }).post(localApiUrl, {
        jd_text: jdText,
        cv_text: cvText
      });
      
      console.log(`✅ Backend analysis response for CV ${index + 1}:`, response.status, response.data?.match_result?.overall_score);
      
      const backendData = response.data;
      
      if (backendData.match_result) {
        const matchResult: MatchResult = {
          cv_id: backendData.cv_id || `cv_${index + 1}`,
          cv_filename: filename,
          overall_score: backendData.match_result.overall_score || 0,
          skills_score: backendData.match_result.breakdown?.skills_score || 0,
          experience_score: backendData.match_result.breakdown?.experience_score || 0,
          education_score: backendData.match_result.breakdown?.responsibility_score || 0,
          title_score: backendData.match_result.breakdown?.title_score || 0,
          standardized_cv: backendData.cv_standardized_data,
          match_details: backendData.match_result
        };
        console.log(`✅ CV ${index + 1} processed successfully with backend - Score: ${matchResult.overall_score.toFixed(2)}`);
        return matchResult; // Success - return result
      } else {
        throw new Error('No match_result from backend');
      }
    } catch (apiError: unknown) {
      // lastError = apiError;
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      console.warn(`⚠️ Backend analysis failed for CV ${index + 1} (attempt ${attempt}/${maxRetries}):`, errorMessage);
      
      // Enhanced error debugging
      if (axios.isAxiosError(apiError)) {
        console.log(`🔍 Axios error details for CV ${index + 1} (attempt ${attempt}):`, {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          url: apiError.config?.url,
          code: apiError.code,
          message: apiError.message
        });
      }
      
      // If this was the last attempt, we'll fall back to quick scoring
      if (attempt === maxRetries) {
        console.warn(`❌ All ${maxRetries} attempts failed for CV ${index + 1}, falling back to quick scoring`);
        break;
      } else {
        console.log(`🔄 Retrying CV ${index + 1} analysis in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between retries
      }
    }
  }
  
  // If we reach here, all attempts failed - use quick scoring as fallback
  console.warn(`🔄 All attempts failed for CV ${index + 1}, using quick scoring as fallback`);
  const fallbackResult = calculateQuickScore(jdText, cvText, filename);
  console.log(`✅ CV ${index + 1} processed with quick scoring - Score: ${fallbackResult.overall_score.toFixed(2)}`);
  return fallbackResult;
}

// Quick scoring function for fallback
function calculateQuickScore(jdText: string, cvText: string, filename: string): MatchResult {
  const jdLower = jdText.toLowerCase();
  const cvLower = cvText.toLowerCase();
  
  // Common tech skills
  const techSkills = ['python', 'javascript', 'react', 'django', 'flask', 'sql', 'postgresql', 'mongodb', 'aws', 'docker', 'kubernetes', 'git', 'node.js', 'express', 'vue', 'angular'];
  const jdSkills = techSkills.filter(skill => jdLower.includes(skill));
  const cvSkills = techSkills.filter(skill => cvLower.includes(skill));
  const skillsMatch = jdSkills.filter(skill => cvSkills.includes(skill));
  const skillsScore = jdSkills.length > 0 ? (skillsMatch.length / jdSkills.length) * 100 : 50;
  
  // Experience keywords
  const expKeywords = ['year', 'experience', 'senior', 'junior', 'lead', 'manager'];
  const expScore = expKeywords.some(keyword => cvLower.includes(keyword)) ? 75 : 50;
  
  // Title matching
  const titleKeywords = jdLower.match(/\b(developer|engineer|analyst|manager|architect)\b/g) || [];
  const titleScore = titleKeywords.some(title => cvLower.includes(title)) ? 80 : 40;
  
  const overallScore = (skillsScore * 0.4) + (expScore * 0.3) + (titleScore * 0.3);
  
  return {
    cv_id: `cv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cv_filename: filename,
    overall_score: Math.min(100, Math.max(20, overallScore)),
    skills_score: skillsScore,
    experience_score: expScore,
    education_score: 60, // Default
    title_score: titleScore,
    standardized_cv: {
      full_name: filename.replace(/\.(pdf|docx|txt)$/, ''),
      skills: cvSkills,
      experience: cvLower.includes('senior') ? '5+ years' : cvLower.includes('junior') ? '1-3 years' : '3-5 years'
    },
    match_details: {
      overall_score: overallScore,
      breakdown: {
        skills_score: skillsScore,
        experience_score: expScore,
        responsibility_score: 60,
        title_score: titleScore
      }
    }
  };
}

/**
 * Enhanced API wrapper with retry logic and error handling
 */
export const createApiMethod = <T>(
  operation: () => Promise<T>,
  context: string,
  useRetry: boolean = true
): Promise<T> => {
  logger.setContext(context);
  
  if (!useRetry || !config.features.enableRetry) {
    return operation().catch(error => {
      ApiErrorHandler.logError(error, context);
      throw error;
    });
  }

  return RequestRetryHandler.withRetry(operation, {
    maxRetries: config.api.retryAttempts,
    delay: config.api.retryDelay,
  }).catch(error => {
    ApiErrorHandler.logError(error, context);
    throw error;
  });
};

export default api;