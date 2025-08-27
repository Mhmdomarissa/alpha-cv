import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  MatchWeights,
  MatchResponse,
  CVListItem,
  JDListItem,
  HealthResponse,
  MatchRequest,
} from '@/lib/types';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

interface AppState {
  // Current tab
  currentTab: 'dashboard' | 'upload' | 'database' | 'match' | 'reports' | 'system';
  
  // Data
  cvs: CVListItem[];
  jds: JDListItem[];
  selectedJD: string | null;
  selectedCVs: string[];
  
  // Matching
  matchWeights: MatchWeights;
  matchResult: MatchResponse | null;
  
  // Health
  systemHealth: HealthResponse | null;
  
  // Loading states
  loadingStates: {
    cvs: LoadingState;
    jds: LoadingState;
    upload: LoadingState;
    matching: LoadingState;
    health: LoadingState;
  };
  
  // Actions
  setCurrentTab: (tab: AppState['currentTab']) => void;
  
  // CV actions
  loadCVs: () => Promise<void>;
  selectCV: (cvId: string) => void;
  deselectCV: (cvId: string) => void;
  selectAllCVs: () => void;
  deselectAllCVs: () => void;
  uploadCVs: (files: File[]) => Promise<void>;
  
  // JD actions
  loadJDs: () => Promise<void>;
  selectJD: (jdId: string | null) => void;
  uploadJD: (file: File) => Promise<void>;
  
  // Matching actions
  setMatchWeights: (weights: Partial<MatchWeights>) => void;
  runMatch: (request?: Partial<MatchRequest>) => Promise<void>;
  clearMatchResult: () => void;
  
  // System actions
  loadSystemHealth: () => Promise<void>;
  
  // Utility actions
  setLoading: (operation: keyof AppState['loadingStates'], loading: boolean, error?: string) => void;
  clearError: (operation: keyof AppState['loadingStates']) => void;
}

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
      cvs: [],
      jds: [],
      selectedJD: null,
      selectedCVs: [],
      matchWeights: defaultWeights,
      matchResult: null,
      systemHealth: null,
      
      loadingStates: {
        cvs: { isLoading: false, error: null },
        jds: { isLoading: false, error: null },
        upload: { isLoading: false, error: null },
        matching: { isLoading: false, error: null },
        health: { isLoading: false, error: null },
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
        }
      },

      // CV actions
      loadCVs: async () => {
        const { setLoading } = get();
        setLoading('cvs', true);
        
        try {
          logger.info('Loading CVs from API');
          const response = await api.listCVs();
          set({ cvs: response.cvs });
          setLoading('cvs', false);
          logger.info(`Loaded ${response.cvs.length} CVs`);
        } catch (error: any) {
          logger.error('Failed to load CVs', error);
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

      uploadCVs: async (files) => {
        const { setLoading, loadCVs } = get();
        setLoading('upload', true);
        
        try {
          logger.info(`Uploading ${files.length} CV files`);
          await api.uploadCV(files);
          
          // Reload CVs after successful upload
          await loadCVs();
          setLoading('upload', false);
          logger.info('CV upload completed successfully');
        } catch (error: any) {
          logger.error('Failed to upload CVs', error);
          setLoading('upload', false, error.message);
        }
      },

      // JD actions
      loadJDs: async () => {
        const { setLoading } = get();
        setLoading('jds', true);
        
        try {
          logger.info('Loading JDs from API');
          const response = await api.listJDs();
          set({ jds: response.jds });
          setLoading('jds', false);
          logger.info(`Loaded ${response.jds.length} JDs`);
        } catch (error: any) {
          logger.error('Failed to load JDs', error);
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
          logger.info('Uploading JD file', { filename: file.name });
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

      // Matching actions
      setMatchWeights: (weights) => {
        set((state) => ({
          matchWeights: { ...state.matchWeights, ...weights },
        }));
      },

      runMatch: async (request = {}) => {
        const { setLoading, selectedJD, selectedCVs, matchWeights } = get();
        setLoading('matching', true);
        
        try {
          if (!selectedJD && !request.jd_text) {
            throw new Error('Please select a job description first');
          }

          const matchRequest: MatchRequest = {
            jd_id: selectedJD || undefined,
            cv_ids: selectedCVs.length > 0 ? selectedCVs : undefined,
            weights: matchWeights,
            top_alternatives: 3,
            ...request,
          };

          logger.info('Starting candidate matching', matchRequest);
          const result = await api.matchCandidates(matchRequest);
          
          set({ matchResult: result });
          setLoading('matching', false);
          logger.info(`Matching completed: ${result.candidates.length} candidates processed`);
        } catch (error: any) {
          logger.error('Failed to run matching', error);
          setLoading('matching', false, error.message);
        }
      },

      clearMatchResult: () => {
        set({ matchResult: null });
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
    }),
    {
      name: 'cv-analyzer-store',
    }
  )
);
