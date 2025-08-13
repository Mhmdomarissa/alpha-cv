/**
 * Custom hook for managing loading states with enhanced functionality
 */

import { useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

type LoadingOperation = 
  | 'systemStatus'
  | 'cvList'
  | 'jdList'
  | 'cvUpload'
  | 'jdUpload'
  | 'analysis'
  | 'fileProcessing';

interface LoadingState {
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: string;
}

export const useLoadingState = (operation: LoadingOperation) => {
  const { loadingStates, setLoadingState } = useAppStore();
  
  const currentState = loadingStates[operation];
  
  const setLoading = useCallback((isLoading: boolean) => {
    setLoadingState(operation, { isLoading, error: null });
  }, [operation, setLoadingState]);
  
  const setError = useCallback((error: string | null) => {
    setLoadingState(operation, { isLoading: false, error });
  }, [operation, setLoadingState]);
  
  const setSuccess = useCallback(() => {
    setLoadingState(operation, { isLoading: false, error: null });
  }, [operation, setLoadingState]);
  
  const reset = useCallback(() => {
    setLoadingState(operation, { isLoading: false, error: null });
  }, [operation, setLoadingState]);

  return {
    ...currentState,
    setLoading,
    setError,
    setSuccess,
    reset,
  };
};

/**
 * Hook for managing async operations with loading states
 */
export const useAsyncOperation = (operation: LoadingOperation) => {
  const { setLoading, setError, setSuccess, ...state } = useLoadingState(operation);
  
  const executeOperation = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options?: {
      onSuccess?: (result: T) => void;
      onError?: (error: unknown) => void;
      suppressErrorLogging?: boolean;
    }
  ): Promise<T | null> => {
    try {
      setLoading(true);
      const result = await asyncFn();
      setSuccess();
      options?.onSuccess?.(result);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      
      if (!options?.suppressErrorLogging) {
        console.error(`[${operation}] Operation failed:`, error);
      }
      
      options?.onError?.(error);
      return null;
    }
  }, [operation, setLoading, setError, setSuccess]);

  return {
    ...state,
    executeOperation,
    setLoading,
    setError,
    setSuccess,
  };
};

/**
 * Hook for tracking multiple loading states
 */
export const useMultipleLoadingStates = (operations: LoadingOperation[]) => {
  const { loadingStates } = useAppStore();
  
  const isAnyLoading = operations.some(op => loadingStates[op].isLoading);
  const hasAnyError = operations.some(op => loadingStates[op].error);
  const errors = operations
    .map(op => loadingStates[op].error)
    .filter(Boolean) as string[];
  
  return {
    isAnyLoading,
    hasAnyError,
    errors,
    states: operations.reduce((acc, op) => {
      acc[op] = loadingStates[op];
      return acc;
    }, {} as Record<LoadingOperation, LoadingState>),
  };
};