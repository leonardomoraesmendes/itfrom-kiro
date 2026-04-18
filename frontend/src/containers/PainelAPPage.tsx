import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../stores/dashboard';
import { useDocumentsStore } from '../stores/documents';
import { PainelAP } from '../pages/PainelAP';

export const PainelAPPage: React.FC = () => {
  const navigate = useNavigate();
  const { operationalKpis, loading: dashLoading, error: dashError, fetchOperationalKPIs } = useDashboardStore();
  const { documents, loading: docsLoading, error: docsError, fetchDocuments } = useDocumentsStore();

  useEffect(() => {
    fetchOperationalKPIs();
    fetchDocuments({ page: 1, pageSize: 10 });
  }, []);

  const loading = dashLoading || docsLoading;
  const error = dashError || docsError;

  return (
    <PainelAP
      kpis={operationalKpis as any}
      alerts={operationalKpis?.alertasRisco?.map((a: any) => ({
        tipo: a.tipo,
        mensagem: a.mensagem,
        severidade: a.severidade ?? a.criticidade ?? 'media',
      })) ?? []}
      criticalDocs={documents as any}
      loading={loading}
      error={error}
      onRetry={() => {
        fetchOperationalKPIs();
        fetchDocuments({ page: 1, pageSize: 10 });
      }}
      onNavigateToQueue={() => navigate('/fila')}
    />
  );
};
