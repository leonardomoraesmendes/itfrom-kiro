import {
  Button,
  Dropdown,
  Option,
  makeStyles,
  Text,
  tokens,
  Badge,
} from '@fluentui/react-components';
import {
  PeopleSwapRegular,
  WrenchRegular,
  WarningRegular,
} from '@fluentui/react-icons';
import type { QueueItem, QueueKPIs, QueueFilters, ProcessStage } from '@ap-automation/shared';
import { KPICard } from '../components/KPICard';
import { StatusTable, SLAChip } from '../components/StatusTable';
import type { ColumnDefinition, SortConfig, SortDirection } from '../components/StatusTable';

export interface FilaOperacionalProps {
  items: QueueItem[];
  kpis: QueueKPIs;
  filters: QueueFilters;
  sort?: SortConfig;
  onFilterChange: (filters: QueueFilters) => void;
  onSort?: (column: string, direction: SortDirection) => void;
  onReassign: (protocoloUnico: string, novoAnalistaId: string) => void;
  onTreat: (protocoloUnico: string) => void;
}

const etapaOptions: { value: ProcessStage; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'captura', label: 'Captura' },
  { value: 'validacao', label: 'Validação' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'integracao_erp', label: 'Integração ERP' },
  { value: 'concluido', label: 'Concluído' },
];

const slaOptions: { value: QueueFilters['slaStatus'] & string; label: string }[] = [
  { value: 'dentro_prazo', label: 'Dentro do prazo' },
  { value: 'alerta', label: 'Alerta' },
  { value: 'vencido', label: 'Vencido' },
];

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
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: '160px',
  },
  actionsCell: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  exceptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXXL,
  },
});

export const FilaOperacional: React.FC<FilaOperacionalProps> = ({
  items,
  kpis,
  filters,
  sort,
  onFilterChange,
  onSort,
  onReassign,
  onTreat,
}) => {
  const styles = useStyles();

  const columns: ColumnDefinition<QueueItem>[] = [
    { key: 'protocoloUnico', label: 'Protocolo', sortable: true },
    { key: 'fornecedor', label: 'Fornecedor', sortable: true },
    {
      key: 'valor',
      label: 'Valor',
      sortable: true,
      render: (item) =>
        `R$ ${(item.valor / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'dataVencimento',
      label: 'Vencimento',
      sortable: true,
      render: (item) => new Date(item.dataVencimento).toLocaleDateString('pt-BR'),
    },
    { key: 'etapaAtual', label: 'Etapa', sortable: true },
    {
      key: 'tempoDecorrido',
      label: 'Tempo na fila',
      sortable: true,
      render: (item) => {
        const hours = Math.floor(item.tempoDecorrido / 60);
        const mins = item.tempoDecorrido % 60;
        return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
      },
    },
    {
      key: 'slaStatus',
      label: 'SLA',
      sortable: true,
      render: (item) => <SLAChip status={item.slaStatus} />,
    },
    {
      key: 'excecao',
      label: 'Exceção',
      render: (item) =>
        item.excecao ? (
          <span className={styles.exceptionRow}>
            <WarningRegular aria-hidden="true" />
            <Badge color="danger" appearance="tint" aria-label={`Exceção: ${item.excecao.motivo}`}>
              {item.excecao.motivo}
            </Badge>
          </span>
        ) : (
          <Text>—</Text>
        ),
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (item) => (
        <span className={styles.actionsCell}>
          <Button
            size="small"
            icon={<PeopleSwapRegular />}
            appearance="subtle"
            onClick={() => onReassign(item.protocoloUnico, '')}
            aria-label={`Reatribuir ${item.protocoloUnico}`}
          >
            Reatribuir
          </Button>
          <Button
            size="small"
            icon={<WrenchRegular />}
            appearance="subtle"
            onClick={() => onTreat(item.protocoloUnico)}
            aria-label={`Tratar ${item.protocoloUnico}`}
          >
            Tratar
          </Button>
        </span>
      ),
    },
  ];

  // Empty state
  if (items.length === 0 && kpis.totalPendente === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={400}>Nenhum item na fila</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiRow} role="region" aria-label="KPIs da fila operacional">
        <KPICard
          value={kpis.totalPendente}
          label="Total pendente"
          trend="stable"
          severity="success"
        />
        <KPICard
          value={kpis.totalVencidos}
          label="Vencidos"
          trend={kpis.totalVencidos > 0 ? 'up' : 'stable'}
          severity={kpis.totalVencidos > 0 ? 'danger' : 'success'}
        />
        <KPICard
          value={kpis.totalAlerta}
          label="Em alerta"
          trend={kpis.totalAlerta > 0 ? 'up' : 'stable'}
          severity={kpis.totalAlerta > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar} role="search" aria-label="Filtros da fila operacional">
        <div className={styles.filterItem}>
          <Text size={200} weight="semibold">Etapa</Text>
          <Dropdown
            placeholder="Todas"
            value={filters.etapa ? etapaOptions.find((o) => o.value === filters.etapa)?.label : undefined}
            selectedOptions={filters.etapa ? [filters.etapa] : []}
            onOptionSelect={(_e, data) => {
              const val = data.optionValue as ProcessStage | undefined;
              onFilterChange({ ...filters, etapa: val || undefined });
            }}
            aria-label="Filtrar por etapa"
          >
            {etapaOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Dropdown>
        </div>

        <div className={styles.filterItem}>
          <Text size={200} weight="semibold">SLA</Text>
          <Dropdown
            placeholder="Todos"
            value={filters.slaStatus ? slaOptions.find((o) => o.value === filters.slaStatus)?.label : undefined}
            selectedOptions={filters.slaStatus ? [filters.slaStatus] : []}
            onOptionSelect={(_e, data) => {
              const val = data.optionValue as QueueFilters['slaStatus'] | undefined;
              onFilterChange({ ...filters, slaStatus: val || undefined });
            }}
            aria-label="Filtrar por status SLA"
          >
            {slaOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Dropdown>
        </div>

        <div className={styles.filterItem}>
          <Text size={200} weight="semibold">Fornecedor</Text>
          <Dropdown
            placeholder="Todos"
            value={filters.fornecedor || undefined}
            selectedOptions={filters.fornecedor ? [filters.fornecedor] : []}
            onOptionSelect={(_e, data) => {
              onFilterChange({ ...filters, fornecedor: data.optionValue || undefined });
            }}
            aria-label="Filtrar por fornecedor"
          >
            {[...new Set(items.map((i) => i.fornecedor))].map((f) => (
              <Option key={f} value={f}>{f}</Option>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Main Table */}
      <StatusTable<QueueItem>
        columns={columns}
        data={items}
        getRowKey={(item) => item.protocoloUnico}
        onSort={onSort}
        currentSort={sort}
      />
    </div>
  );
};
