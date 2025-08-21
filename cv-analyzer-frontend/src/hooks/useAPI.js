/**
 * useAPI Hook - Generic API operations hook
 * Single responsibility: Generic API state management and operations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '../services/apiClient';

export const useAPI = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const requestId = useRef(0);

  /**
   * Generic API request function
   */
  const request = useCallback(async (config) => {
    const currentRequestId = ++requestId.current;
    
    setLoading(true);
    setError(null);

    try {
      const { method = 'GET', endpoint, data: requestData, ...options } = config;
      
      let result;
      switch (method.toUpperCase()) {
        case 'GET':
          result = await apiClient.get(endpoint, options);
          break;
        case 'POST':
          result = await apiClient.post(endpoint, requestData, options);
          break;
        case 'PUT':
          result = await apiClient.put(endpoint, requestData, options);
          break;
        case 'DELETE':
          result = await apiClient.delete(endpoint, options);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // Only update state if this is still the latest request
      if (currentRequestId === requestId.current) {
        setData(result);
        return result;
      }
      
      return result;

    } catch (err) {
      // Only update error state if this is still the latest request
      if (currentRequestId === requestId.current) {
        console.error('API request error:', err);
        setError(err.message || 'Request failed');
      }
      throw err;
    } finally {
      // Only update loading state if this is still the latest request
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * GET request shorthand
   */
  const get = useCallback((endpoint, options = {}) => {
    return request({ method: 'GET', endpoint, ...options });
  }, [request]);

  /**
   * POST request shorthand
   */
  const post = useCallback((endpoint, data, options = {}) => {
    return request({ method: 'POST', endpoint, data, ...options });
  }, [request]);

  /**
   * PUT request shorthand
   */
  const put = useCallback((endpoint, data, options = {}) => {
    return request({ method: 'PUT', endpoint, data, ...options });
  }, [request]);

  /**
   * DELETE request shorthand
   */
  const del = useCallback((endpoint, options = {}) => {
    return request({ method: 'DELETE', endpoint, ...options });
  }, [request]);

  /**
   * Upload file shorthand
   */
  const upload = useCallback(async (endpoint, formData, options = {}) => {
    const currentRequestId = ++requestId.current;
    
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.uploadFile(endpoint, formData, options);
      
      if (currentRequestId === requestId.current) {
        setData(result);
        return result;
      }
      
      return result;

    } catch (err) {
      if (currentRequestId === requestId.current) {
        console.error('File upload error:', err);
        setError(err.message || 'Upload failed');
      }
      throw err;
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Clear current state
   */
  const clear = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    requestId.current++;
  }, []);

  /**
   * Retry last request
   */
  const retry = useCallback(() => {
    // This would require storing the last request config
    // For now, just clear the error state
    setError(null);
  }, []);

  /**
   * Check if currently loading
   */
  const isLoading = useCallback(() => loading, [loading]);

  /**
   * Check if has error
   */
  const hasError = useCallback(() => !!error, [error]);

  /**
   * Check if has data
   */
  const hasData = useCallback(() => !!data, [data]);

  return {
    // State
    loading,
    error,
    data,
    
    // Actions
    request,
    get,
    post,
    put,
    del: del,
    upload,
    clear,
    retry,
    
    // Utilities
    isLoading,
    hasError,
    hasData
  };
};

/**
 * useAPIQuery Hook - For data fetching with automatic loading
 */
export const useAPIQuery = (endpoint, options = {}) => {
  const { immediate = true, dependencies = [], ...apiOptions } = options;
  const { get, loading, error, data, clear } = useAPI();

  const fetchData = useCallback(() => {
    if (endpoint) {
      return get(endpoint, apiOptions);
    }
  }, [endpoint, get, ...Object.values(apiOptions)]);

  // Fetch data immediately if requested
  useEffect(() => {
    if (immediate && endpoint) {
      fetchData();
    }
  }, [immediate, fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    clear
  };
};

/**
 * useAPIMutation Hook - For mutations (POST, PUT, DELETE)
 */
export const useAPIMutation = (endpoint, options = {}) => {
  const { method = 'POST', onSuccess, onError, ...apiOptions } = options;
  const { request, loading, error, data, clear } = useAPI();

  const mutate = useCallback(async (mutationData) => {
    try {
      const result = await request({
        method,
        endpoint,
        data: mutationData,
        ...apiOptions
      });
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      if (onError) {
        onError(err);
      }
      throw err;
    }
  }, [request, method, endpoint, onSuccess, onError, ...Object.values(apiOptions)]);

  return {
    mutate,
    loading,
    error,
    data,
    clear
  };
};
