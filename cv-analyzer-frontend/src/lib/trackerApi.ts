import axios from 'axios';
import { config, getApiBaseUrl } from '@/lib/config';
import type {
  FeaturesResponse,
  TrackerApplication,
  TrackerCandidate,
  TrackerJobOpening,
  TrackerOption,
  TrackerFollowUp,
  TrackerCandidateRow,
} from '@/lib/types';

export type TrackerTeam = 'dubai' | 'abudhabi';

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

  async listJobOpenings(token: string, team?: TrackerTeam): Promise<TrackerJobOpening[]> {
    const res = await client(token).get<TrackerJobOpening[]>('/api/tracker/job-openings', { params: team ? { team } : undefined });
    return res.data;
  },

  async createJobOpening(token: string, data: Partial<TrackerJobOpening>, team?: TrackerTeam): Promise<TrackerJobOpening> {
    const res = await client(token).post<TrackerJobOpening>('/api/tracker/job-openings', data, { params: team ? { team } : undefined });
    return res.data;
  },

  async updateJobOpening(
    token: string,
    id: string,
    data: Partial<TrackerJobOpening>,
    team?: TrackerTeam
  ): Promise<TrackerJobOpening> {
    const res = await client(token).patch<TrackerJobOpening>(`/api/tracker/job-openings/${id}`, data, {
      params: team ? { team } : undefined,
    });
    return res.data;
  },

  async deleteJobOpening(token: string, id: string, team?: TrackerTeam): Promise<void> {
    await client(token).delete(`/api/tracker/job-openings/${id}`, { params: team ? { team } : undefined });
  },

  async listCandidates(token: string, team?: TrackerTeam): Promise<TrackerCandidate[]> {
    const res = await client(token).get<TrackerCandidate[]>('/api/tracker/candidates', { params: team ? { team } : undefined });
    return res.data;
  },

  async listCandidateRows(token: string, team?: TrackerTeam): Promise<TrackerCandidateRow[]> {
    const res = await client(token).get<TrackerCandidateRow[]>('/api/tracker/candidate-rows', { params: team ? { team } : undefined });
    return res.data;
  },

  async createCandidate(token: string, data: Partial<TrackerCandidate>, team?: TrackerTeam): Promise<TrackerCandidate> {
    const res = await client(token).post<TrackerCandidate>('/api/tracker/candidates', data, { params: team ? { team } : undefined });
    return res.data;
  },

  async updateCandidate(
    token: string,
    id: string,
    data: Partial<TrackerCandidate>,
    team?: TrackerTeam
  ): Promise<TrackerCandidate> {
    const res = await client(token).patch<TrackerCandidate>(`/api/tracker/candidates/${id}`, data, {
      params: team ? { team } : undefined,
    });
    return res.data;
  },

  async deleteCandidate(token: string, id: string, team?: TrackerTeam): Promise<void> {
    await client(token).delete(`/api/tracker/candidates/${id}`, { params: team ? { team } : undefined });
  },

  async listApplications(token: string, team?: TrackerTeam): Promise<TrackerApplication[]> {
    const res = await client(token).get<TrackerApplication[]>('/api/tracker/applications', { params: team ? { team } : undefined });
    return res.data;
  },

  async listOptions(
    token: string,
    kind: string,
    opts?: { include_deleted?: boolean; team?: TrackerTeam }
  ): Promise<TrackerOption[]> {
    const res = await client(token).get<TrackerOption[]>('/api/tracker/options', {
      params: { kind, include_deleted: opts?.include_deleted ? 'true' : undefined, team: opts?.team },
    });
    return res.data;
  },

  async createOption(
    token: string,
    kind: string,
    value: string,
    team?: TrackerTeam,
    meta?: { email?: string | null; email_enabled?: boolean | null }
  ): Promise<TrackerOption> {
    const res = await client(token).post<TrackerOption>(
      '/api/tracker/options',
      { kind, value, ...(meta?.email !== undefined ? { email: meta.email } : {}), ...(meta?.email_enabled !== undefined ? { email_enabled: meta.email_enabled } : {}) },
      { params: team ? { team } : undefined }
    );
    return res.data;
  },

  async updateOption(
    token: string,
    id: string,
    data: { value?: string; email?: string | null; email_enabled?: boolean | null },
    team?: TrackerTeam
  ): Promise<TrackerOption> {
    const res = await client(token).patch<TrackerOption>(`/api/tracker/options/${id}`, data, { params: team ? { team } : undefined });
    return res.data;
  },

  async deleteOption(token: string, id: string, team?: TrackerTeam): Promise<void> {
    await client(token).delete(`/api/tracker/options/${id}`, { params: team ? { team } : undefined });
  },

  async purgeInactiveOptions(token: string, kind: string, team?: TrackerTeam): Promise<{ kind: string; purged: number }> {
    const res = await client(token).delete<{ kind: string; purged: number }>('/api/tracker/options/purge-inactive', {
      params: { kind, team },
    });
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
      location?: string;
      status?: string;
      recruiter?: string;
      account_manager?: string;
      recruitment_manager?: string;
      comment?: string;
    },
    team?: TrackerTeam
  ): Promise<TrackerApplication> {
    const res = await client(token).post<TrackerApplication>('/api/tracker/applications', data, { params: team ? { team } : undefined });
    return res.data;
  },

  async updateApplication(
    token: string,
    id: string,
    data: {
      applied_date?: string | null;
      position?: string | null;
      client?: string | null;
      location?: string | null;
      status?: string | null;
      recruiter?: string | null;
      account_manager?: string | null;
      recruitment_manager?: string | null;
      comment?: string | null;
    },
    team?: TrackerTeam
  ): Promise<TrackerApplication> {
    const res = await client(token).patch<TrackerApplication>(`/api/tracker/applications/${id}`, data, {
      params: team ? { team } : undefined,
    });
    return res.data;
  },

  async exportJobOpeningsXlsx(token: string, team?: TrackerTeam): Promise<Blob> {
    const res = await client(token).get('/api/tracker/export/job-openings.xlsx', { responseType: 'blob', params: team ? { team } : undefined });
    return res.data as Blob;
  },

  async exportCandidatesXlsx(token: string, team?: TrackerTeam): Promise<Blob> {
    const res = await client(token).get('/api/tracker/export/candidates.xlsx', { responseType: 'blob', params: team ? { team } : undefined });
    return res.data as Blob;
  },

  async exportFollowUpsXlsx(token: string, team?: TrackerTeam): Promise<Blob> {
    const res = await client(token).get('/api/tracker/export/follow-ups.xlsx', { responseType: 'blob', params: team ? { team } : undefined });
    return res.data as Blob;
  },

  async listFollowUps(token: string, team?: TrackerTeam): Promise<TrackerFollowUp[]> {
    const res = await client(token).get<TrackerFollowUp[]>('/api/tracker/follow-ups', { params: team ? { team } : undefined });
    return res.data;
  },

  async createFollowUp(token: string, data: Partial<TrackerFollowUp>, team?: TrackerTeam): Promise<TrackerFollowUp> {
    const res = await client(token).post<TrackerFollowUp>('/api/tracker/follow-ups', data, { params: team ? { team } : undefined });
    return res.data;
  },

  async updateFollowUp(
    token: string,
    id: string,
    data: Partial<TrackerFollowUp>,
    team?: TrackerTeam
  ): Promise<TrackerFollowUp> {
    const res = await client(token).patch<TrackerFollowUp>(`/api/tracker/follow-ups/${id}`, data, {
      params: team ? { team } : undefined,
    });
    return res.data;
  },

  async deleteFollowUp(token: string, id: string, team?: TrackerTeam): Promise<void> {
    await client(token).delete(`/api/tracker/follow-ups/${id}`, { params: team ? { team } : undefined });
  },

  async getFollowupEmailSettings(
    token: string,
    team?: TrackerTeam
  ): Promise<{ team: string; to: string; cc: string; enabled: boolean }> {
    const res = await client(token).get('/api/tracker/manager-settings/followup-email', { params: team ? { team } : undefined });
    return res.data as any;
  },

  async setFollowupEmailSettings(
    token: string,
    data: { to: string; cc?: string },
    team?: TrackerTeam
  ): Promise<{ success: boolean; team: string; to: string; cc: string; enabled: boolean }> {
    const res = await client(token).put('/api/tracker/manager-settings/followup-email', null, {
      params: { ...(team ? { team } : undefined), to: data.to, cc: data.cc ?? '' },
    });
    return res.data as any;
  },

  async sendFollowupReminderNow(
    token: string,
    followupId: string,
    data?: { to?: string; cc?: string },
    team?: TrackerTeam
  ): Promise<{ success: boolean }> {
    const res = await client(token).post(`/api/tracker/follow-ups/${followupId}/send-reminder`, null, {
      params: { ...(team ? { team } : undefined), ...(data?.to ? { to: data.to } : undefined), ...(data?.cc ? { cc: data.cc } : undefined) },
    });
    return res.data as any;
  },
};

