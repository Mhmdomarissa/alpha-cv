import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  MatchWeights,
  MatchResponse,
  CVListItem,
  JDListItem,
  HealthResponse,
  MatchRequest,
  SystemStatsResponse,
  DatabaseViewResponse,
  // Queue types removed
} from '@/lib/types';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useAuthStore } from './authStore';

interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

interface MatchingProgress {
  totalCVs: number;
  processedCVs: number;
  currentStage: 'initializing' | 'processing' | 'analyzing' | 'scoring' | 'finalizing';
  estimatedTimeRemaining?: number;
  isVisible: boolean;
}

interface AppState {
  // Current tab
  currentTab: 'dashboard' | 'upload' | 'database' | 'match' | 'careers' | 'email' | 'reports' | 'system' | 'performance';
  
  // Database tab state
  databaseActiveTab: 'cvs' | 'jds';
  
  // Data
  cvs: CVListItem[];
  jds: JDListItem[];
  /** Total count from API when using pagination (so UI can show "X of Y") */
  totalCVs: number | null;
  totalJDs: number | null;
  selectedJD: string | null;
  selectedCVs: string[];
  
  // Matching
  matchWeights: MatchWeights;
  matchResult: MatchResponse | null;
  matchingProgress: MatchingProgress;
  
  // Queue state
  matchingQueue: {
    isQueued: boolean;
    queuePosition: number | null;
    estimatedWaitTime: number | null; // seconds
    message: string | null;
  } | null;
  
  // Health
  systemHealth: HealthResponse | null;
  systemStats: SystemStatsResponse | null;
  databaseView: DatabaseViewResponse | null;
  
  // Loading states
  loadingStates: {
    cvs: LoadingState;
    jds: LoadingState;
    upload: LoadingState;
    matching: LoadingState;
    careersMatching: LoadingState;
    health: LoadingState;
    stats: LoadingState;
    database: LoadingState;
    // queue: LoadingState; // removed
  };
  
  // Actions
  setCurrentTab: (tab: AppState['currentTab']) => void;
  setDatabaseActiveTab: (tab: AppState['databaseActiveTab']) => void;
  setCareersMatchResult: (matchResult: MatchResponse) => void;
  setCareersMatchData: (data: { jobId: string; jobTitle: string; cvIds: string[] }) => void;
  
  // CV actions
  loadCVs: () => Promise<void>;
  loadMoreCVs: () => Promise<void>;
  selectCV: (cvId: string) => void;
  deselectCV: (cvId: string) => void;
  selectAllCVs: () => void;
  deselectAllCVs: () => void;
  uploadCV: (file: File) => Promise<void>;
  uploadCVs: (files: File[]) => Promise<void>;
  deleteCV: (cvId: string) => Promise<void>;
  reprocessCV: (cvId: string) => Promise<void>;
  
  // JD actions
  loadJDs: () => Promise<void>;
  loadMoreJDs: () => Promise<void>;
  selectJD: (jdId: string | null) => void;
  uploadJD: (file: File) => Promise<void>;
  deleteJD: (jdId: string) => Promise<void>;
  reprocessJD: (jdId: string) => Promise<void>;
  
  // Matching actions
  setMatchWeights: (weights: Partial<MatchWeights>) => void;
  runMatch: (request?: Partial<MatchRequest>) => Promise<void>;
  clearMatchResult: () => void;
  setMatchingProgress: (progress: Partial<MatchingProgress>) => void;
  hideMatchingProgress: () => void;
  setMatchingQueue: (queue: AppState['matchingQueue']) => void;
  
  // Queue management actions removed
  
  // System actions
  loadSystemHealth: () => Promise<void>;
  loadSystemStats: () => Promise<void>;
  loadDatabaseView: () => Promise<void>;
  clearDatabase: () => Promise<void>;
  
  // Utility actions
  setLoading: (operation: keyof AppState['loadingStates'], loading: boolean, error?: string) => void;
  clearError: (operation: keyof AppState['loadingStates']) => void;
}

