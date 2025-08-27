// Generated from backend schemas - DO NOT MODIFY BY HAND
// This file contains TypeScript interfaces that mirror the backend's Pydantic models

export interface MatchWeights {
  skills: number;
  responsibilities: number;
  job_title: number;
  experience: number;
}

export interface MatchRequest {
  jd_id?: string;
  jd_text?: string;
  cv_ids?: string[];
  weights?: MatchWeights;
  top_alternatives?: number;
}

export interface AssignmentItem {
  type: 'skill' | 'responsibility';
  jd_index: number;
  jd_item: string;
  cv_index: number;
  cv_item: string;
  score: number;
}

export interface AlternativeItem {
  cv_index: number;
  cv_item: string;
  score: number;
}

export interface AlternativesItem {
  jd_index: number;
  items: AlternativeItem[];
}

export interface CandidateBreakdown {
  cv_id: string;
  cv_name: string;
  cv_job_title?: string;
  cv_years: number;
  skills_score: number;
  responsibilities_score: number;
  job_title_score: number;
  years_score: number;
  overall_score: number;
  skills_assignments: AssignmentItem[];
  responsibilities_assignments: AssignmentItem[];
  skills_alternatives: AlternativesItem[];
  responsibilities_alternatives: AlternativesItem[];
}

export interface MatchResponse {
  jd_id?: string;
  jd_job_title?: string;
  jd_years: number;
  normalized_weights: MatchWeights;
  candidates: CandidateBreakdown[];
}

// CV and JD list responses
export interface CVListItem {
  id: string;
  filename: string;
  upload_date: string;
  full_name: string;
  job_title: string;
  years_of_experience: string;
  skills_count: number;
  skills: string[];
  responsibilities_count: number;
  text_length: number;
  has_structured_data: boolean;
}

export interface CVListResponse {
  status: string;
  count: number;
  cvs: CVListItem[];
}

export interface JDListItem {
  id: string;
  filename: string;
  upload_date: string;
  job_title: string;
  years_of_experience: string;
  skills_count: number;
  skills: string[];
  responsibilities_count: number;
  text_length: number;
  has_structured_data: boolean;
}

export interface JDListResponse {
  status: string;
  count: number;
  jds: JDListItem[];
}

// Health check response
export interface HealthResponse {
  status: string;
  timestamp: number;
  services: {
    qdrant: {
      status: string;
      error?: string;
    };
    embedding: {
      status: string;
      error?: string;
    };
    cache: {
      status: string;
      stats?: Record<string, unknown>;
      error?: string;
    };
  };
  environment: {
    openai_key_configured: boolean;
    qdrant_host: string;
    qdrant_port: string;
  };
}

// Upload responses
export interface UploadResponse {
  status: string;
  message: string;
  results?: Record<string, unknown>[];
  processing_summary?: {
    total_files: number;
    successful: number;
    failed: number;
    processing_time: number;
  };
}
