import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { logger } from './logger';
import { ApiErrorHandler, RequestRetryHandler } from './error-handler';
import {
  MatchRequest,
  MatchResponse,
  CVListResponse,
  JDListResponse,
  HealthResponse,
  UploadResponse,
} from './types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.requestTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

    // Request interceptor - add request ID
    this.client.interceptors.request.use((config) => {
      const requestId = uuidv4();
      config.headers['x-request-id'] = requestId;
      
      logger.info(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        requestId,
        data: config.data,
      });

    return config;
    });

    // Response interceptor - log responses and handle errors
    this.client.interceptors.response.use(
  (response) => {
        const requestId = response.config.headers['x-request-id'] as string;
        logger.info(`API Response: ${response.status}`, {
          requestId,
          url: response.config.url,
          status: response.status,
        });
    return response;
  },
  (error) => {
        const requestId = error.config?.headers?.['x-request-id'] as string;
        throw ApiErrorHandler.handle(error, requestId);
      }
    );
  }

  // Health endpoints
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/api/health');
    return response.data;
  }

  // CV endpoints
  async uploadCV(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await this.client.post<UploadResponse>('/api/cv/upload-cv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async listCVs(): Promise<CVListResponse> {
    const response = await this.client.get<CVListResponse>('/api/cv/cvs');
    return response.data;
  }

  async getCVDetails(cvId: string): Promise<any> {
    const response = await this.client.get(`/api/cv/cv/${cvId}`);
    return response.data;
  }

  // JD endpoints
  async uploadJD(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<UploadResponse>('/api/jd/upload-jd', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async listJDs(): Promise<JDListResponse> {
    const response = await this.client.get<JDListResponse>('/api/jd/jds');
    return response.data;
  }

  async getJDDetails(jdId: string): Promise<any> {
    const response = await this.client.get(`/api/jd/jd/${jdId}`);
    return response.data;
  }

  // Matching endpoints
  async matchCandidates(request: MatchRequest): Promise<MatchResponse> {
    const response = await this.client.post<MatchResponse>('/api/match', request);
    return response.data;
  }

  // System endpoints
  async getSystemStats(): Promise<any> {
    const response = await this.client.get('/api/system-stats');
      return response.data;
  }

  async getDatabaseStatus(): Promise<any> {
    const response = await this.client.get('/api/database/status');
    return response.data;
  }

  async getDatabaseView(): Promise<any> {
    const response = await this.client.get('/api/database/view');
    return response.data;
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export individual functions for easier consumption
export const api = {
  // Health
  healthCheck: () => RequestRetryHandler.withRetry(() => apiClient.healthCheck()),
  
  // CV operations
  uploadCV: (files: File[]) => RequestRetryHandler.withRetry(() => apiClient.uploadCV(files)),
  listCVs: () => RequestRetryHandler.withRetry(() => apiClient.listCVs()),
  getCVDetails: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.getCVDetails(cvId)),
  
  // JD operations
  uploadJD: (file: File) => RequestRetryHandler.withRetry(() => apiClient.uploadJD(file)),
  listJDs: () => RequestRetryHandler.withRetry(() => apiClient.listJDs()),
  getJDDetails: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.getJDDetails(jdId)),
  
  // Matching
  matchCandidates: (request: MatchRequest) => RequestRetryHandler.withRetry(() => apiClient.matchCandidates(request)),
  
  // System
  getSystemStats: () => RequestRetryHandler.withRetry(() => apiClient.getSystemStats()),
  getDatabaseStatus: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseStatus()),
  getDatabaseView: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseView()),
};
