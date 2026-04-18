import { create } from 'zustand';
import { apiClient } from '../api/client';

interface QueueItem {
  protocoloUnico: string;
  fornecedor: string;
  valor: number;
  dataVencimento: string;
  etapaAtual: string;
  tempoDecorrido: number;
  slaStatus: 'dentro_prazo' | 'alerta' | 'vencido';
  excecao?: { tipo: string; motivo: string };
  responsavel: string;
}

interface QueueKPIs {
  totalPendente: number;
  vencidos: number;
  emAlerta: number;
}

interface QueueState {
  items: QueueItem[];
  kpis: QueueKPIs | null;
  loading: boolean;
  error: string | null;

  fetchQueue: (analistaId: string, filters?: {
    etapa?: string;
    slaStatus?: 'dentro_prazo' | 'alerta' | 'vencido';
    fornecedor?: string;
  }) => Promise<void>;

  reassignItem: (protocoloUnico: string, novoAnalistaId: string) => Promise<void>;

  fetchKPIs: (analistaId: string) => Promise<void>;
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  kpis: null,
  loading: false,
  error: null,

  fetchQueue: async (analistaId, filters) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.get<{ items: QueueItem[] }>(
        `/queue/${analistaId}`,
        filters as Record<string, string | number | undefined>,
      );
      set({ items: result.items, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reassignItem: async (protocoloUnico, novoAnalistaId) => {
    set({ loading: true, error: null });
    try {
      await apiClient.put(`/queue/reassign/${protocoloUnico}`, { novoAnalistaId });
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  fetchKPIs: async (analistaId) => {
    try {
      const kpis = await apiClient.get<QueueKPIs>(`/queue/kpis/${analistaId}`);
      set({ kpis });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
