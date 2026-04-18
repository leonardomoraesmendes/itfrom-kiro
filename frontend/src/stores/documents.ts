import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { DocumentoFiscal, DocumentChannel, PaginatedResult } from '@ap-automation/shared';

interface DocumentReceipt {
  protocoloUnico: string;
  dataRecebimento: string;
  canalOrigem: DocumentChannel;
  tipoDocumento: string;
  status: string;
}

interface DocumentsState {
  documents: DocumentoFiscal[];
  totalCount: number;
  loading: boolean;
  error: string | null;

  fetchDocuments: (filters?: {
    status?: string;
    fornecedor?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<void>;

  uploadDocument: (file: {
    fileName: string;
    fileSize: number;
    fileType: string;
    channel: DocumentChannel;
  }) => Promise<DocumentReceipt>;

  uploadBatch: (files: {
    files: Array<{ fileName: string; fileSize: number; fileType: string }>;
    channel: DocumentChannel;
  }) => Promise<DocumentReceipt[]>;
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  documents: [],
  totalCount: 0,
  loading: false,
  error: null,

  fetchDocuments: async (filters) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.get<PaginatedResult<DocumentoFiscal>>('/documents', filters as Record<string, string | number | undefined>);
      set({ documents: result.items, totalCount: result.total, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  uploadDocument: async (payload) => {
    set({ loading: true, error: null });
    try {
      const receipt = await apiClient.post<DocumentReceipt>('/documents', payload);
      set({ loading: false });
      return receipt;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  uploadBatch: async (payload) => {
    set({ loading: true, error: null });
    try {
      const receipts = await apiClient.post<DocumentReceipt[]>('/documents/batch', payload);
      set({ loading: false });
      return receipts;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },
}));
