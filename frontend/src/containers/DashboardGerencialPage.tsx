import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { DashboardGerencial } from '../pages/DashboardGerencial';
import type { AuditFilterValues } from '../pages/DashboardGerencial';
import type { ManagementKPIs, AuditEntry, PaginatedResult } from '@ap-automation/shared';

const emptyKpis: ManagementKPIs = {
  previsaoPagamentos30d: [],
  tendenciaVolume: [],
  tendenciaValor: [],
  taxaAutomacao: 0,
  duplicatasEvitadas: 0,
};

export const DashboardGerencialPage: React.FC = () => {
  const [kpis, setKpis] = useState<ManagementKPIs>(emptyKpis);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const auditPageSize = 20;

  const fetchKpis = useCallback(async () => {
    try {
      const data = await apiClient.get<ManagementKPIs>('/dashboard/management');
      setKpis(data);
    } catch {
      // handle
    }
  }, []);

  const fetchAudit = useCallback(async (filters?: Record<string, string | number | undefined>) => {
    try {
      const data = await apiClient.get<PaginatedResult<AuditEntry>>('/dashboard/audit', {
        page: auditPage,
        pageSize: auditPageSize,
        ...filters,
      });
      setAuditEntries(data.items);
      setAuditTotal(data.total);
    } catch {
      // handle
    }
  }, [auditPage]);

  useEffect(() => {
    fetchKpis();
    fetchAudit();
  }, [fetchKpis, fetchAudit]);

  const handleAuditFilter = useCallback((filters: AuditFilterValues) => {
    setAuditPage(1);
    fetchAudit(filters as Record<string, string | number | undefined>);
  }, [fetchAudit]);

  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    try {
      const blob = await apiClient.get<Blob>('/dashboard/export', { format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // handle
    }
  }, []);

  return (
    <DashboardGerencial
      managementKpis={kpis}
      auditEntries={auditEntries}
      auditTotal={auditTotal}
      auditPage={auditPage}
      auditPageSize={auditPageSize}
      onAuditPageChange={setAuditPage}
      onAuditFilter={handleAuditFilter}
      canExport={true}
      onExport={handleExport}
    />
  );
};
