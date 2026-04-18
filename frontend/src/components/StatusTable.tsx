import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Button,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  ArrowSortUpRegular,
  ArrowSortDownRegular,
} from '@fluentui/react-icons';

export type SortDirection = 'asc' | 'desc';
export type SLAStatus = 'dentro_prazo' | 'alerta' | 'vencido';

export interface ColumnDefinition<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface StatusTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  onSort?: (column: string, direction: SortDirection) => void;
  currentSort?: SortConfig;
  pagination?: PaginationConfig;
  getRowKey: (item: T) => string;
}

const useStyles = makeStyles({
  container: {
    width: '100%',
  },
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
  },
  sortButton: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontWeight: tokens.fontWeightSemibold,
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
  },
});

const slaConfig: Record<SLAStatus, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  dentro_prazo: { label: 'Dentro do prazo', color: 'success' },
  alerta: { label: 'Alerta', color: 'warning' },
  vencido: { label: 'Vencido', color: 'danger' },
};

export const SLAChip: React.FC<{ status: SLAStatus }> = ({ status }) => {
  const config = slaConfig[status];
  return (
    <Badge color={config.color} appearance="filled" aria-label={`SLA: ${config.label}`}>
      {config.label}
    </Badge>
  );
};

export const StatusChip: React.FC<{ status: string; color?: 'success' | 'warning' | 'danger' | 'informative' }> = ({
  status,
  color = 'informative',
}) => {
  return (
    <Badge color={color} appearance="tint" aria-label={`Status: ${status}`}>
      {status}
    </Badge>
  );
};


export function StatusTable<T>({
  columns,
  data,
  onSort,
  currentSort,
  pagination,
  getRowKey,
}: StatusTableProps<T>) {
  const styles = useStyles();

  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    const newDirection: SortDirection =
      currentSort?.column === columnKey && currentSort.direction === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className={styles.container} role="region" aria-label="Tabela de status">
      <Table aria-label="Tabela de status com ordenação e paginação">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHeaderCell key={col.key}>
                {col.sortable && onSort ? (
                  <button
                    className={styles.sortButton}
                    onClick={() => handleSort(col.key)}
                    aria-label={`Ordenar por ${col.label}`}
                    type="button"
                  >
                    {col.label}
                    {currentSort?.column === col.key &&
                      (currentSort.direction === 'asc' ? (
                        <ArrowSortUpRegular aria-label="Ordem crescente" />
                      ) : (
                        <ArrowSortDownRegular aria-label="Ordem decrescente" />
                      ))}
                  </button>
                ) : (
                  <Text className={styles.headerCell}>{col.label}</Text>
                )}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Text align="center">Nenhum item encontrado</Text>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={getRowKey(item)}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && (
        <nav className={styles.paginationBar} aria-label="Paginação da tabela">
          <Text aria-live="polite">
            Página {pagination.page} de {totalPages}
          </Text>
          <Button
            icon={<ChevronLeftRegular />}
            appearance="subtle"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            aria-label="Página anterior"
          />
          <Button
            icon={<ChevronRightRegular />}
            appearance="subtle"
            disabled={pagination.page >= totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            aria-label="Próxima página"
          />
        </nav>
      )}
    </div>
  );
}
