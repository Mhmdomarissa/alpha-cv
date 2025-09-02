import { create } from 'zustand';

export interface QueueItem {
  id: string;
  file: File;
  kind: 'cv' | 'jd'; // Changed from 'type' to 'kind' to match existing usage
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  dbId?: string; // ID returned from successful upload
  name?: string;
  size?: number;
  extractedData?: {
    name?: string;
    jobTitle?: string;
    years?: string;
    skills?: string[];
    responsibilities?: string[];
  };
}

interface UploadQueueStore {
  items: QueueItem[]; // Changed from 'queue' to 'items' to match existing usage
  isProcessing: boolean;
  
  // Actions that match existing usage
  addMany: (kind: 'cv' | 'jd', files: File[]) => void;
  update: (id: string, updates: Partial<QueueItem>) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setProcessing: (processing: boolean) => void;
  
  // Legacy actions for backward compatibility
  addToQueue: (file: File, type: 'cv' | 'jd') => string;
  removeFromQueue: (id: string) => void;
  updateItemStatus: (id: string, status: QueueItem['status'], progress?: number, error?: string, dbId?: string) => void;
  clearCompleted: () => void;
  
  // Getters
  getPendingItems: () => QueueItem[];
  getCompletedItems: () => QueueItem[];
  getErrorItems: () => QueueItem[];
}

export const useUploadQueue = create<UploadQueueStore>((set, get) => ({
  items: [],
  isProcessing: false,
  
  // Main actions that match existing usage
  addMany: (kind: 'cv' | 'jd', files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      kind,
      status: 'pending' as const,
      progress: 0
    }));
    
    set(state => ({
      items: [...state.items, ...newItems]
    }));
  },
  
  update: (id: string, updates: Partial<QueueItem>) => {
    set(state => ({
      items: state.items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  },
  
  remove: (id: string) => {
    set(state => ({
      items: state.items.filter(item => item.id !== id)
    }));
  },
  
  clearAll: () => {
    set({ items: [] });
  },
  
  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },
  
  // Legacy actions for backward compatibility
  addToQueue: (file: File, type: 'cv' | 'jd') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newItem: QueueItem = {
      id,
      file,
      kind: type,
      status: 'pending',
      progress: 0
    };
    
    set(state => ({
      items: [...state.items, newItem]
    }));
    
    return id;
  },
  
  removeFromQueue: (id: string) => {
    get().remove(id);
  },
  
  updateItemStatus: (id: string, status: QueueItem['status'], progress?: number, error?: string, dbId?: string) => {
    get().update(id, { status, progress, error, dbId });
  },
  
  clearCompleted: () => {
    set(state => ({
      items: state.items.filter(item => item.status !== 'completed')
    }));
  },
  
  // Getters
  getPendingItems: () => {
    return get().items.filter(item => item.status === 'pending');
  },
  
  getCompletedItems: () => {
    return get().items.filter(item => item.status === 'completed');
  },
  
  getErrorItems: () => {
    return get().items.filter(item => item.status === 'error');
  }
}));
