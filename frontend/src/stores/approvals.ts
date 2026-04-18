import { create } from 'zustand';
import { apiClient } from '../api/client';

interface ApprovalRequest {
  protocoloUnico: string;
  aprovadorDesignado: string;
  alcadaRequerida: number;
  slaLimite: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'devolvido' | 'escalado';
}

interface ApprovalResult {
  protocoloUnico: string;
  status: string;
  aprovadorId: string;
  dataHora: string;
}

interface ApprovalsState {
  currentApproval: ApprovalRequest | null;
  loading: boolean;
  error: string | null;

  submitForApproval: (protocoloUnico: string) => Promise<ApprovalRequest>;

  approve: (protocoloUnico: string, aprovadorId: string, justificativa?: string) => Promise<ApprovalResult>;

  reject: (protocoloUnico: string, aprovadorId: string, justificativa: string) => Promise<ApprovalResult>;

  returnForCorrection: (protocoloUnico: string, aprovadorId: string, justificativa: string) => Promise<ApprovalResult>;
}

export const useApprovalsStore = create<ApprovalsState>((set) => ({
  currentApproval: null,
  loading: false,
  error: null,

  submitForApproval: async (protocoloUnico) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.post<ApprovalRequest>(`/workflow/submit/${protocoloUnico}`);
      set({ currentApproval: result, loading: false });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  approve: async (protocoloUnico, aprovadorId, justificativa) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.post<ApprovalResult>(`/workflow/approve/${protocoloUnico}`, {
        aprovadorId,
        justificativa,
      });
      set({ currentApproval: null, loading: false });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  reject: async (protocoloUnico, aprovadorId, justificativa) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.post<ApprovalResult>(`/workflow/reject/${protocoloUnico}`, {
        aprovadorId,
        justificativa,
      });
      set({ currentApproval: null, loading: false });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  returnForCorrection: async (protocoloUnico, aprovadorId, justificativa) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.post<ApprovalResult>(`/workflow/return/${protocoloUnico}`, {
        aprovadorId,
        justificativa,
      });
      set({ currentApproval: null, loading: false });
      return result;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },
}));
