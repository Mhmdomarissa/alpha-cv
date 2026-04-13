import axios from 'axios';
import { config, getApiBaseUrl } from '@/lib/config';
import type {
  FeaturesResponse,
  TrackerApplication,
  TrackerCandidate,
  TrackerDocument,
  TrackerJobOpening,
  TrackerSkill,
} from '@/lib/types';

function client(token: string) {
  return axios.create({
    baseURL: getApiBaseUrl(),
    timeout: config.requestTimeout,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

export const trackerApi = {
  async getFeatures(token: string): Promise<FeaturesResponse> {
    const res = await client(token).get<FeaturesResponse>('/api/features');
    return res.data;
  },

  async listJobOpenings(token: string): Promise<TrackerJobOpening[]> {
    const res = await client(token).get<TrackerJobOpening[]>('/api/tracker/job-openings');
    return res.data;
  },

  async createJobOpening(token: string, data: Partial<TrackerJobOpening>): Promise<TrackerJobOpening> {
    const res = await client(token).post<TrackerJobOpening>('/api/tracker/job-openings', data);
    return res.data;
  },

  async updateJobOpening(token: string, id: string, data: Partial<TrackerJobOpening>): Promise<TrackerJobOpening> {
    const res = await client(token).patch<TrackerJobOpening>(`/api/tracker/job-openings/${id}`, data);
    return res.data;
  },

  async deleteJobOpening(token: string, id: string): Promise<void> {
    await client(token).delete(`/api/tracker/job-openings/${id}`);
  },

  async listCandidates(token: string): Promise<TrackerCandidate[]> {
    const res = await client(token).get<TrackerCandidate[]>('/api/tracker/candidates');
    return res.data;
  },

  async createCandidate(token: string, data: Partial<TrackerCandidate>): Promise<TrackerCandidate> {
    const res = await client(token).post<TrackerCandidate>('/api/tracker/candidates', data);
    return res.data;
  },

  async updateCandidate(token: string, id: string, data: Partial<TrackerCandidate>): Promise<TrackerCandidate> {
    const res = await client(token).patch<TrackerCandidate>(`/api/tracker/candidates/${id}`, data);
    return res.data;
  },

  async deleteCandidate(token: string, id: string): Promise<void> {
    await client(token).delete(`/api/tracker/candidates/${id}`);
  },

  async listApplications(token: string): Promise<TrackerApplication[]> {
    const res = await client(token).get<TrackerApplication[]>('/api/tracker/applications');
    return res.data;
  },

  async createApplication(
    token: string,
    data: {
      candidate_id: string;
      job_opening_id?: string | null;
      applied_date?: string;
      position?: string;
      client?: string;
      status?: string;
      recruiter?: string;
      account_manager?: string;
      comment?: string;
    }
  ): Promise<TrackerApplication> {
    const res = await client(token).post<TrackerApplication>('/api/tracker/applications', data);
    return res.data;
  },

  async updateApplication(
    token: string,
    id: string,
    data: {
      applied_date?: string | null;
      position?: string | null;
      client?: string | null;
      status?: string | null;
      recruiter?: string | null;
      account_manager?: string | null;
      comment?: string | null;
    }
  ): Promise<TrackerApplication> {
    const res = await client(token).patch<TrackerApplication>(`/api/tracker/applications/${id}`, data);
    return res.data;
  },

  async listSkills(token: string): Promise<TrackerSkill[]> {
    const res = await client(token).get<TrackerSkill[]>('/api/tracker/skills');
    return res.data;
  },

  async createSkill(token: string, name: string): Promise<TrackerSkill> {
    const res = await client(token).post<TrackerSkill>('/api/tracker/skills', { name });
    return res.data;
  },

  async getCandidateSkills(token: string, candidateId: string): Promise<{ skills: string[] }> {
    const res = await client(token).get<{ skills: string[] }>(`/api/tracker/candidates/${candidateId}/skills`);
    return res.data;
  },

  async setCandidateSkills(token: string, candidateId: string, skills: string[]): Promise<{ success: boolean; skills: string[] }> {
    const res = await client(token).put<{ success: boolean; skills: string[] }>(
      `/api/tracker/candidates/${candidateId}/skills`,
      { skill_names: skills }
    );
    return res.data;
  },

  async listCandidateDocuments(token: string, candidateId: string): Promise<TrackerDocument[]> {
    const res = await client(token).get<TrackerDocument[]>(`/api/tracker/candidates/${candidateId}/documents`);
    return res.data;
  },

  async addCandidateDocument(
    token: string,
    candidateId: string,
    data: { label: string; url?: string; storage_key?: string; doc_type?: string }
  ): Promise<TrackerDocument> {
    const res = await client(token).post<TrackerDocument>(`/api/tracker/candidates/${candidateId}/documents`, data);
    return res.data;
  },

  async exportJobOpeningsXlsx(token: string): Promise<Blob> {
    const res = await client(token).get('/api/tracker/export/job-openings.xlsx', { responseType: 'blob' });
    return res.data as Blob;
  },

  async exportCandidatesXlsx(token: string): Promise<Blob> {
    const res = await client(token).get('/api/tracker/export/candidates.xlsx', { responseType: 'blob' });
    return res.data as Blob;
  },
};

