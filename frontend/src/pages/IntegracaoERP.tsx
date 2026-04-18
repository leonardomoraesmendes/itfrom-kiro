import {
  Button,
  makeStyles,
  Text,
  tokens,
} from '@fluentui/react-components';
import { ArrowSyncRegular } from '@fluentui/react-icons';
import type { ERPTransaction, IntegrationKPIs } from '@ap-automation/shared';
import { KPICard } from '../components/KPICard';
import { StatusTable } from '../components/StatusTable';
import { IntegrationBadge } from '../components/IntegrationBadge';
import type { ColumnDefinition } from '../components/StatusTable';

export interface IntegracaoERPProps {
  kpis: IntegrationKPIs;
  transactions: ERPTransaction[];
  canReprocess: boolean;
  onReprocess: (protocoloUnico: string) => void;
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
  emptyState: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXXL,
  },
});

export const IntegracaoERP: React.FC<IntegracaoERPProps> = ({
  kpis,
  transactions,
  canReprocess,
  onReprocess,
}) => {
  const styles = useStyles();

  const columns: ColumnDefinition<ERPTransaction>[] = [
    { key: 'protocoloUnico', label: 'Protocolo' },
    { key: 'erpTransactionId', label: 'ID ERP' },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <IntegrationBadge status={item.status} erpTransactionId={item.erpTransactionId} />
      ),
    },
    {
      key: 'ultimaTentativa',
      label: 'Última tentativa',
      render: (item) => new Date(item.ultimaTentativa).toLocaleString('pt-BR'),
    },
    {
      key: 'motivoErro',
      label: 'Motivo do erro',
      render: (item) => item.motivoErro ? <Text>{item.motivoErro}</Text> : <Text>—</Text>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (item) =>
        item.status === 'erro' ? (
          <Button
            size="small"
            icon={<ArrowSyncRegular />}
            appearance="subtle"
            disabled={!canReprocess}
            onClick={() => onReprocess(item.protocoloUnico)}
            aria-label={`Reprocessar ${item.protocoloUnico}`}
          >
            Reprocessar
          </Button>
        ) : (
          <Text>—</Text>
        ),
    },
  ];

  if (transactions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={400}>Nenhuma transação recente</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiRow} role="region" aria-label="KPIs de integração ERP">
        <KPICard
          value={kpis.totalRegistrados}
          label="Registrados"
          trend="stable"
          severity="success"
        />
        <KPICard
          value={kpis.totalErros}
          label="Erros"
          trend={kpis.totalErros > 0 ? 'up' : 'stable'}
          severity={kpis.totalErros > 0 ? 'danger' : 'success'}
        />
        <KPICard
          value={`${kpis.taxaSucesso.toFixed(1)}%`}
          label="Taxa de sucesso"
          trend={kpis.taxaSucesso >= 95 ? 'up' : 'down'}
          severity={kpis.taxaSucesso >= 95 ? 'success' : kpis.taxaSucesso >= 80 ? 'warning' : 'danger'}
        />
      </div>

      {/* Transactions Table */}
      <StatusTable<ERPTransaction>
        columns={columns}
        data={transactions}
        getRowKey={(item) => item.protocoloUnico}
      />
    </div>
  );
};
