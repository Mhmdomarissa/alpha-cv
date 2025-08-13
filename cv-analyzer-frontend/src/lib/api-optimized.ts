import axios from 'axios';
import { config } from './config';
import logger from './logger';

// Optimized API types
export interface OptimizedAnalysisRequest {
  jd_text: string;
  cv_texts: string[];
  filenames?: string[];
}

export interface OptimizedMatchResult {
  cv_id: string;
  cv_filename: string;
  overall_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  title_score: number;
  match_details: {
    overall_score: number;
    breakdown: {
      skills_score: number;
      experience_score: number;
      responsibility_score: number;
      title_score: number;
    };
    explanation: string;
    skill_match_percentage: number;
    responsibility_match_percentage: number;
    title_similarity: number;
    experience_match: boolean;
  };
}

export interface OptimizedAnalysisResponse {
  status: string;
  results: OptimizedMatchResult[];
  processing_time: number;
  performance_metrics: {
    total_cvs: number;
    time_per_cv: number;
    cvs_per_second: number;
    optimization_version: string;
  };
  message: string;
}

export interface PerformanceMetrics {
  status: string;
  optimization_version: string;
  performance_metrics: {
    embedding_model: string;
    embedding_dimensions: number;
    embedding_latency_ms: number;
    cache_status: {
      jd_cache_size: number;
      cv_cache_size: number;
    };
    thread_pool_workers: number;
    batch_size: number;
  };
  target_performance: {
    [key: string]: string;
  };
  optimizations_applied: string[];
}

// Create optimized axios instance
const optimizedApi = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 300000, // 5 minutes for large batch processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for optimized API
optimizedApi.interceptors.request.use(
  (config) => {
    logger.info(`Making optimized ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    logger.error('Optimized API request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for optimized API
optimizedApi.interceptors.response.use(
  (response) => {
    logger.info(`Optimized API response: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    logger.error('Optimized API response error:', {
      status: error.response?.status,
      message: error.response?.data?.detail || error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

// Optimized API methods
export const optimizedApiMethods = {
  // Ultra-fast bulk analysis
  bulkAnalyzeOptimized: async (data: OptimizedAnalysisRequest): Promise<OptimizedAnalysisResponse> => {
    console.log(`🚀 Starting optimized bulk analysis: 1 JD vs ${data.cv_texts.length} CVs`);
    
    try {
      const response = await optimizedApi.post('/api/optimized/bulk-analyze-optimized', data);
      
      console.log(`✅ Optimized analysis completed in ${response.data.processing_time?.toFixed(2)}s`);
      console.log(`📊 Performance: ${response.data.performance_metrics?.cvs_per_second?.toFixed(1)} CVs/second`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Optimized bulk analysis failed:', error);
      throw error;
    }
  },

  // Get performance status
  getPerformanceStatus: async (): Promise<PerformanceMetrics> => {
    try {
      const response = await optimizedApi.get('/api/optimized/performance-status');
      return response.data;
    } catch (error) {
      console.error('❌ Performance status check failed:', error);
      throw error;
    }
  },

  // Run performance benchmark
  benchmarkPerformance: async (): Promise<any> => {
    console.log('🏃 Running performance benchmark...');
    
    try {
      const response = await optimizedApi.post('/api/optimized/benchmark-performance');
      
      console.log(`🎉 Benchmark completed: ${response.data.benchmark_results?.cvs_per_second?.toFixed(1)} CVs/second`);
      console.log(`📊 Projected 100 CVs time: ${response.data.benchmark_results?.projected_100_cvs_time?.toFixed(1)}s`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Performance benchmark failed:', error);
      throw error;
    }
  },

  // Optimized CV standardization
  standardizeCVOptimized: async (cv_text: string): Promise<any> => {
    try {
      const response = await optimizedApi.post('/api/optimized/standardize-cv-optimized', {
        cv_text
      });
      return response.data;
    } catch (error) {
      console.error('❌ Optimized CV standardization failed:', error);
      throw error;
    }
  },

  // Optimized JD standardization
  standardizeJDOptimized: async (jd_text: string): Promise<any> => {
    try {
      const response = await optimizedApi.post('/api/optimized/standardize-jd-optimized', {
        jd_text
      });
      return response.data;
    } catch (error) {
      console.error('❌ Optimized JD standardization failed:', error);
      throw error;
    }
  }
};

export default optimizedApi;
