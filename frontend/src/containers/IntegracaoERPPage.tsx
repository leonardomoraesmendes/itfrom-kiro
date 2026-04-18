import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { IntegracaoERP } from '../pages/IntegracaoERP';
import type { IntegrationKPIs, ERPTransaction } from '@ap-automation/shared';

export const IntegracaoERPPage: React.FC = () => {
  const [kpis, setKpis] = useState<IntegrationKPIs>({
    totalRegistrados: 0,
    totalErros: 0,
    totalReprocessando: 0,
    taxaSucesso: 0,
  });
  const [transactions, setTransactions] = useState<ERPTransaction[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [kpisData, txData] = await Promise.all([
        apiClient.get<IntegrationKPIs>('/erp/kpis'),
        apiClient.get<{ items: ERPTransaction[] }>('/erp/transactions'),
      ]);
      setKpis(kpisData);
      setTransactions(txData.items ?? []);
    } catch {
      // silently handle
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReprocess = useCallback(async (protocoloUnico: string) => {
    try {
      await apiClient.post(`/erp/reprocess/${protocoloUnico}`);
      await fetchData();
    } catch {
      // handle error
    }
  }, [fetchData]);

  return (
    <IntegracaoERP
      kpis={kpis}
      transactions={transactions}
      canReprocess={true}
      onReprocess={handleReprocess}
    />
  );
};
