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
  UpdateUserRequest,
  JobPostingResponse,
  JobPostingListItem,
  PublicJobView,
  JobApplicationResponse,
  JobApplicationListItem
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
    const response = await this.client.get<CVDataResponse>(`/api/cv/${cvId}`);
    return response.data;
  }

  async deleteCV(cvId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete<{ success: boolean; message: string }>(`/api/cv/${cvId}`);
    return response.data;
  }

  async reprocessCV(cvId: string): Promise<UploadResponse> {
    const response = await this.client.post<UploadResponse>(`/api/cv/${cvId}/reprocess`);
    return response.data;
  }

  async getCVEmbeddings(cvId: string): Promise<EmbeddingsInfoResponse> {
    const response = await this.client.get<EmbeddingsInfoResponse>(`/api/cv/${cvId}/embeddings`);
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

  // Two-phase JD upload methods
  async extractJDForUI(jdId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const response = await this.client.post(`/api/careers/admin/jobs/${jdId}/extract-ui-data`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async createJobPostingFromUIData(jdId: string, formData: any): Promise<any> {
    // Backend expects form data, not JSON
    const formDataObj = new FormData();
    formDataObj.append('jd_id', jdId);
    formDataObj.append('job_title', formData.jobTitle || '');
    formDataObj.append('job_location', formData.jobLocation || '');
    formDataObj.append('job_summary', formData.jobSummary || '');
    formDataObj.append('key_responsibilities', formData.keyResponsibilities || '');
    formDataObj.append('qualifications', formData.qualifications || '');
    
    const token = localStorage.getItem('auth_token');
    const response = await this.client.post('/api/careers/admin/jobs/create-from-ui-data', formDataObj, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
      },
    });
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
async clearDatabase(token: string, confirm: boolean): Promise<{ status: string; message: string }> {
  const response = await this.client.post<{ status: string; message: string }>('/api/clear-database', null, {
    params: { confirm },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}


// Download CV by ID
  async downloadCV(cvId: string): Promise<{ blob: Blob; filename: string }> {
    const response = await this.client.get(`/api/cv/${cvId}/download`, {
      responseType: 'blob',
    });
    
    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = `cv_${cvId}.pdf`; // fallback filename
    
    if (contentDisposition) {
      // Try different patterns for filename extraction
      const patterns = [
        /filename\*?=['"]?([^'";\r\n]+)['"]?/i,
        /filename=([^;]+)/i,
        /filename\*?=UTF-8''([^;]+)/i
      ];
      
      for (const pattern of patterns) {
        const match = contentDisposition.match(pattern);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].trim());
          break;
        }
      }
    }
    
    // If we still have a generic filename, try to get it from the CV metadata
    if (filename.startsWith('cv_') && filename.includes(cvId)) {
      // We could potentially fetch CV metadata here, but for now use a better fallback
      filename = `CV_${cvId}.pdf`;
    }
    
    return { blob: response.data, filename };
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

  // Careers methods
  async createJobPosting(file: File): Promise<JobPostingResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.client.post<JobPostingResponse>(
      '/api/careers/admin/jobs/post', 
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
      }
    );
    return response.data;
  }

  async createJobPostingWithFormData(file: File | null, formData: any): Promise<JobPostingResponse> {
    const formDataToSend = new FormData();
    
    if (file) {
      formDataToSend.append('file', file);
    }
    
    // Add form data fields
    if (formData.jobTitle) formDataToSend.append('job_title', formData.jobTitle);
    if (formData.jobLocation) formDataToSend.append('job_location', formData.jobLocation);
    if (formData.jobSummary) formDataToSend.append('job_summary', formData.jobSummary);
    if (formData.keyResponsibilities) formDataToSend.append('key_responsibilities', formData.keyResponsibilities);
    if (formData.qualifications) formDataToSend.append('qualifications', formData.qualifications);
    
    const response = await this.client.post<JobPostingResponse>(
      '/api/careers/admin/jobs/post', 
      formDataToSend,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
      }
    );
    return response.data;
  }

  async createManualJobPosting(formData: any): Promise<JobPostingResponse> {
    const formDataToSend = new FormData();
    
    // Add required and optional form data fields
    formDataToSend.append('job_title', formData.jobTitle);
    if (formData.jobLocation) formDataToSend.append('job_location', formData.jobLocation);
    if (formData.jobSummary) formDataToSend.append('job_summary', formData.jobSummary);
    if (formData.keyResponsibilities) formDataToSend.append('key_responsibilities', formData.keyResponsibilities);
    if (formData.qualifications) formDataToSend.append('qualifications', formData.qualifications);
    if (formData.companyName) formDataToSend.append('company_name', formData.companyName);
    if (formData.additionalInfo) formDataToSend.append('additional_info', formData.additionalInfo);
    
    const response = await this.client.post<JobPostingResponse>(
      '/api/careers/admin/jobs/post-manual', 
      formDataToSend,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
      }
    );
    return response.data;
  }

  async listJobPostings(includeInactive: boolean = false): Promise<JobPostingListItem[]> {
  const response = await this.client.get<JobPostingListItem[]>(
    '/api/careers/admin/jobs',
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      params: {
        include_inactive: includeInactive,
        _t: Date.now() // Cache busting parameter
      }
    }
  );
  return response.data;
}

