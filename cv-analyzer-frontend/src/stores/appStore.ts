import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CV, JobDescription, MatchResult, SystemStatus } from '@/lib/api';

interface LoadingState {
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: string;
}

interface AppState {
  // UI State
  isLoading: boolean;
  currentTab: 'upload' | 'database' | 'results';
  
  // Enhanced Loading States
  loadingStates: {
    systemStatus: LoadingState;
    cvList: LoadingState;
    jdList: LoadingState;
    cvUpload: LoadingState;
    jdUpload: LoadingState;
    analysis: LoadingState;
    fileProcessing: LoadingState;
  };
  
  // Data State
  cvs: CV[];
  jobDescriptions: JobDescription[];
  currentJD: JobDescription | null;
  matchResults: MatchResult[];
  systemStatus: SystemStatus | null;
  hasLoadedDatabaseData: boolean;
  
  // Upload State
  uploadProgress: Record<string, number>;
  uploadStatus: Record<string, 'uploading' | 'success' | 'error'>;
  uploadedFiles: File[];
  
  // Analysis State
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStep: string;
  
  // Actions
  setLoading: (loading: boolean) => void;
  setCurrentTab: (tab: 'upload' | 'database' | 'results') => void;
  setCVs: (cvs: CV[]) => void;
  setJobDescriptions: (jds: JobDescription[]) => void;
  setCurrentJD: (jd: JobDescription | null) => void;
  setMatchResults: (results: MatchResult[]) => void;
  setSystemStatus: (status: SystemStatus) => void;
  setHasLoadedDatabaseData: (loaded: boolean) => void;
  
  // Enhanced Loading Actions
  setLoadingState: (
    operation: keyof AppState['loadingStates'], 
    state: Partial<LoadingState>
  ) => void;
  getLoadingState: (operation: keyof AppState['loadingStates']) => LoadingState;
  
  // Upload Actions
  setUploadProgress: (fileId: string, progress: number) => void;
  setUploadStatus: (fileId: string, status: 'uploading' | 'success' | 'error') => void;
  addUploadedFile: (file: File) => void;
  removeUploadedFile: (fileId: string) => void;
  clearUploadedFiles: () => void;
  
  // Analysis Actions
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: number) => void;
  setAnalysisStep: (step: string) => void;
  resetAnalysis: () => void;
  
  // Data Actions
  addCV: (cv: CV) => void;
  removeCV: (cvId: string) => void;
  addJD: (jd: JobDescription) => void;
  removeJD: (jdId: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Initial State
      isLoading: false,
      currentTab: 'upload',
      
      // Initialize loading states
      loadingStates: {
        systemStatus: { isLoading: false, error: null },
        cvList: { isLoading: false, error: null },
        jdList: { isLoading: false, error: null },
        cvUpload: { isLoading: false, error: null },
        jdUpload: { isLoading: false, error: null },
        analysis: { isLoading: false, error: null },
        fileProcessing: { isLoading: false, error: null },
      },
      
      cvs: [],
      jobDescriptions: [],
      currentJD: null,
      matchResults: [],
      systemStatus: null,
      hasLoadedDatabaseData: false,
      uploadProgress: {},
      uploadStatus: {},
      uploadedFiles: [],
      isAnalyzing: false,
      analysisProgress: 0,
      analysisStep: '',

      // UI Actions
      setLoading: (loading) => set({ isLoading: loading }),
      setCurrentTab: (tab) => set({ currentTab: tab }),

      // Data Actions
      setCVs: (cvs) => set({ cvs }),
      setJobDescriptions: (jds) => set({ jobDescriptions: jds }),
      setCurrentJD: (jd) => set({ currentJD: jd }),
      setMatchResults: (results) => set({ matchResults: results }),
      setSystemStatus: (status) => set({ systemStatus: status }),
      setHasLoadedDatabaseData: (loaded) => set({ hasLoadedDatabaseData: loaded }),

      // Enhanced Loading State Actions
      setLoadingState: (operation, state) =>
        set((currentState) => ({
          loadingStates: {
            ...currentState.loadingStates,
            [operation]: {
              ...currentState.loadingStates[operation],
              ...state,
              lastUpdated: new Date().toISOString(),
            },
          },
        })),

      getLoadingState: (operation) => {
        // This will be accessed through the store hook
        return { isLoading: false, error: null };
      },

      // Upload Actions
      setUploadProgress: (fileId, progress) =>
        set((state) => ({
          uploadProgress: { ...state.uploadProgress, [fileId]: progress },
        })),
      
      setUploadStatus: (fileId, status) =>
        set((state) => ({
          uploadStatus: { ...state.uploadStatus, [fileId]: status },
        })),
      
      addUploadedFile: (file) =>
        set((state) => ({
          uploadedFiles: [...state.uploadedFiles, file],
        })),
      
      removeUploadedFile: (fileId) =>
        set((state) => {
          const newUploadProgress = { ...state.uploadProgress };
          const newUploadStatus = { ...state.uploadStatus };
          delete newUploadProgress[fileId];
          delete newUploadStatus[fileId];
          return {
            uploadedFiles: state.uploadedFiles.filter((f) => (f as File & {id?: string}).id !== fileId),
            uploadProgress: newUploadProgress,
            uploadStatus: newUploadStatus,
          };
        }),
      
      clearUploadedFiles: () =>
        set({ uploadedFiles: [], uploadProgress: {}, uploadStatus: {} }),

      // Analysis Actions
      setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      setAnalysisStep: (step) => set({ analysisStep: step }),
      resetAnalysis: () =>
        set({ isAnalyzing: false, analysisProgress: 0, analysisStep: '' }),

      // Data Management Actions
      addCV: (cv) =>
        set((state) => ({
          cvs: [...state.cvs.filter((c) => c.id !== cv.id), cv],
        })),
      
      removeCV: (cvId) =>
        set((state) => ({
          cvs: state.cvs.filter((c) => c.id !== cvId),
        })),
      
      addJD: (jd) =>
        set((state) => ({
          jobDescriptions: [...state.jobDescriptions.filter((j) => j.id !== jd.id), jd],
        })),
      
      removeJD: (jdId) =>
        set((state) => ({
          jobDescriptions: state.jobDescriptions.filter((j) => j.id !== jdId),
        })),
    }),
    {
      name: 'cv-analyzer-store',
    }
  )
);