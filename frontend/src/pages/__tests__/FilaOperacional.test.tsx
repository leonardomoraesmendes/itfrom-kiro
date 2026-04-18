import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { FilaOperacional } from '../FilaOperacional';
import type { FilaOperacionalProps } from '../FilaOperacional';
import type { QueueItem, QueueKPIs, QueueFilters } from '@ap-automation/shared';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const baseKpis: QueueKPIs = {
  totalPendente: 15,
  totalVencidos: 3,
  totalAlerta: 5,
};

const sampleItem: QueueItem = {
  protocoloUnico: 'AP-20240101-000001',
  fornecedor: 'Fornecedor ABC',
  valor: 250000,
  dataVencimento: new Date('2024-03-15'),
  etapaAtual: 'validacao',
  tempoDecorrido: 120,
  slaStatus: 'dentro_prazo',
  responsavel: 'analista1',
};

const exceptionItem: QueueItem = {
  protocoloUnico: 'AP-20240101-000002',
  fornecedor: 'Fornecedor XYZ',
  valor: 500000,
  dataVencimento: new Date('2024-03-10'),
  etapaAtual: 'aprovacao',
  tempoDecorrido: 300,
  slaStatus: 'vencido',
  excecao: { tipo: 'validacao_reprovada', motivo: 'CNPJ inválido' },
  responsavel: 'analista2',
};

const alertItem: QueueItem = {
  protocoloUnico: 'AP-20240101-000003',
  fornecedor: 'Fornecedor DEF',
  valor: 100000,
  dataVencimento: new Date('2024-03-20'),
  etapaAtual: 'captura',
  tempoDecorrido: 80,
  slaStatus: 'alerta',
  responsavel: 'analista1',
};

const defaultFilters: QueueFilters = {};

const defaultProps: FilaOperacionalProps = {
  items: [sampleItem, exceptionItem, alertItem],
  kpis: baseKpis,
  filters: defaultFilters,
  onFilterChange: vi.fn(),
  onReassign: vi.fn(),
  onTreat: vi.fn(),
};

describe('FilaOperacional', () => {
  it('renders 3 KPI cards with correct values', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('Total pendente')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Vencidos')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Em alerta')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders empty state when no items and zero pending', () => {
    wrap(
      <FilaOperacional
        {...defaultProps}
        items={[]}
        kpis={{ totalPendente: 0, totalVencidos: 0, totalAlerta: 0 }}
      />
    );
    expect(screen.getByText('Nenhum item na fila')).toBeInTheDocument();
  });

  it('renders filter dropdowns for etapa, SLA, and fornecedor', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByLabelText('Filtrar por etapa')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por status SLA')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por fornecedor')).toBeInTheDocument();
  });

  it('renders table with queue items', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor ABC')).toBeInTheDocument();
    expect(screen.getByText('AP-20240101-000002')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor XYZ')).toBeInTheDocument();
  });

  it('renders SLA chips with correct status', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('Dentro do prazo')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Alerta')).toBeInTheDocument();
  });

  it('highlights exception items with motivo', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('CNPJ inválido')).toBeInTheDocument();
  });

  it('renders reatribuir and tratar action buttons per row', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    const reassignButtons = screen.getAllByText('Reatribuir');
    const treatButtons = screen.getAllByText('Tratar');
    expect(reassignButtons).toHaveLength(3);
    expect(treatButtons).toHaveLength(3);
  });

  it('calls onReassign when reatribuir button is clicked', () => {
    const onReassign = vi.fn();
    wrap(<FilaOperacional {...defaultProps} onReassign={onReassign} />);
    const reassignButtons = screen.getAllByText('Reatribuir');
    fireEvent.click(reassignButtons[0]);
    expect(onReassign).toHaveBeenCalledWith('AP-20240101-000001', '');
  });

  it('calls onTreat when tratar button is clicked', () => {
    const onTreat = vi.fn();
    wrap(<FilaOperacional {...defaultProps} onTreat={onTreat} />);
    const treatButtons = screen.getAllByText('Tratar');
    fireEvent.click(treatButtons[1]);
    expect(onTreat).toHaveBeenCalledWith('AP-20240101-000002');
  });

  it('formats valor as BRL currency', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('R$ 2.500,00')).toBeInTheDocument();
  });

  it('formats tempoDecorrido as hours and minutes', () => {
    wrap(<FilaOperacional {...defaultProps} />);
    expect(screen.getByText('2h 0min')).toBeInTheDocument();
    expect(screen.getByText('5h 0min')).toBeInTheDocument();
    expect(screen.getByText('1h 20min')).toBeInTheDocument();
  });
});
