// stores/uploadQueue.ts
import { create } from 'zustand';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ExtractedData {
  name?: string;
  jobTitle?: string;
  years?: string;
  skills?: string[];
  responsibilities?: string[];
}

export interface FilePreview {
  file?: File;
  name: string;
  size?: number;
  id: string;
  status: FileStatus;
  extractedData?: ExtractedData;
  error?: string;
  kind: 'cv' | 'jd';
  dbId?: string; // Add this to track database ID after upload
}

interface UploadQueueState {
  items: FilePreview[];
  addMany: (kind: 'cv' | 'jd', files: File[]) => void;
  update: (id: string, patch: Partial<FilePreview>) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

export const useUploadQueue = create<UploadQueueState>()((set, get) => ({
  items: [],
  addMany: (kind, files) =>
    set((state) => ({
      items: [
        ...state.items,
        ...files.map((file) => ({
          id: Math.random().toString(36).slice(2, 11),
          file,
          name: file.name,
          size: file.size,
          status: 'pending' as FileStatus,
          kind,
        })),
      ],
    })),
  update: (id, patch) =>
    set((state) => ({
      items: state.items.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ),
    })),
  remove: (id) =>
    set((state) => ({
      items: state.items.filter((it) => it.id !== id),
    })),
  clearAll: () => set({ items: [] }),
}));