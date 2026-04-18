import {
  Button,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Text,
  tokens,
  Skeleton,
  SkeletonItem,
} from '@fluentui/react-components';
import { ArrowRightRegular } from '@fluentui/react-icons';
import type { OperationalKPIs, Alert, DocumentoFiscal } from '@ap-automation/shared';
import { KPICard } from '../components/KPICard';
import type { KPICardProps } from '../components/KPICard';
import { AlertsPanel } from '../components/AlertsPanel';
import type { AlertItem } from '../components/AlertsPanel';
import { StatusTable } from '../components/StatusTable';
import type { ColumnDefinition } from '../components/StatusTable';
import { SLAChip } from '../components/StatusTable';

export interface PainelAPProps {
  kpis: OperationalKPIs | null;
  alerts: Alert[];
  criticalDocs: DocumentoFiscal[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigateToQueue: () => void;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  kpiRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  skeletonRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  skeletonCard: {
    width: '200px',
    height: '100px',
  },
  skeletonTable: {
    width: '100%',
    height: '200px',
  },
  ctaSection: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXXL,
  },
});

function mapAlertsToPanel(alerts: Alert[]): AlertItem[] {
  return alerts.map((a) => ({
    tipo: a.tipo,
    mensagem: a.mensagem,
    severidade: a.severidade,
    protocoloUnico: a.protocoloUnico,
  }));
}

function buildKpiCards(kpis: OperationalKPIs): KPICardProps[] {
  const totalRecebidos = Object.values(kpis.volumePorEtapa).reduce((s, v) => s + v, 0);
  const pendentesAprovacao = kpis.volumePorEtapa.aprovacao ?? 0;
  const vencidosSLA = kpis.itensVencidosSLA;
  const valorPipeline = Object.values(kpis.tempoMedioPorEtapa).reduce((s, v) => s + v, 0);

  return [
    {
      value: totalRecebidos,
      label: 'Documentos recebidos',
      trend: 'stable' as const,
      severity: 'success' as const,
    },
    {
      value: pendentesAprovacao,
      label: 'Pendentes aprovação',
      trend: pendentesAprovacao > 0 ? ('up' as const) : ('stable' as const),
      severity: pendentesAprovacao > 10 ? 'warning' : 'success',
    },
    {
      value: vencidosSLA,
      label: 'Vencidos SLA',
      trend: vencidosSLA > 0 ? ('up' as const) : ('stable' as const),
      severity: vencidosSLA > 0 ? 'danger' : 'success',
    },
    {
      value: `R$ ${(valorPipeline / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      label: 'Valor total pipeline',
      trend: 'stable' as const,
      severity: 'success' as const,
    },
  ];
}

const criticalDocColumns: ColumnDefinition<DocumentoFiscal>[] = [
  { key: 'protocoloUnico', label: 'Protocolo', sortable: true },
  { key: 'cnpjEmitente', label: 'Fornecedor (CNPJ)' },
  {
    key: 'valorTotal',
    label: 'Valor',
    render: (doc) =>
      `R$ ${(doc.valorTotal / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  },
  {
    key: 'dataVencimento',
    label: 'Vencimento',
    sortable: true,
    render: (doc) => new Date(doc.dataVencimento).toLocaleDateString('pt-BR'),
  },
  { key: 'status', label: 'Status', render: (doc) => doc.status },
];

export const PainelAP: React.FC<PainelAPProps> = ({
  kpis,
  alerts,
  criticalDocs,
  loading,
  error,
  onRetry,
  onNavigateToQueue,
}) => {
  const styles = useStyles();

  // Error state
  if (error) {
    return (
      <div className={styles.container} role="alert">
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
          <MessageBarActions>
            <Button onClick={onRetry}>Tentar novamente</Button>
          </MessageBarActions>
        </MessageBar>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={styles.container} aria-busy="true" aria-label="Carregando painel">
        <Skeleton>
          <div className={styles.skeletonRow}>
            <SkeletonItem className={styles.skeletonCard} />
            <SkeletonItem className={styles.skeletonCard} />
            <SkeletonItem className={styles.skeletonCard} />
            <SkeletonItem className={styles.skeletonCard} />
          </div>
        </Skeleton>
        <Skeleton>
          <SkeletonItem className={styles.skeletonTable} />
        </Skeleton>
      </div>
    );
  }

  // Empty state
  if (!kpis && criticalDocs.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={400}>Nenhum documento no pipeline</Text>
        </div>
      </div>
    );
  }

  const kpiCards = kpis ? buildKpiCards(kpis) : [];

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      {kpiCards.length > 0 && (
        <div className={styles.kpiRow} role="region" aria-label="Indicadores operacionais">
          {kpiCards.map((card) => (
            <KPICard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && <AlertsPanel alerts={mapAlertsToPanel(alerts)} />}

      {/* Critical Documents Table */}
      {criticalDocs.length > 0 && (
        <StatusTable<DocumentoFiscal>
          columns={criticalDocColumns}
          data={criticalDocs}
          getRowKey={(doc) => doc.protocoloUnico}
        />
      )}

      {/* CTA */}
      <div className={styles.ctaSection}>
        <Button
          appearance="primary"
          icon={<ArrowRightRegular />}
          iconPosition="after"
          onClick={onNavigateToQueue}
        >
          Ir para Fila Operacional
        </Button>
      </div>
    </div>
  );
};
