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
  loadJobPostings: () => Promise<void>;
  selectJob: (job: JobPostingListItem) => void;
  updateJobStatus: (jobId: string, isActive: boolean) => Promise<boolean>;
  
  // Application management
  loadJobApplications: (jobId: string) => Promise<void>;
  
  // Public actions (no auth required)
  loadPublicJob: (token: string) => Promise<void>;
  submitApplication: (
    token: string, 
    name: string, 
    email: string, 
    phone: string | undefined, 
    cvFile: File
  ) => Promise<JobApplicationResponse | null>;
  
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
      isLoading: false,
      isCreatingJob: false,
      isSubmittingApplication: false,
      isUpdatingStatus: false,
      error: null,
    });
  },
}));