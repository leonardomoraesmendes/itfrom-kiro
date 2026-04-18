import {
  Button,
  Input,
  makeStyles,
  Select,
  Text,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
} from '@fluentui/react-icons';
import type {
  AuditActionType,
  AuditEntry,
  ManagementKPIs,
  PaymentForecast,
} from '@ap-automation/shared';
import { KPICard } from '../components/KPICard';
import { StatusTable } from '../components/StatusTable';
import type { ColumnDefinition } from '../components/StatusTable';

export interface AuditFilterValues {
  periodoInicio?: string;
  periodoFim?: string;
  usuarioId?: string;
  tipoAcao?: AuditActionType | '';
  protocoloUnico?: string;
}

export interface DashboardGerencialProps {
  managementKpis: ManagementKPIs;
  auditEntries: AuditEntry[];
  auditTotal: number;
  auditPage: number;
  auditPageSize: number;
  onAuditPageChange: (page: number) => void;
  onAuditFilter: (filters: AuditFilterValues) => void;
  canExport: boolean;
  onExport: (format: 'csv' | 'pdf') => void;
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
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  exportRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  forecastTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  forecastTh: {
    textAlign: 'left' as const,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    fontWeight: tokens.fontWeightSemibold,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  forecastTd: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXXL,
  },
});

const AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  documento_recebido: 'Documento recebido',
  extracao_concluida: 'Extração concluída',
  campo_corrigido: 'Campo corrigido',
  validacao_executada: 'Validação executada',
  duplicata_liberada: 'Duplicata liberada',
  duplicata_rejeitada: 'Duplicata rejeitada',
  aprovacao: 'Aprovação',
  rejeicao: 'Rejeição',
  devolucao: 'Devolução',
  override_validacao: 'Override de validação',
  registro_erp: 'Registro ERP',
  reprocessamento_erp: 'Reprocessamento ERP',
  alteracao_configuracao: 'Alteração de configuração',
  violacao_sod_bloqueada: 'Violação SoD bloqueada',
};

function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

export const DashboardGerencial: React.FC<DashboardGerencialProps> = ({
  managementKpis,
  auditEntries,
  auditTotal,
  auditPage,
  auditPageSize,
  onAuditPageChange,
  onAuditFilter,
  canExport,
  onExport,
}) => {
  const styles = useStyles();

  const total30d = managementKpis.previsaoPagamentos30d.reduce(
    (sum, f) => sum + f.valorPrevisto,
    0,
  );

  const auditColumns: ColumnDefinition<AuditEntry>[] = [
    {
      key: 'dataHora',
      label: 'Data/Hora',
      render: (item) => new Date(item.dataHora).toLocaleString('pt-BR'),
    },
    { key: 'usuarioId', label: 'Usuário' },
    {
      key: 'tipoAcao',
      label: 'Tipo de Ação',
      render: (item) => AUDIT_ACTION_LABELS[item.tipoAcao] ?? item.tipoAcao,
    },
    {
      key: 'protocoloUnico',
      label: 'Documento',
      render: (item) => item.protocoloUnico ?? '—',
    },
    {
      key: 'justificativa',
      label: 'Justificativa',
      render: (item) => item.justificativa ?? '—',
    },
  ];

  const forecastData: PaymentForecast[] = managementKpis.previsaoPagamentos30d;

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiRow} role="region" aria-label="KPIs gerenciais">
        <KPICard
          value={`${managementKpis.taxaAutomacao.toFixed(1)}%`}
          label="Taxa de automação"
          trend={managementKpis.taxaAutomacao >= 70 ? 'up' : 'down'}
          severity={managementKpis.taxaAutomacao >= 70 ? 'success' : managementKpis.taxaAutomacao >= 50 ? 'warning' : 'danger'}
        />
        <KPICard
          value={managementKpis.duplicatasEvitadas}
          label="Duplicatas evitadas"
          trend={managementKpis.duplicatasEvitadas > 0 ? 'up' : 'stable'}
          severity="success"
        />
        <KPICard
          value={formatCurrency(total30d)}
          label="Previsão 30 dias"
          trend="stable"
          severity="warning"
        />
      </div>

      {/* Payment Forecast Section */}
      <section aria-label="Previsão de pagamentos">
        <Text className={styles.sectionTitle} as="h2">Previsão de Pagamentos</Text>
        {forecastData.length === 0 ? (
          <div className={styles.emptyState}>
            <Text>Sem previsões para o período</Text>
          </div>
        ) : (
          <table className={styles.forecastTable} aria-label="Tabela de previsão de pagamentos">
            <thead>
              <tr>
                <th className={styles.forecastTh}>Fornecedor</th>
                <th className={styles.forecastTh}>Centro de Custo</th>
                <th className={styles.forecastTh}>Valor Previsto</th>
                <th className={styles.forecastTh}>Data Previsão</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.map((f, idx) => (
                <tr key={`${f.fornecedor}-${f.centroCusto}-${idx}`}>
                  <td className={styles.forecastTd}>{f.fornecedor}</td>
                  <td className={styles.forecastTd}>{f.centroCusto}</td>
                  <td className={styles.forecastTd}>{formatCurrency(f.valorPrevisto)}</td>
                  <td className={styles.forecastTd}>{new Date(f.dataPrevisao).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Audit Log Section */}
      <section aria-label="Trilha de auditoria">
        <Text className={styles.sectionTitle} as="h2">Trilha de Auditoria</Text>

        {/* Filters */}
        <div className={styles.filterRow} role="search" aria-label="Filtros de auditoria">
          <div className={styles.filterField}>
            <label htmlFor="filter-periodo-inicio">Período início</label>
            <Input
              id="filter-periodo-inicio"
              type="date"
              onChange={(_e, data) =>
                onAuditFilter({ periodoInicio: data.value || undefined })
              }
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-periodo-fim">Período fim</label>
            <Input
              id="filter-periodo-fim"
              type="date"
              onChange={(_e, data) =>
                onAuditFilter({ periodoFim: data.value || undefined })
              }
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-usuario">Usuário</label>
            <Input
              id="filter-usuario"
              placeholder="ID do usuário"
              onChange={(_e, data) =>
                onAuditFilter({ usuarioId: data.value || undefined })
              }
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-tipo-acao">Tipo de ação</label>
            <Select
              id="filter-tipo-acao"
              onChange={(_e, data) =>
                onAuditFilter({ tipoAcao: (data.value as AuditActionType) || '' })
              }
            >
              <option value="">Todos</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-documento">Documento</label>
            <Input
              id="filter-documento"
              placeholder="Protocolo único"
              onChange={(_e, data) =>
                onAuditFilter({ protocoloUnico: data.value || undefined })
              }
            />
          </div>
        </div>

        {/* Audit Table */}
        <StatusTable<AuditEntry>
          columns={auditColumns}
          data={auditEntries}
          getRowKey={(item) => item.id}
          pagination={{
            page: auditPage,
            pageSize: auditPageSize,
            total: auditTotal,
            onPageChange: onAuditPageChange,
          }}
        />
      </section>

      {/* Export Buttons */}
      <div className={styles.exportRow} role="group" aria-label="Exportação de dados">
        <Button
          icon={<ArrowDownloadRegular />}
          appearance="primary"
          disabled={!canExport}
          onClick={() => onExport('csv')}
          aria-label="Exportar CSV"
        >
          Exportar CSV
        </Button>
        <Button
          icon={<ArrowDownloadRegular />}
          appearance="secondary"
          disabled={!canExport}
          onClick={() => onExport('pdf')}
          aria-label="Exportar PDF"
        >
          Exportar PDF
        </Button>
      </div>
    </div>
  );
};
