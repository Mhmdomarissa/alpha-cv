import { create } from 'zustand';
import { api } from '@/lib/api';
import { 
  JobPostingResponse, 
  JobPostingListItem, 
  JobApplicationListItem,
  PublicJobView,
  JobApplicationResponse
} from '@/lib/types';
import { logger } from '@/lib/logger';

interface CareersState {
  // Job postings
  jobPostings: JobPostingListItem[];
  selectedJob: JobPostingListItem | null;
  
  // Applications
  applications: JobApplicationListItem[];
  
  // Public job viewing
  publicJob: PublicJobView | null;
  
  // CV Data Viewer
  viewingCVData: { cvId: string; filename: string; content: string } | null;
  
  // Loading states
  isLoading: boolean;
  isCreatingJob: boolean;
  isSubmittingApplication: boolean;
  isUpdatingStatus: boolean;
  
  // Error handling
  error: string | null;
}

interface CareersActions {
  // Job posting management
  createJobPosting: (file: File) => Promise<JobPostingResponse | null>;
  createJobPostingWithFormData: (file: File | null, formData: any) => Promise<JobPostingResponse | null>;
  createManualJobPosting: (formData: any) => Promise<JobPostingResponse | null>;
  loadJobPostings: () => Promise<void>;
  selectJob: (job: JobPostingListItem) => void;
  updateJobStatus: (jobId: string, isActive: boolean) => Promise<boolean>;
  
  // Application management
  loadJobApplications: (jobId: string) => Promise<void>;
  matchJobCandidates: (jobId: string, minScore?: number) => Promise<any>;
  convertToMatchResponse: (matchResults: any, jobData: any) => any;
  
  // Public actions (no auth required)
  loadPublicJob: (token: string) => Promise<void>;
  submitApplication: (
    token: string, 
    name: string, 
    email: string, 
    phone: string | undefined, 
    cvFile: File
  ) => Promise<JobApplicationResponse | null>;
  
