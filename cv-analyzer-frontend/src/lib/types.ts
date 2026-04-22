
// Base types
export interface BaseDocument {
  id: string;
  filename: string;
  upload_date: string;
  has_structured_data: boolean;
}

// CV types
export interface CVListItem extends BaseDocument {
  full_name: string;
  job_title: string;
  years_of_experience: string;
  skills_count: number;
  skills: string[];
  responsibilities_count: number;
  text_length: number;
  category?: string;
  /** True for CVs submitted via Careers job applications */
  is_job_application?: boolean;
  /** Careers job id (UUID) if this CV is an application */
  applied_job_id?: string | null;
  /** Careers job title if this CV is an application */
  applied_job_title?: string | null;
}

export interface CVDataResponse {
  id: string;
  filename: string;
  upload_date: string;
  document_type: "cv";
  candidate: {
    full_name: string;
    job_title: string;
    years_of_experience: string;
    skills: string[];
    responsibilities: string[];
    skills_count: number;
    responsibilities_count: number;
  };
  text_info: {
    extracted_text_length: number;
    extracted_text_preview: string;
  };
  embeddings_info: {
    skills_embeddings: number;
    responsibilities_embeddings: number;
    has_title_embedding: boolean;
    has_experience_embedding: boolean;
    embedding_dimension: number;
  };
  structured_info: any;
  processing_metadata: any;
}

// JD types
export interface JDListItem extends BaseDocument {
  job_title: string;
  years_of_experience: string;
  skills_count: number;
  skills: string[];
  responsibilities_count: number;
  text_length: number;
}

export interface JDDataResponse {
  id: string;
  filename: string;
  upload_date: string;
  document_type: "jd";
  job_requirements: {
    job_title: string;
    years_of_experience: string;
    skills: string[];
    responsibilities: string[];
    skills_count: number;
    responsibilities_count: number;
  };
  text_info: {
    extracted_text_length: number;
    extracted_text_preview: string;
  };
  embeddings_info: {
    skills_embeddings: number;
    responsibilities_embeddings: number;
    has_title_embedding: boolean;
    has_experience_embedding: boolean;
    embedding_dimension: number;
  };
  structured_info: any;
  processing_metadata: any;
}

// API Response types
export interface CVListResponse {
  status: string;
  count: number;
  cvs: CVListItem[];
  /** Present when using pagination (limit/offset) */
  total?: number;
  limit?: number;
  offset?: number;
}

export interface JDListResponse {
  status: string;
  count: number;
  jds: JDListItem[];
  /** Present when using pagination (limit/offset) */
  total?: number;
  limit?: number;
  offset?: number;
}

export interface UploadResponse {
  status: string;
  message: string;
  cv_id?: string;
  jd_id?: string;
  filename: string;
  standardized_data: any;
  processing_stats: {
    text_length: number;
    skills_count: number;
    responsibilities_count: number;
    embeddings_generated: number;
  };
}

export interface StandardizeResponse {
  status: string;
  message: string;
  filename: string;
  standardized_data: any;
  processing_stats: {
    input_text_length: number;
    skills_count: number;
    responsibilities_count: number;
    embeddings_info: {
      skills_count: number;
      responsibilities_count: number;
      vector_dimension: number;
    };
  };
}

// Matching types
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
  type: "skill" | "responsibility";
  jd_index: number;
  jd_item: string;
  cv_index: number;
  cv_item: string;
  score: number;
}

export interface AlternativesItem {
  jd_index: number;
  items: {
    cv_index: number;
    cv_item: string;
    score: number;
  }[];
}

export interface CandidateBreakdown {
  cv_id: string;
  cv_name: string;
  cv_job_title: string;
  cv_years: number;
  skills_score: number;
  responsibilities_score: number;
  job_title_score: number;
  years_score: number;
  overall_score: number;
  /** Added when LLM enhancement is enabled server-side */
  has_llm_analysis?: boolean;
  /** Stored semantic score before LLM adjustment (server may attach dynamically) */
  semantic_score?: number;
  /** Arbitrary LLM analysis payload */
  llm_analysis?: any;
  skills_assignments: AssignmentItem[];
  responsibilities_assignments: AssignmentItem[];
  skills_alternatives: AlternativesItem[];
  responsibilities_alternatives: AlternativesItem[];
}

