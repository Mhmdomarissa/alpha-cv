import { create } from 'zustand';

export interface QueueItem {
  id: string;
  file: File;
  type: 'cv' | 'jd';
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress?: number;
  error?: string;
  dbId?: string; // ID returned from successful upload
}

interface UploadQueueStore {
  queue: QueueItem[];
  isProcessing: boolean;
  
  // Actions
  addToQueue: (file: File, type: 'cv' | 'jd') => string;
  removeFromQueue: (id: string) => void;
  updateItemStatus: (id: string, status: QueueItem['status'], progress?: number, error?: string, dbId?: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  setProcessing: (processing: boolean) => void;
  
  // Getters
  getPendingItems: () => QueueItem[];
  getCompletedItems: () => QueueItem[];
  getErrorItems: () => QueueItem[];
}

export const useUploadQueue = create<UploadQueueStore>((set, get) => ({
  queue: [],
  isProcessing: false,
  
  addToQueue: (file: File, type: 'cv' | 'jd') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newItem: QueueItem = {
      id,
      file,
      type,
      status: 'pending',
      progress: 0
    };
    
    set(state => ({
      queue: [...state.queue, newItem]
    }));
    
    return id;
  },
  
  removeFromQueue: (id: string) => {
    set(state => ({
      queue: state.queue.filter(item => item.id !== id)
    }));
  },
  
  updateItemStatus: (id: string, status: QueueItem['status'], progress?: number, error?: string, dbId?: string) => {
    set(state => ({
      queue: state.queue.map(item => 
        item.id === id 
          ? { ...item, status, progress, error, dbId }
          : item
      )
    }));
  },
  
  clearCompleted: () => {
    set(state => ({
      queue: state.queue.filter(item => item.status !== 'completed')
    }));
  },
  
  clearAll: () => {
    set({ queue: [] });
  },
  
  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },
  
  getPendingItems: () => {
    return get().queue.filter(item => item.status === 'pending');
  },
  
  getCompletedItems: () => {
    return get().queue.filter(item => item.status === 'completed');
  },
  
  getErrorItems: () => {
    return get().queue.filter(item => item.status === 'error');
  }
}));