  // CV Data Viewer
  setViewingCVData: (data: { cvId: string; filename: string; content: string } | null) => void;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

type CareersStore = CareersState & CareersActions;

export const useCareersStore = create<CareersStore>((set, get) => ({
  // Initial state
  jobPostings: [],
  selectedJob: null,
  applications: [],
  publicJob: null,
  viewingCVData: null,
  isLoading: false,
  isCreatingJob: false,
  isSubmittingApplication: false,
  isUpdatingStatus: false,
  error: null,
  
  // Actions
  createJobPosting: async (file: File) => {
    set({ isCreatingJob: true, error: null });
    try {
      logger.info('Creating job posting', { filename: file.name });
      const result = await api.createJobPosting(file);
      
      logger.info('Job posting created successfully', { 
        jobId: result.job_id,
        publicLink: result.public_link 
      });
      
      // Reload job postings to include the new one
      get().loadJobPostings();
      
      set({ isCreatingJob: false });
      return result;
    } catch (error: any) {
      logger.error('Failed to create job posting:', error);
      set({ 
        isCreatingJob: false, 
        error: error.message || 'Failed to create job posting' 
      });
      return null;
    }
  },

  createJobPostingWithFormData: async (file: File | null, formData: any) => {
    console.log('🚀 createJobPostingWithFormData called in store');
    set({ isCreatingJob: true, error: null });
    try {
      logger.info('Creating job posting with form data', { 
        hasFile: !!file,
        jobTitle: formData.jobTitle 
      });
      console.log('📡 Making API call to createJobPostingWithFormData');
      const result = await api.createJobPostingWithFormData(file, formData);
      
      logger.info('Job posting created successfully', { 
        jobId: result.job_id,
        publicLink: result.public_link 
      });
      
      // Reload job postings to include the new one
      get().loadJobPostings();
      
      set({ isCreatingJob: false });
      return result;
    } catch (error: any) {
      logger.error('Failed to create job posting with form data:', error);
      set({ 
        isCreatingJob: false, 
        error: error.message || 'Failed to create job posting' 
      });
      return null;
    }
  },

  createManualJobPosting: async (formData: any) => {
    console.log('🚀 createManualJobPosting called in store');
    set({ isCreatingJob: true, error: null });
    try {
      logger.info('Creating manual job posting', { 
        jobTitle: formData.jobTitle 
      });
      console.log('📡 Making API call to createManualJobPosting');
      const result = await api.createManualJobPosting(formData);
      
      logger.info('Manual job posting created successfully', { 
        jobId: result.job_id,
        publicLink: result.public_link 
      });
      
      // Reload job postings to include the new one
      get().loadJobPostings();
      
      set({ isCreatingJob: false });
      return result;
    } catch (error: any) {
      logger.error('Failed to create manual job posting:', error);
      set({ 
        isCreatingJob: false, 
        error: error.message || 'Failed to create job posting' 
      });
      return null;
    }
  },
  
  // stores/careersStore.ts

// Update the loadJobPostings action
loadJobPostings: async () => {
  set({ isLoading: true, error: null });
  try {
    logger.info('Loading job postings');
    // Pass true to include inactive job postings
    const postings = await api.listJobPostings(true);
    
    logger.info(`Loaded ${postings.length} job postings`);
    set({ jobPostings: postings, isLoading: false });
  } catch (error: any) {
    logger.error('Failed to load job postings:', error);
    set({ 
      isLoading: false, 
      error: error.message || 'Failed to load job postings' 
    });
  }
},
  
  selectJob: (job: JobPostingListItem) => {
    logger.info('Selected job', { jobId: job.job_id, title: job.job_title });
    set({ selectedJob: job });
    // Auto-load applications when job is selected
    get().loadJobApplications(job.job_id);
  },
  
  updateJobStatus: async (jobId: string, isActive: boolean) => {
    set({ isUpdatingStatus: true, error: null });
    try {
      logger.info('Updating job status', { jobId, isActive });
      await api.updateJobStatus(jobId, { is_active: isActive });
      
      // Update the job in the local state
      set((state) => ({
        jobPostings: state.jobPostings.map(job => 
          job.job_id === jobId ? { ...job, is_active: isActive } : job
        ),
        selectedJob: state.selectedJob?.job_id === jobId 
          ? { ...state.selectedJob, is_active: isActive } 
          : state.selectedJob,
        isUpdatingStatus: false
      }));
      
      logger.info('Job status updated successfully', { jobId, isActive });
      return true;
    } catch (error: any) {
      logger.error('Failed to update job status:', error);
      set({ 
        isUpdatingStatus: false, 
        error: error.message || 'Failed to update job status' 
      });
      return false;
    }
  },
  
  loadJobApplications: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      logger.info('Loading applications for job', { jobId });
      const applications = await api.getJobApplications(jobId);
      
      logger.info(`Loaded ${applications.length} applications for job ${jobId}`);
      set({ applications, isLoading: false });
    } catch (error: any) {
      logger.error('Failed to load applications:', error);
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to load applications' 
      });
    }
  },

  matchJobCandidates: async (jobId: string, minScore?: number) => {
    set({ isLoading: true, error: null });
    
    // Set careers matching loading state in app store
    const { useAppStore } = await import('./appStore');
    const appStore = useAppStore.getState();
    appStore.setLoading('careersMatching', true);
    
    try {
      logger.info('Matching candidates for job', { jobId, minScore });
      
      // Get current applications to extract CV IDs
      const currentApplications = get().applications;
      const cvIds = currentApplications.map(app => app.application_id);
      
      if (cvIds.length === 0) {
        throw new Error('No applications found to match');
      }
      
      // Get the job posting details to find the original JD ID
      const jobData = await api.getJobForMatching(jobId);
      let originalJdId = (jobData as any).jd_id || jobId; // Use jd_id if available, fallback to jobId
      
      // If the job posting doesn't have a linked JD, this is a legacy job posting
      if (!(jobData as any).jd_id) {
        logger.warn('Legacy job posting has no linked JD - this should be fixed by updating the job posting', { 
          jobId, 
          jobTitle: jobData.job_title 
        });
        
        // For legacy job postings, try to find a matching JD by title
        const availableJds = await api.listJDs();
        
        // Try multiple matching strategies
        let matchingJd = null;
        
        // Strategy 1: Exact title match
        matchingJd = availableJds.jds?.find((jd: any) => 
          jd.job_title && jobData.job_title && 
          jd.job_title.toLowerCase() === jobData.job_title.toLowerCase()
        );
        
        // Strategy 2: Title contains match
        if (!matchingJd) {
          matchingJd = availableJds.jds?.find((jd: any) => 
            jd.job_title && jobData.job_title && 
            (jd.job_title.toLowerCase().includes(jobData.job_title.toLowerCase()) ||
             jobData.job_title.toLowerCase().includes(jd.job_title.toLowerCase()))
          );
        }
        
        // Strategy 3: If only one JD available, use it (fallback for test data)
        if (!matchingJd && availableJds.jds?.length === 1) {
          matchingJd = availableJds.jds[0];
          logger.warn('Using only available JD as fallback for legacy job', { 
            jobId, 
            jobTitle: jobData.job_title, 
            fallbackJdTitle: matchingJd.job_title 
          });
        }
        
        // Strategy 4: If multiple JDs available but no match, use the first one (fallback)
        if (!matchingJd && availableJds.jds?.length > 0) {
          matchingJd = availableJds.jds[0];
          logger.warn('Using first available JD as fallback for legacy job (no title match found)', { 
            jobId, 
            jobTitle: jobData.job_title, 
            fallbackJdTitle: matchingJd.job_title,
            totalJds: availableJds.jds.length
          });
        }
        
        if (matchingJd) {
          originalJdId = matchingJd.id;
          logger.info('Found matching JD for legacy job', { 
            jobId, 
            originalJdId, 
            jobTitle: jobData.job_title,
            matchedJdTitle: matchingJd.job_title 
          });
        } else {
          const availableTitles = availableJds.jds?.map((jd: any) => jd.job_title) || [];
          logger.error('No matching JD found for legacy job posting', { 
            jobId, 
            jobTitle: jobData.job_title,
            availableJds: availableTitles,
            totalJds: availableJds.jds?.length || 0
          });
          throw new Error(`No matching job description found for "${jobData.job_title}". Available JDs (${availableJds.jds?.length || 0}): ${availableTitles.join(', ')}`);
        }
      } else {
        logger.info('Using linked JD for matching', { 
          jobId, 
          originalJdId, 
          jobTitle: jobData.job_title 
        });
      }
      
      logger.info('Using JD ID for matching', { jobId, originalJdId });
      
      // Use the existing /match API with the original JD ID
      const matchResults = await api.matchCandidates({
        jd_id: originalJdId,
        cv_ids: cvIds
      });
      
      logger.info(`Matching completed for job ${jobId}`, { 
        totalCandidates: matchResults.candidates.length,
        matchResults: matchResults
      });
      
      // Store match results in app store for display in match tab
      // Import useAppStore dynamically to avoid circular dependency
      const { useAppStore } = await import('./appStore');
      const appStore = useAppStore.getState();
      appStore.setCareersMatchResult(matchResults);
      appStore.setCareersMatchData({
        jobId: originalJdId, // Use the actual JD ID that was used for matching
        jobTitle: get().selectedJob?.job_title || 'Job',
        cvIds: cvIds
      });
      
      // Convert match results back to application format with scores
      const applicationsWithScores = currentApplications.map(app => {
        const candidate = matchResults.candidates.find(c => c.cv_id === app.application_id);
        return {
          ...app,
          match_score: candidate ? candidate.overall_score : undefined,
          skills_score: candidate ? candidate.skills_score : undefined,
          responsibilities_score: candidate ? candidate.responsibilities_score : undefined,
          job_title_score: candidate ? candidate.job_title_score : undefined,
          years_score: candidate ? candidate.years_score : undefined,
          skills_assignments: candidate ? candidate.skills_assignments : [],
          responsibilities_assignments: candidate ? candidate.responsibilities_assignments : [],
          skills_alternatives: candidate ? candidate.skills_alternatives : [],
          responsibilities_alternatives: candidate ? candidate.responsibilities_alternatives : []
        };
      });
      
      // Update applications with match scores
      set((state) => ({
        applications: applicationsWithScores,
        isLoading: false
      }));
      
      // Clear careers matching loading state
      appStore.setLoading('careersMatching', false);
      
      return {
        job_id: jobId,
        job_title: matchResults.jd_job_title,
        total_applications: applicationsWithScores.length,
        matched_applications: applicationsWithScores,
        top_candidates: applicationsWithScores.slice(0, 10)
      };
    } catch (error: any) {
      logger.error('Failed to match candidates:', error);
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to match candidates' 
      });
      
      // Clear careers matching loading state on error
      appStore.setLoading('careersMatching', false);
      
      throw error;
    }
  },

  convertToMatchResponse: (matchResults: any, jobData: any) => {
    // The matchResults from /match API already has the correct format
    // Just need to ensure it has the right structure for the matching page
    logger.info('Converting match results to MatchResponse format', {
      matchResults,
      jobData,
      candidatesCount: matchResults.candidates?.length || 0
    });
    
    const result = {
      jd_id: matchResults.jd_id || jobData.job_id,
      jd_job_title: matchResults.jd_job_title || jobData.title,
      jd_years: matchResults.jd_years || jobData.experience_required || 0,
      normalized_weights: matchResults.normalized_weights || {
        skills: 80,
        responsibilities: 15,
        job_title: 2.5,
        experience: 2.5
      },
      candidates: matchResults.candidates || []
    };
    
    logger.info('Converted MatchResponse', result);
    return result;
  },

  
  // stores/careersStore.ts