export interface MatchResponse {
  // Queue status fields
  is_queued?: boolean;
  queue_position?: number | null;
  estimated_wait_time?: number | null; // seconds
  message?: string | null;
  jd_id: string;
  jd_job_title: string;
  jd_years: number;
  normalized_weights: MatchWeights;
  candidates: CandidateBreakdown[];
}

// System types
export interface HealthResponse {
  status: string;
  timestamp: number;
  services: {
    qdrant: any;
    embedding: any;
    cache: any;
  };
  environment: {
    openai_key_configured: boolean;
    qdrant_host: string;
    qdrant_port: string;
  };
}

export interface SystemStatsResponse {
  status: string;
  stats: {
    database_stats: {
      total_cvs: number;
      total_jds: number;
      total_documents: number;
    };
    cv_analytics: {
      total_cvs: number;
      avg_skills_per_cv: number;
      max_skills_per_cv: number;
      min_skills_per_cv: number;
    };
    jd_analytics: {
      total_jds: number;
      avg_skills_per_jd: number;
      max_skills_per_jd: number;
      min_skills_per_jd: number;
    };
    cache_stats: any;
    system_info: {
      embedding_model: string;
      embedding_dimension: number;
      llm_model: string;
      similarity_metric: string;
    };
  };
  timestamp: number;
}

export interface DatabaseStatusResponse {
  status: string;
  collections: {
    name: string;
    points_count: number;
    vector_config: any;
    status: string;
    indexed_vectors_count: number;
  }[];
  total_collections: number;
  timestamp: number;
}

export interface EmbeddingsInfoResponse {
  status: string;
  embeddings_info: {
    [key: string]: {
      embeddings_found: boolean;
      skills: { count: number; embedding_dimension: number };
      responsibilities: { count: number; embedding_dimension: number };
      title_embedding: boolean;
      experience_embedding: boolean;
      total_embeddings: number;
    };
  };
  embedding_model: string;
  vector_dimensions: number;
  distance_metric: string;
  timestamp: number;
}


export interface DatabaseViewResponse {
  success: boolean;
  data: {
    cvs: any[];
    jds: any[];
    summary: {
      total_documents: number;
      total_cvs: number;
      total_jds: number;
      avg_cv_skills: number;
      avg_jd_skills: number;
      ready_for_matching: boolean;
    };
  };
  timestamp: number;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: 'admin' | 'user';
}

export interface VerifyPasswordRequest {
  username: string;
  password: string;
}

export interface VerifyPasswordResponse {
  success: boolean;
  requires_otp: boolean;  // True for regular users, False for admin
  message: string;
}

export interface SendOTPRequest {
  username: string;
  password: string;  // Still verify password for security
}

export interface VerifyOTPRequest {
  username: string;  // Username instead of email
  otp: string;
}

export interface OTPResponse {
  message: string;
  success: boolean;
  masked_email?: string;  // Masked email for display (e.g., "syed****@example.com")
}

export interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp';
  is_active: boolean;
  team_location?: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp';
  is_active: boolean;
  email?: string;
  otp_mode?: 'real' | 'fixed';
  team_location?: string | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;  // Required for non-admin users
  role: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp';
  otp_mode?: 'real' | 'fixed';
  team_location?: string | null;
}

export interface UpdateUserRequest {
  password?: string;
  email?: string;
  role?: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp';
  is_active?: boolean;
  otp_mode?: 'real' | 'fixed';
  team_location?: string | null;
}