// lib/api.ts

async getPublicJob(token: string): Promise<PublicJobView> {
  try {
    const response = await this.client.get<PublicJobView>(`/api/careers/jobs/${token}`);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to get public job:', error);
    
    // If it's a 404 error, throw a more specific error
    if (error.response?.status === 404) {
      throw new Error('Job not found or no longer available');
    }
    
    // Re-throw the original error
    throw error;
  }
}

  async submitJobApplication(
    token: string, 
    applicantName: string,
    applicantEmail: string, 
    applicantPhone: string | undefined,
    cvFile: File
  ): Promise<JobApplicationResponse> {
    const formData = new FormData();
    formData.append('applicant_name', applicantName);
    formData.append('applicant_email', applicantEmail);
    if (applicantPhone) formData.append('applicant_phone', applicantPhone);
    formData.append('cv_file', cvFile);
    
    const response = await this.client.post<JobApplicationResponse>(
      `/api/careers/jobs/${token}/apply`, 
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async getJobApplications(jobId: string): Promise<JobApplicationListItem[]> {
    const response = await this.client.get<JobApplicationListItem[]>(
      `/api/careers/admin/jobs/${jobId}/applications`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      }
    );
    return response.data;
  }
  async updateJobPosting(jobId: string, updateData: {
    job_title?: string;
    job_location?: string;
    job_summary?: string;
    key_responsibilities?: string;
    qualifications?: string;
    company_name?: string;
    additional_info?: string;
  }): Promise<{ success: boolean; message: string; updated_fields: string[] }> {
    const response = await this.client.patch<{ success: boolean; message: string; updated_fields: string[] }>(
      `/api/careers/admin/jobs/${jobId}/update`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      }
    );
    return response.data;
  }

  async getJobForEdit(jobId: string): Promise<{
    job_title: string;
    job_location: string;
    job_summary: string;
    key_responsibilities: string;
    qualifications: string;
    company_name: string;
  }> {
    const response = await this.client.get<{
      job_title: string;
      job_location: string;
      job_summary: string;
      key_responsibilities: string;
      qualifications: string;
      company_name: string;
    }>(`/api/careers/admin/jobs/${jobId}/edit-data`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      params: {
        _t: Date.now() // Cache busting parameter
      }
    });
    return response.data;
  }

  async updateJobStatus(jobId: string, status: { is_active: boolean }): Promise<{ success: boolean; message: string }> {
  const response = await this.client.patch<{ success: boolean; message: string }>(
    `/api/careers/admin/jobs/${jobId}/status`,
    status,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`
      }
    }
  );
  return response.data;
}

  async matchJobCandidates(jobId: string, request: { min_score?: number; include_inactive?: boolean }): Promise<any> {
    const requestBody = {
      job_id: jobId,
      min_score: request.min_score,
      include_inactive: request.include_inactive
    };
    
    const response = await this.client.post(
      `/api/careers/admin/jobs/${jobId}/match-candidates`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      }
    );
    return response.data;
  }

  async deleteJobPosting(jobId: string): Promise<{ success: boolean; message: string; details: any }> {
    const response = await this.client.delete(
      `/api/careers/admin/jobs/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      }
    );
    return response.data;
  }

  async deleteAllJobPostings(): Promise<{ success: boolean; message: string; details: any }> {
    const response = await this.client.delete(
      `/api/careers/admin/jobs/delete-all`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      }
    );
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
  extractJDForUI: (jdId: string) => RequestRetryHandler.withRetry(() => apiClient.extractJDForUI(jdId)),
  createJobPostingFromUIData: (jdId: string, formData: any) => RequestRetryHandler.withRetry(() => apiClient.createJobPostingFromUIData(jdId, formData)),
  
  // Matching
  matchCandidates: (request: MatchRequest) => RequestRetryHandler.withRetry(() => apiClient.matchCandidates(request)),
  matchText: (jdText: string, cvText: string) => RequestRetryHandler.withRetry(() => apiClient.matchText(jdText, cvText)),
  
  // System
  getSystemStats: () => RequestRetryHandler.withRetry(() => apiClient.getSystemStats()),
  getDatabaseStatus: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseStatus()),
  getDatabaseView: () => RequestRetryHandler.withRetry(() => apiClient.getDatabaseView()),
  clearDatabase: (token: string, confirm: boolean) => RequestRetryHandler.withRetry(() => apiClient.clearDatabase(token, confirm)),
  downloadCV: (cvId: string) => RequestRetryHandler.withRetry(() => apiClient.downloadCV(cvId)),

  // Auth
  login: (username: string, password: string) => RequestRetryHandler.withRetry(() => apiClient.login(username, password)),
  me: (token: string) => RequestRetryHandler.withRetry(() => apiClient.me(token)),

  // Admin Users (admin only)
  listUsers: (token: string) => RequestRetryHandler.withRetry(() => apiClient.listUsers(token)),
  createUser: (token: string, body: CreateUserRequest) => RequestRetryHandler.withRetry(() => apiClient.createUser(token, body)),
  updateUser: (token: string, id: string, body: UpdateUserRequest) => RequestRetryHandler.withRetry(() => apiClient.updateUser(token, id, body)),
  deleteUser: (token: string, id: string) => RequestRetryHandler.withRetry(() => apiClient.deleteUser(token, id)),

  // Careers API
  createJobPosting: (file: File) => RequestRetryHandler.withRetry(() => apiClient.createJobPosting(file)),
  createJobPostingWithFormData: (file: File | null, formData: any) => 
    RequestRetryHandler.withRetry(() => apiClient.createJobPostingWithFormData(file, formData)),
  createManualJobPosting: (formData: any) => 
    RequestRetryHandler.withRetry(() => apiClient.createManualJobPosting(formData)),
  listJobPostings: (includeInactive: boolean = false) => 
  RequestRetryHandler.withRetry(() => apiClient.listJobPostings(includeInactive)),
  getPublicJob: (token: string) => RequestRetryHandler.withRetry(() => apiClient.getPublicJob(token)),
  submitJobApplication: (token: string, name: string, email: string, phone: string | undefined, cvFile: File) => 
    RequestRetryHandler.withRetry(() => apiClient.submitJobApplication(token, name, email, phone, cvFile)),
  getJobApplications: (jobId: string) => RequestRetryHandler.withRetry(() => apiClient.getJobApplications(jobId)),

  updateJobPosting: (jobId: string, updateData: {
    job_title?: string;
    job_location?: string;
    job_summary?: string;
    key_responsibilities?: string;
    qualifications?: string;
    company_name?: string;
    additional_info?: string;
  }) => RequestRetryHandler.withRetry(() => apiClient.updateJobPosting(jobId, updateData)),
  
  getJobForEdit: (jobId: string) => RequestRetryHandler.withRetry(() => apiClient.getJobForEdit(jobId)),
  updateJobStatus: (jobId: string, status: { is_active: boolean }) => 
  RequestRetryHandler.withRetry(() => apiClient.updateJobStatus(jobId, status)),
  matchJobCandidates: (jobId: string, request: { min_score?: number; include_inactive?: boolean }) => 
  RequestRetryHandler.withRetry(() => apiClient.matchJobCandidates(jobId, request)),
  deleteJobPosting: (jobId: string) => RequestRetryHandler.withRetry(() => apiClient.deleteJobPosting(jobId)),
  deleteAllJobPostings: () => RequestRetryHandler.withRetry(() => apiClient.deleteAllJobPostings()),
};

// Re-export types for convenience
export type { AdminUser, CreateUserRequest, UpdateUserRequest, LoginResponse, UserProfile } from './types';