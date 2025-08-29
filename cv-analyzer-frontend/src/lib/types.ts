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
}

export interface JDListResponse {
  status: string;
  count: number;
  jds: JDListItem[];
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
  skills_assignments: AssignmentItem[];
  responsibilities_assignments: AssignmentItem[];
  skills_alternatives: AlternativesItem[];
  responsibilities_alternatives: AlternativesItem[];
}

export interface MatchResponse {
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

export interface CVDataResponse {
  status: string;
  cv_id: string;
  storage_locations: {
    documents: any;
    structured: any;
    embeddings: any;
  };
  timestamp: number;
}

export interface JDDataResponse {
  status: string;
  jd_id: string;
  storage_locations: {
    documents: any;
    structured: any;
    embeddings: any;
  };
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