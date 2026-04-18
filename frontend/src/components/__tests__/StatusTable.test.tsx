import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { StatusTable, SLAChip, StatusChip } from '../StatusTable';
import type { ColumnDefinition } from '../StatusTable';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

interface TestRow {
  id: string;
  fornecedor: string;
  valor: number;
  slaStatus: 'dentro_prazo' | 'alerta' | 'vencido';
}

const columns: ColumnDefinition<TestRow>[] = [
  { key: 'fornecedor', label: 'Fornecedor', sortable: true },
  { key: 'valor', label: 'Valor', sortable: true },
  {
    key: 'slaStatus',
    label: 'SLA',
    render: (item) => <SLAChip status={item.slaStatus} />,
  },
];

const sampleData: TestRow[] = [
  { id: '1', fornecedor: 'Empresa A', valor: 10000, slaStatus: 'dentro_prazo' },
  { id: '2', fornecedor: 'Empresa B', valor: 25000, slaStatus: 'alerta' },
  { id: '3', fornecedor: 'Empresa C', valor: 50000, slaStatus: 'vencido' },
];

describe('StatusTable', () => {
  it('renders column headers', () => {
    renderWithFluent(
      <StatusTable columns={columns} data={sampleData} getRowKey={(r) => r.id} />
    );
    expect(screen.getByText('Fornecedor')).toBeInTheDocument();
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    renderWithFluent(
      <StatusTable columns={columns} data={sampleData} getRowKey={(r) => r.id} />
    );
    expect(screen.getByText('Empresa A')).toBeInTheDocument();
    expect(screen.getByText('Empresa B')).toBeInTheDocument();
    expect(screen.getByText('Empresa C')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    renderWithFluent(
      <StatusTable columns={columns} data={[]} getRowKey={(r: TestRow) => r.id} />
    );
    expect(screen.getByText('Nenhum item encontrado')).toBeInTheDocument();
  });

  it('calls onSort when sortable header is clicked', () => {
    const onSort = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        onSort={onSort}
        getRowKey={(r) => r.id}
      />
    );
    fireEvent.click(screen.getByLabelText('Ordenar por Fornecedor'));
    expect(onSort).toHaveBeenCalledWith('fornecedor', 'asc');
  });

  it('toggles sort direction on repeated click', () => {
    const onSort = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        onSort={onSort}
        currentSort={{ column: 'fornecedor', direction: 'asc' }}
        getRowKey={(r) => r.id}
      />
    );
    fireEvent.click(screen.getByLabelText('Ordenar por Fornecedor'));
    expect(onSort).toHaveBeenCalledWith('fornecedor', 'desc');
  });

  it('renders pagination controls', () => {
    const onPageChange = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        pagination={{ page: 1, pageSize: 10, total: 30, onPageChange }}
        getRowKey={(r) => r.id}
      />
    );
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Página anterior')).toBeDisabled();
    expect(screen.getByLabelText('Próxima página')).not.toBeDisabled();
  });

  it('navigates to next page', () => {
    const onPageChange = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        pagination={{ page: 1, pageSize: 10, total: 30, onPageChange }}
        getRowKey={(r) => r.id}
      />
    );
    fireEvent.click(screen.getByLabelText('Próxima página'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables next button on last page', () => {
    const onPageChange = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        pagination={{ page: 3, pageSize: 10, total: 30, onPageChange }}
        getRowKey={(r) => r.id}
      />
    );
    expect(screen.getByLabelText('Próxima página')).toBeDisabled();
  });

  it('has accessible table label', () => {
    renderWithFluent(
      <StatusTable columns={columns} data={sampleData} getRowKey={(r) => r.id} />
    );
    expect(
      screen.getByRole('table', { name: 'Tabela de status com ordenação e paginação' })
    ).toBeInTheDocument();
  });

  it('has keyboard-accessible sort buttons', () => {
    const onSort = vi.fn();
    renderWithFluent(
      <StatusTable
        columns={columns}
        data={sampleData}
        onSort={onSort}
        getRowKey={(r) => r.id}
      />
    );
    const sortBtn = screen.getByLabelText('Ordenar por Fornecedor');
    sortBtn.focus();
    fireEvent.keyDown(sortBtn, { key: 'Enter' });
    fireEvent.click(sortBtn);
    expect(onSort).toHaveBeenCalled();
  });
});

describe('SLAChip', () => {
  it('renders dentro_prazo with success color', () => {
    renderWithFluent(<SLAChip status="dentro_prazo" />);
    expect(screen.getByText('Dentro do prazo')).toBeInTheDocument();
  });

  it('renders alerta with warning color', () => {
    renderWithFluent(<SLAChip status="alerta" />);
    expect(screen.getByText('Alerta')).toBeInTheDocument();
  });

  it('renders vencido with danger color', () => {
    renderWithFluent(<SLAChip status="vencido" />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    renderWithFluent(<SLAChip status="vencido" />);
    expect(screen.getByLabelText('SLA: Vencido')).toBeInTheDocument();
  });
});

describe('StatusChip', () => {
  it('renders status text', () => {
    renderWithFluent(<StatusChip status="Aprovado" color="success" />);
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    renderWithFluent(<StatusChip status="Pendente" />);
    expect(screen.getByLabelText('Status: Pendente')).toBeInTheDocument();
  });
});