// Candidate Tracker types
export interface TrackerJobOpening {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  client?: string | null;
  work_location?: string | null;
  status: string;
  hiring_manager?: string | null;
  recruitment_manager?: string | null;
  req_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerCandidate {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerApplication {
  id: string;
  candidate_id: string;
  job_opening_id: string;
  applied_date?: string | null;
  position?: string | null;
  client?: string | null;
  location?: string | null;
  status: string;
  recruiter?: string | null;
  account_manager?: string | null;
  recruitment_manager?: string | null;
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerCandidateRow {
  candidate: TrackerCandidate;
  application?: TrackerApplication | null;
}

export interface TrackerOption {
  id: string;
  kind: string;
  value: string;
  email?: string | null;
  email_enabled?: boolean;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackerSkill {
  id: string;
  name: string;
  created_at: string;
}

export interface TrackerDocument {
  id: string;
  candidate_id: string;
  label: string;
  url?: string | null;
  storage_key?: string | null;
  doc_type?: string | null;
  created_at: string;
}

export interface TrackerFollowUp {
  id: string;
  client_name: string;
  position?: string | null;
  recruiter_name?: string | null;
  account_manager?: string | null;
  recruitment_manager?: string | null;
  cv_submitted_date?: string | null;
  current_stage: string;
  last_follow_up_date?: string | null;
  next_follow_up_date?: string | null;
  interview_date?: string | null;
  client_feedback?: string | null;
  interview_feedback?: string | null;
  remarks?: string | null;
  reminder_last_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeaturesResponse {
  enable_candidate_tracker: boolean;
  allowed_roles: string[];
  user_role?: string | null;
}

// Careers types
export interface JobPostingResponse {
  job_id: string;
  public_link: string;
  public_token: string; // Added this field
  job_title?: string;
  upload_date: string;
  filename: string;
  is_active: boolean;
  company_name?: string;
  posted_by_user?: string;
  posted_by_role?: string;
  // Email integration fields
  email_subject_id?: string;
  email_subject_template?: string;
}

export interface PublicJobView {
  job_id: string;
  job_title?: string;
  job_location?: string;
  company_name?: string;
  job_description: string;
  upload_date: string;
  requirements?: string[];
  responsibilities?: string[];
  experience_required?: string;
  is_active: boolean;
  posted_by_user?: string;
  posted_by_role?: string;
}

export interface JobApplicationResponse {
  success: boolean;
  application_id: string;
  message: string;
  next_steps?: string;
}

export interface JobPostingListItem {
  job_id: string;
  job_title?: string;
  job_location?: string;
  job_summary?: string;
  key_responsibilities?: string;
  qualifications?: string;
  filename: string;
  upload_date: string;
  is_active: boolean;
  application_count?: number;
  public_token: string; // Already present
  posted_by_user?: string;
  posted_by_role?: string;
  can_edit?: boolean;
  can_delete?: boolean;
  // Email integration fields
  email_subject_id?: string;
  email_subject_template?: string;
}

export interface WeeklyAnalysisReport {
  range: { start_date: string; end_date: string };
  total_jobs_posted: number;
  recruiters_posted: { recruiter: string; jobs_posted: number }[];
  applications_by_recruiter: Record<
    string,
    { job_id: string; job_title: string; applications: number }[]
  >;
}

export interface JobApplicationListItem {
  application_id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  cv_filename: string;
  application_date: string;
  expected_salary?: number;
  years_of_experience?: number;
  match_score?: number;
  status?: string;
  source?: string; // 'email_application' for Naukri/email CVs, 'website' for direct applications
  // Note fields added by backend
  notes?: any[];
  notes_count?: number;
  has_notes?: boolean;
  latest_note?: any;
  latest_note_text?: string;
  latest_note_author?: string;
  latest_note_date?: string;
}

// Queue management types removed

// Notes Summary types
export interface NotesSummaryItem {
  cv_id: string;
  has_notes: boolean;
  notes_count: number;
  latest_note: any | null;
}

export interface NotesSummaryResponse {
  status: string;
  summaries: NotesSummaryItem[];
  count: number;
}