/** Page size for CV/JD list API calls to keep responses small and fast */
const LIST_PAGE_SIZE = 200;

const defaultWeights: MatchWeights = {
  skills: 80,
  responsibilities: 15,
  job_title: 2.5,
  experience: 2.5,
};

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentTab: 'dashboard',
      databaseActiveTab: 'cvs',
      cvs: [],
      jds: [],
      totalCVs: null,
      totalJDs: null,
      selectedJD: null,
      selectedCVs: [],
      matchWeights: defaultWeights,
      matchResult: null,
      matchingProgress: {
        totalCVs: 0,
        processedCVs: 0,
        currentStage: 'initializing',
        isVisible: false,
      },
      // Queue state removed
      systemHealth: null,
      systemStats: null,
      databaseView: null,
      
      loadingStates: {
        cvs: { isLoading: false, error: null },
        jds: { isLoading: false, error: null },
        upload: { isLoading: false, error: null },
        matching: { isLoading: false, error: null },
        careersMatching: { isLoading: false, error: null },
        health: { isLoading: false, error: null },
        stats: { isLoading: false, error: null },
        database: { isLoading: false, error: null },
        // queue: { isLoading: false, error: null }, // removed
      },
      
      // Actions
      setCurrentTab: (tab) => {
        set({ currentTab: tab });
        
        // Auto-load data when switching to relevant tabs
        const state = get();
        if (tab === 'database' && state.cvs.length === 0) {
          state.loadCVs();
          state.loadJDs();
        } else if (tab === 'system' && !state.systemHealth) {
          state.loadSystemHealth();
          state.loadSystemStats();
          state.loadDatabaseView();
        }
      },
      
      setDatabaseActiveTab: (tab) => {
        set({ databaseActiveTab: tab });
      },

      setCareersMatchResult: (matchResult) => {
        set({ matchResult });
      },
      
      setCareersMatchData: (data) => {
        set({ 
          selectedJD: data.jobId,
          selectedCVs: data.cvIds
          // Don't clear matchResult - keep the careers matching results
        });
      },
      
      // CV actions
      loadCVs: async () => {
        const { setLoading } = get();
        setLoading('cvs', true);
        
        try {
          logger.info('Loading CVs from API (paginated)');
          const response = await api.listCVs({ limit: LIST_PAGE_SIZE, offset: 0 });
          const total = response.total ?? response.cvs.length;
          set({
            cvs: response.cvs,
            totalCVs: total,
          });
          setLoading('cvs', false);
          logger.info(`Loaded ${response.cvs.length} CVs${total > response.cvs.length ? ` of ${total}` : ''}`);
        } catch (error: any) {
          logger.error('Failed to load CVs', error);
          setLoading('cvs', false, error.message);
        }
      },
      
      loadMoreCVs: async () => {
        const { setLoading, cvs, totalCVs } = get();
        if (totalCVs != null && cvs.length >= totalCVs) return;
        setLoading('cvs', true);
        try {
          const response = await api.listCVs({ limit: LIST_PAGE_SIZE, offset: cvs.length });
          set((s) => ({
            cvs: [...s.cvs, ...response.cvs],
            totalCVs: response.total ?? s.totalCVs ?? s.cvs.length + response.cvs.length,
          }));
          setLoading('cvs', false);
          logger.info(`Loaded more CVs: ${cvs.length + response.cvs.length} total`);
        } catch (error: any) {
          logger.error('Failed to load more CVs', error);
          setLoading('cvs', false, error.message);
        }
      },
      
      selectCV: (cvId) => {
        set((state) => ({
          selectedCVs: state.selectedCVs.includes(cvId)
            ? state.selectedCVs
            : [...state.selectedCVs, cvId],
        }));
      },
      
      deselectCV: (cvId) => {
        set((state) => ({
          selectedCVs: state.selectedCVs.filter(id => id !== cvId),
        }));
      },
      
      selectAllCVs: () => {
        const { cvs } = get();
        set({ selectedCVs: cvs.map(cv => cv.id) });
      },
      
      deselectAllCVs: () => {
        set({ selectedCVs: [] });
      },
      
      uploadCV: async (file) => {
        const { setLoading, loadCVs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Uploading CV file: ${file.name}`);
          await api.uploadCV(file);
          
          // Reload CVs after successful upload
          await loadCVs();
          setLoading('upload', false);
          logger.info('CV upload completed successfully');
        } catch (error: any) {
          logger.error('Failed to upload CV', error);
          setLoading('upload', false, error.message);
        }
      },
      
      uploadCVs: async (files) => {
        const { setLoading, loadCVs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Uploading ${files.length} CV files`);
          for (const file of files) {
            await api.uploadCV(file);
          }
          
          // Reload CVs after successful upload
          await loadCVs();
          setLoading('upload', false);
          logger.info('CV uploads completed successfully');
        } catch (error: any) {
          logger.error('Failed to upload CVs', error);
          setLoading('upload', false, error.message);
        }
      },
      
      deleteCV: async (cvId) => {
        const { setLoading, loadCVs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Deleting CV: ${cvId}`);
          await api.deleteCV(cvId);
          
          // Reload CVs after successful deletion
          await loadCVs();
          setLoading('upload', false);
          logger.info('CV deletion completed successfully');
        } catch (error: any) {
          logger.error('Failed to delete CV', error);
          setLoading('upload', false, error.message);
        }
      },
      
      reprocessCV: async (cvId) => {
        const { setLoading, loadCVs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Reprocessing CV: ${cvId}`);
          await api.reprocessCV(cvId);
          
          // Reload CVs after successful reprocessing
          await loadCVs();
          setLoading('upload', false);
          logger.info('CV reprocessing completed successfully');
        } catch (error: any) {
          logger.error('Failed to reprocess CV', error);
          setLoading('upload', false, error.message);
        }
      },
      
      // JD actions
      loadJDs: async () => {
        const { setLoading } = get();
        setLoading('jds', true);
        
        try {
          logger.info('Loading JDs from API (paginated)');
          const response = await api.listJDs({ limit: LIST_PAGE_SIZE, offset: 0 });
          const total = response.total ?? response.jds.length;
          set({
            jds: response.jds,
            totalJDs: total,
          });
          setLoading('jds', false);
          logger.info(`Loaded ${response.jds.length} JDs${total > response.jds.length ? ` of ${total}` : ''}`);
        } catch (error: any) {
          logger.error('Failed to load JDs', error);
          setLoading('jds', false, error.message);
        }
      },
      
      loadMoreJDs: async () => {
        const { setLoading, jds, totalJDs } = get();
        if (totalJDs != null && jds.length >= totalJDs) return;
        setLoading('jds', true);
        try {
          const response = await api.listJDs({ limit: LIST_PAGE_SIZE, offset: jds.length });
          set((s) => ({
            jds: [...s.jds, ...response.jds],
            totalJDs: response.total ?? s.totalJDs ?? s.jds.length + response.jds.length,
          }));
          setLoading('jds', false);
          logger.info(`Loaded more JDs: ${jds.length + response.jds.length} total`);
        } catch (error: any) {
          logger.error('Failed to load more JDs', error);
          setLoading('jds', false, error.message);
        }
      },
      
      selectJD: (jdId) => {
        set({ selectedJD: jdId });
      },
      
      uploadJD: async (file) => {
        const { setLoading, loadJDs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Uploading JD file: ${file.name}`);
          await api.uploadJD(file);
          
          // Reload JDs after successful upload
          await loadJDs();
          setLoading('upload', false);
          logger.info('JD upload completed successfully');
        } catch (error: any) {
          logger.error('Failed to upload JD', error);
          setLoading('upload', false, error.message);
        }
      },
      
      deleteJD: async (jdId) => {
        const { setLoading, loadJDs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Deleting JD: ${jdId}`);
          await api.deleteJD(jdId);
          
          // Reload JDs after successful deletion
          await loadJDs();
          setLoading('upload', false);
          logger.info('JD deletion completed successfully');
        } catch (error: any) {
          logger.error('Failed to delete JD', error);
          setLoading('upload', false, error.message);
        }
      },
      
      reprocessJD: async (jdId) => {
        const { setLoading, loadJDs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Reprocessing JD: ${jdId}`);
          await api.reprocessJD(jdId);
          
          // Reload JDs after successful reprocessing
          await loadJDs();
          setLoading('upload', false);
          logger.info('JD reprocessing completed successfully');
        } catch (error: any) {
          logger.error('Failed to reprocess JD', error);
          setLoading('upload', false, error.message);
        }
      },
      
      // Matching actions
      setMatchWeights: (weights) => {
        set((state) => ({
          matchWeights: { ...state.matchWeights, ...weights },
        }));
      },
      
      runMatch: async (request = {}) => {
        const { 
          setLoading, 
          selectedJD, 
          selectedCVs, 
          matchWeights, 
          setMatchingProgress, 
          hideMatchingProgress
        } = get();
        
        setLoading('matching', true);
        
        try {
          if (!selectedJD && !request.jd_text) {
            throw new Error('Please select a job description first');
          }
          
          // Start matching directly
          // Use backend default weights (no weights parameter = backend defaults)
          const matchRequest: MatchRequest = {
            jd_id: selectedJD || undefined,
            cv_ids: selectedCVs.length > 0 ? selectedCVs : undefined,
            top_alternatives: 3,
            ...request,
          };
          
          // Initialize progress tracking
          const totalCVs = selectedCVs.length || 0;
          setMatchingProgress({
            totalCVs,
            processedCVs: 0,
            currentStage: 'initializing',
            isVisible: true,
            estimatedTimeRemaining: totalCVs * 2, // Estimate 2 seconds per CV
          });
          
          logger.info('Starting candidate matching', matchRequest);
          
          // Simulate progress updates during matching
          const progressInterval = setInterval(() => {
            const state = get();
            const currentProgress = state.matchingProgress;
            
            if (currentProgress.processedCVs < totalCVs) {
              const newProcessed = Math.min(
                currentProgress.processedCVs + Math.ceil(totalCVs / 10),
                totalCVs
              );
              
              let newStage = currentProgress.currentStage;
              const progressPercent = (newProcessed / totalCVs) * 100;
              
              if (progressPercent < 20) {
                newStage = 'initializing';
              } else if (progressPercent < 40) {
                newStage = 'processing';
              } else if (progressPercent < 70) {
                newStage = 'analyzing';
              } else if (progressPercent < 90) {
                newStage = 'scoring';
              } else {
                newStage = 'finalizing';
              }
              
              setMatchingProgress({
                processedCVs: newProcessed,
                currentStage: newStage,
                estimatedTimeRemaining: Math.max(0, (totalCVs - newProcessed) * 2),
              });
            }
          }, 500);
          
          const result = await api.matchCandidates(matchRequest);
          
          // Check if request was queued
          if (result.is_queued) {
            // Clear progress interval
            clearInterval(progressInterval);
            
            // Set queue state
            set({
              matchingQueue: {
                isQueued: true,
                queuePosition: result.queue_position || null,
                estimatedWaitTime: result.estimated_wait_time || null,
                message: result.message || null,
              }
            });
            
            // Poll for results every 10 seconds
            const pollInterval = setInterval(async () => {
              try {
                const pollResult = await api.matchCandidates(matchRequest);
                
                if (!pollResult.is_queued && pollResult.candidates.length > 0) {
                  // Match completed!
                  clearInterval(pollInterval);
                  clearInterval(progressInterval);
                  hideMatchingProgress();
                  
                  set({
                    matchResult: pollResult,
                    matchingQueue: null,
                  });
                  setLoading('matching', false);
                  logger.info(`Matching completed: ${pollResult.candidates.length} candidates processed`);
                } else if (pollResult.is_queued) {
                  // Still queued, update position
                  set({
                    matchingQueue: {
                      isQueued: true,
                      queuePosition: pollResult.queue_position || null,
                      estimatedWaitTime: pollResult.estimated_wait_time || null,
                      message: pollResult.message || null,
                    }
                  });
                }
              } catch (error) {
                logger.error('Failed to poll matching status', error);
              }
            }, 10000); // Poll every 10 seconds
            
            // Set timeout to stop polling after estimated wait time + buffer
            const maxWaitTime = (result.estimated_wait_time || 600) * 1000 + 60000; // +1 minute buffer
            setTimeout(() => {
              clearInterval(pollInterval);
            }, maxWaitTime);
            
            setLoading('matching', false);
            return;
          }
          
          // Clear progress interval and hide progress bar
          clearInterval(progressInterval);
          hideMatchingProgress();
          
          set({ 
            matchResult: result,
            matchingQueue: null,
          });
          setLoading('matching', false);
          logger.info(`Matching completed: ${result.candidates.length} candidates processed`);
        } catch (error: any) {
          logger.error('Failed to run matching', error);
          hideMatchingProgress();
          // Extract error message from detail (backend) or message (network)
          const errorMessage = error?.detail || error?.response?.data?.detail || error?.message || 'Failed to run matching';
          setLoading('matching', false, errorMessage);
          
          // Queue session completion removed
        }
      },
      
      clearMatchResult: () => {
        set({ matchResult: null });
      },
      
      setMatchingProgress: (progress) => {
        set((state) => ({
          matchingProgress: { ...state.matchingProgress, ...progress },
        }));
      },
      
      hideMatchingProgress: () => {
        set((state) => ({
          matchingProgress: { ...state.matchingProgress, isVisible: false },
        }));
      },
      
      setMatchingQueue: (queue) => {
        set({ matchingQueue: queue });
      },
      
      // System actions
      loadSystemHealth: async () => {
        const { setLoading } = get();
        setLoading('health', true);
        
        try {
          logger.info('Checking system health');
          const health = await api.healthCheck();
          set({ systemHealth: health });
          setLoading('health', false);
          logger.info('System health check completed', { status: health.status });
        } catch (error: any) {
          logger.error('Failed to check system health', error);
          setLoading('health', false, error.message);
        }
      },
      
      loadSystemStats: async () => {
        const { setLoading } = get();
        setLoading('stats', true);
        
        try {
          logger.info('Loading system stats');
          const stats = await api.getSystemStats();
          set({ systemStats: stats });
          setLoading('stats', false);
          logger.info('System stats loaded');
        } catch (error: any) {
          logger.error('Failed to load system stats', error);
          setLoading('stats', false, error.message);
        }
      },
      
      loadDatabaseView: async () => {
        const { setLoading } = get();
        setLoading('database', true);
        
        try {
          logger.info('Loading database view');
          const view = await api.getDatabaseView();
          set({ databaseView: view });
          setLoading('database', false);
          logger.info('Database view loaded');
        } catch (error: any) {
          logger.error('Failed to load database view', error);
          setLoading('database', false, error.message);
        }
      },
      
      clearDatabase: async () => {
        const { setLoading } = get();
        setLoading('database', true);
        
        try {
          logger.info('Clearing database');
          const { token } = useAuthStore.getState();
          if (!token) {
            throw new Error('No authentication token found');
          }
          await api.clearDatabase(token, true);
          
          // Reload data
          const state = get();
          state.loadCVs();
          state.loadJDs();
          state.loadDatabaseView();
          
          setLoading('database', false);
          logger.info('Database cleared successfully');
        } catch (error: any) {
          logger.error('Failed to clear database', error);
          setLoading('database', false, error.message);
        }
      },
      
      // Utility actions
      setLoading: (operation, loading, error) => {
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [operation]: { isLoading: loading, error: error || null },
          },
        }));
      },
      
      clearError: (operation) => {
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [operation]: { ...state.loadingStates[operation], error: null },
          },
        }));
      },
      
      // Queue management actions removed
    }),
    {
      name: 'cv-analyzer-store',
    }
  )
);