loadPublicJob: async (token: string) => {
  set({ isLoading: true, error: null });
  try {
    logger.info('Loading public job', { token: token.substring(0, 8) + '...' });
    const job = await api.getPublicJob(token);
    
    logger.info('Public job loaded successfully', { 
      jobId: job.job_id, 
      title: job.job_title 
    });
    set({ publicJob: job, isLoading: false });
  } catch (error: any) {
    logger.error('Failed to load public job:', error);
    set({ 
      isLoading: false, 
      error: error.message || 'Job not found or no longer available' 
    });
  }
},
  submitApplication: async (token: string, name: string, email: string, phone: string | undefined, cvFile: File) => {
    set({ isSubmittingApplication: true, error: null });
    try {
      logger.info('Submitting job application', { 
        token: token.substring(0, 8) + '...',
        applicantName: name,
        applicantEmail: email,
        cvFileName: cvFile.name
      });
      
      const result = await api.submitJobApplication(token, name, email, phone, cvFile);
      
      logger.info('Application submitted successfully', { 
        applicationId: result.application_id 
      });
      
      set({ isSubmittingApplication: false });
      return result;
    } catch (error: any) {
      logger.error('Failed to submit application:', error);
      set({ 
        isSubmittingApplication: false, 
        error: error.message || 'Failed to submit application' 
      });
      return null;
    }
  },
  
  setViewingCVData: (data: { cvId: string; filename: string; content: string } | null) => {
    set({ viewingCVData: data });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  reset: () => {
    logger.info('Resetting careers store');
    set({
      jobPostings: [],
      selectedJob: null,
      applications: [],
      publicJob: null,
      viewingCVData: null,
      isLoading: false,
      isCreatingJob: false,
      isSubmittingApplication: false,
      isUpdatingStatus: false,
      error: null,
    });
  },
}));