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
  StandardizeResponse,
  DatabaseStatusResponse,
  SystemStatsResponse,
  EmbeddingsInfoResponse,
  CVDataResponse,
  JDDataResponse,
  DatabaseViewResponse,
  LoginRequest,
  LoginResponse,
  UserProfile,
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest
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
  async uploadCV(file: File, cvText?: string): Promise<UploadResponse> {
    const formData = new FormData();
    
    if (file) {
      formData.append('file', file);
    } else if (cvText) {
      formData.append('cv_text', cvText);
    }
    
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

  async getCVDetails(cvId: string): Promise<CVDataResponse> {
    const response = await this.client.get<CVDataResponse>(`/api/cv/cv/${cvId}`);
    return response.data;
  }

  async deleteCV(cvId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete<{ success: boolean; message: string }>(`/api/cv/cv/${cvId}`);
    return response.data;
  }

  async reprocessCV(cvId: string): Promise<UploadResponse> {
    const response = await this.client.post<UploadResponse>(`/api/cv/cv/${cvId}/reprocess`);
    return response.data;
  }

  async getCVEmbeddings(cvId: string): Promise<EmbeddingsInfoResponse> {
    const response = await this.client.get<EmbeddingsInfoResponse>(`/api/cv/cv/${cvId}/embeddings`);
    return response.data;
  }

  async standardizeCV(cvText: string, filename?: string): Promise<StandardizeResponse> {
    const payload: { cv_text: string; cv_filename?: string } = { cv_text: cvText };
    if (filename) payload.cv_filename = filename;
    
    const response = await this.client.post<StandardizeResponse>('/api/cv/standardize-cv', payload);
    return response.data;
  }

  // JD endpoints
  async uploadJD(file: File, jdText?: string): Promise<UploadResponse> {
    const formData = new FormData();
    
    if (file) {
      formData.append('file', file);
    } else if (jdText) {
      formData.append('jd_text', jdText);
    }
    
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

  async getJDDetails(jdId: string): Promise<JDDataResponse> {
    const response = await this.client.get<JDDataResponse>(`/api/jd/jd/${jdId}`);
    return response.data;
  }

  async deleteJD(jdId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete<{ success: boolean; message: string }>(`/api/jd/jd/${jdId}`);
    return response.data;
  }

  async reprocessJD(jdId: string): Promise<UploadResponse> {
    const response = await this.client.post<UploadResponse>(`/api/jd/jd/${jdId}/reprocess`);
    return response.data;
  }

  async getJDEmbeddings(jdId: string): Promise<EmbeddingsInfoResponse> {
    const response = await this.client.get<EmbeddingsInfoResponse>(`/api/jd/jd/${jdId}/embeddings`);
    return response.data;
  }

  async standardizeJD(jdText: string, filename?: string): Promise<StandardizeResponse> {
    const payload: { jd_text: string; jd_filename?: string } = { jd_text: jdText };
    if (filename) payload.jd_filename = filename;
    
    const response = await this.client.post<StandardizeResponse>('/api/jd/standardize-jd', payload);
    return response.data;
  }

  // Matching endpoints
  async matchCandidates(request: MatchRequest): Promise<MatchResponse> {
    const response = await this.client.post<MatchResponse>('/api/match', request);
    return response.data;
  }

  async matchText(jdText: string, cvText: string): Promise<any> {
    const response = await this.client.post('/api/match-text', {
      jd_text: jdText,
      cv_text: cvText
    });
    return response.data;
  }

  // System endpoints
  async getSystemStats(): Promise<SystemStatsResponse> {
    const response = await this.client.get<SystemStatsResponse>('/api/system-stats');
    return response.data;
  }

  async getDatabaseStatus(): Promise<DatabaseStatusResponse> {
    const response = await this.client.get<DatabaseStatusResponse>('/api/database/status');
    return response.data;
  }

  async getDatabaseView(): Promise<DatabaseViewResponse> {
    const response = await this.client.get<DatabaseViewResponse>('/api/database/view');
    return response.data;
  }

  // Clear database
async clearDatabase(confirm: boolean): Promise<{ status: string; message: string }> {
  const response = await this.client.post<{ status: string; message: string }>('/api/clear-database', null, {
    params: { confirm }
  });
  return response.data;
}


// Download CV by ID
async downloadCV(cvId: string): Promise<Blob> {
  const response = await this.client.get(`/api/cv/cv/${cvId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

  // Auth methods
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  }

  async me(token: string): Promise<UserProfile> {
    const response = await this.client.get<UserProfile>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  // Admin methods
  async listUsers(token: string): Promise<AdminUser[]> {
    const response = await this.client.get<AdminUser[]>('/api/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async createUser(token: string, body: CreateUserRequest): Promise<AdminUser> {
    const response = await this.client.post<AdminUser>('/api/admin/users', body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async updateUser(token: string, id: string, body: UpdateUserRequest): Promise<AdminUser> {
    const response = await this.client.patch<AdminUser>(`/api/admin/users/${id}`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async deleteUser(token: string, id: string): Promise<void> {
    await this.client.delete(`/api/admin/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}


// Create singleton instance
export const apiClient = new ApiClient();

// Export individual functions for easier consumption
export const api = {
  // Health
  healthCheck: () => RequestRetryHandler.withRetry(() => apiClient.healthCheck()),
  
  // CV operations
  uploadCV: (file: File, cvText?: string) => RequestRetryHandler.withRetry(() => apiClient.uploadCV(file, cvText)),
  listCVs: () => RequestRetryHandler.withRetry(() => apiClient.listCVs()),
  getCVDetails: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.getCVDetails(cvId)),
  deleteCV: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.deleteCV(cvId)),
  reprocessCV: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.reprocessCV(cvId)),
  getCVEmbeddings: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.getCVEmbeddings(cvId)),
  standardizeCV: (cvText: string, filename?: string) => RequestRetryHandler.withRetry(() => apiClient.standardizeCV(cvText, filename)),
  
  // JD operations
  uploadJD: (file: File, jdText?: string) => RequestRetryHandler.withRetry(() => apiClient.uploadJD(file, jdText)),
  listJDs: () => RequestRetryHandler.withRetry(() => apiClient.listJDs()),
  getJDDetails: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.getJDDetails(jdId)),
  deleteJD: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.deleteJD(jdId)),
  reprocessJD: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.reprocessJD(jdId)),
  getJDEmbeddings: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.getJDEmbeddings(jdId)),
  standardizeJD: (jdText: string, filename?: string) => RequestRetryHandler.withRetry(() => apiClient.standardizeJD(jdText, filename)),
  
  // Matching
  matchCandidates: (request: MatchRequest) => RequestRetryHandler.withRetry(() => apiClient.matchCandidates(request)),
  matchText: (jdText: string, cvText: string) => RequestRetryHandler.withRetry(() => apiClient.matchText(jdText, cvText)),
  
  // System
  getSystemStats: () => RequestRetryHandler.withRetry(() => apiClient.getSystemStats()),
  getDatabaseStatus: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseStatus()),
  getDatabaseView: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseView()),
  clearDatabase: (confirm: boolean) => RequestRetryHandler.withRetry(() => apiClient.clearDatabase(confirm)),
  downloadCV: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.downloadCV(cvId)),

  // Auth
  login: (username: string, password: string) => RequestRetryHandler.withRetry(() => apiClient.login(username, password)),
  me: (token: string) => RequestRetryHandler.withRetry(() => apiClient.me(token)),

  // Admin Users (admin only)
  listUsers: (token: string) => RequestRetryHandler.withRetry(() => apiClient.listUsers(token)),
  createUser: (token: string, body: CreateUserRequest) => RequestRetryHandler.withRetry(() => apiClient.createUser(token, body)),
  updateUser: (token: string, id: string, body: UpdateUserRequest) => RequestRetryHandler.withRetry(() => apiClient.updateUser(token, id, body)),
  deleteUser: (token: string, id: string) => RequestRetryHandler.withRetry(() => apiClient.deleteUser(token, id)),
};

// Re-export types for convenience
export type { AdminUser, CreateUserRequest, UpdateUserRequest, LoginResponse, UserProfile } from './types';

