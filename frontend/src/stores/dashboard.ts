import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { PaginatedResult } from '@ap-automation/shared';

interface OperationalKPIs {
  volumePorEtapa: Record<string, number>;
  taxaExcecoes: number;
  tempoMedioPorEtapa: Record<string, number>;
  itensVencidosSLA: number;
  alertasRisco: Array<{ tipo: string; mensagem: string; criticidade: string }>;
}

interface ManagementKPIs {
  previsaoPagamentos30d: Array<{ fornecedor: string; valor: number; data: string }>;
  tendenciaVolume: Array<{ periodo: string; valor: number }>;
  tendenciaValor: Array<{ periodo: string; valor: number }>;
  taxaAutomacao: number;
  duplicatasEvitadas: number;
}

interface AuditEntry {
  id: string;
  usuarioId: string;
  tipoAcao: string;
  protocoloUnico?: string;
  dataHora: string;
  justificativa?: string;
}

interface DashboardState {
  operationalKpis: OperationalKPIs | null;
  managementKpis: ManagementKPIs | null;
  auditEntries: AuditEntry[];
  auditTotal: number;
  loading: boolean;
  error: string | null;

  fetchOperationalKPIs: () => Promise<void>;

  fetchManagementKPIs: (filters?: {
    fornecedor?: string;
    centroCusto?: string;
  }) => Promise<void>;

  fetchAuditLog: (filters?: {
    usuarioId?: string;
    tipoAcao?: string;
    protocoloUnico?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<void>;

  exportData: (format: 'csv' | 'pdf', filters?: {
    fornecedor?: string;
    centroCusto?: string;
  }) => Promise<Blob>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  operationalKpis: null,
  managementKpis: null,
  auditEntries: [],
  auditTotal: 0,
  loading: false,
  error: null,

  fetchOperationalKPIs: async () => {
    set({ loading: true, error: null });
    try {
      const kpis = await apiClient.get<OperationalKPIs>('/dashboard/operational');
      set({ operationalKpis: kpis, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchManagementKPIs: async (filters) => {
    set({ loading: true, error: null });
    try {
      const kpis = await apiClient.get<ManagementKPIs>(
        '/dashboard/management',
        filters as Record<string, string | number | undefined>,
      );
      set({ managementKpis: kpis, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchAuditLog: async (filters) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.get<PaginatedResult<AuditEntry>>(
        '/dashboard/audit',
        filters as Record<string, string | number | undefined>,
      );
      set({ auditEntries: result.items, auditTotal: result.total, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  exportData: async (format, filters) => {
    set({ loading: true, error: null });
    try {
      const blob = await apiClient.get<Blob>('/dashboard/export', {
        format,
        ...filters,
      });
      set({ loading: false });
      return blob;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },
}));
