import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { DashboardGerencial } from '../DashboardGerencial';
import type { DashboardGerencialProps } from '../DashboardGerencial';
import type { AuditEntry, ManagementKPIs } from '@ap-automation/shared';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const baseKpis: ManagementKPIs = {
  previsaoPagamentos30d: [
    {
      fornecedor: 'Fornecedor A',
      centroCusto: 'CC-001',
      valorPrevisto: 1500000, // R$ 15.000,00
      dataPrevisao: new Date('2024-04-15'),
    },
    {
      fornecedor: 'Fornecedor B',
      centroCusto: 'CC-002',
      valorPrevisto: 500000, // R$ 5.000,00
      dataPrevisao: new Date('2024-04-20'),
    },
  ],
  tendenciaVolume: [{ periodo: '2024-03', valor: 120 }],
  tendenciaValor: [{ periodo: '2024-03', valor: 5000000 }],
  taxaAutomacao: 78.5,
  duplicatasEvitadas: 12,
};

const auditEntry1: AuditEntry = {
  id: 'audit-001',
  usuarioId: 'user-01',
  tipoAcao: 'aprovacao',
  protocoloUnico: 'AP-20240101-000001',
  dataHora: new Date('2024-03-15T10:30:00'),
};

const auditEntry2: AuditEntry = {
  id: 'audit-002',
  usuarioId: 'user-02',
  tipoAcao: 'duplicata_liberada',
  protocoloUnico: 'AP-20240101-000002',
  dataHora: new Date('2024-03-15T11:00:00'),
  justificativa: 'Documento legítimo confirmado',
};

const defaultProps: DashboardGerencialProps = {
  managementKpis: baseKpis,
  auditEntries: [auditEntry1, auditEntry2],
  auditTotal: 50,
  auditPage: 1,
  auditPageSize: 10,
  onAuditPageChange: vi.fn(),
  onAuditFilter: vi.fn(),
  canExport: true,
  onExport: vi.fn(),
};

describe('DashboardGerencial', () => {
  it('renders KPI cards with automation rate, duplicates avoided, and 30-day forecast', () => {
    wrap(<DashboardGerencial {...defaultProps} />);
    expect(screen.getByText('Taxa de automação')).toBeInTheDocument();
    expect(screen.getByText('78.5%')).toBeInTheDocument();
    expect(screen.getByText('Duplicatas evitadas')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Previsão 30 dias')).toBeInTheDocument();
  });

  it('renders payment forecast table with supplier data', () => {
    wrap(<DashboardGerencial {...defaultProps} />);
    expect(screen.getByText('Fornecedor A')).toBeInTheDocument();
    expect(screen.getByText('CC-001')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor B')).toBeInTheDocument();
    expect(screen.getByText('CC-002')).toBeInTheDocument();
  });

  it('renders empty forecast message when no forecasts', () => {
    const emptyKpis: ManagementKPIs = {
      ...baseKpis,
      previsaoPagamentos30d: [],
    };
    wrap(<DashboardGerencial {...defaultProps} managementKpis={emptyKpis} />);
    expect(screen.getByText('Sem previsões para o período')).toBeInTheDocument();
  });

  it('renders audit log entries with correct columns', () => {
    wrap(<DashboardGerencial {...defaultProps} />);
    expect(screen.getByText('user-01')).toBeInTheDocument();
    // "Aprovação" appears in both the table cell and the filter dropdown
    expect(screen.getAllByText('Aprovação').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    // "Duplicata liberada" also appears in both table and dropdown
    expect(screen.getAllByText('Duplicata liberada').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Documento legítimo confirmado')).toBeInTheDocument();
  });

  it('renders audit filter inputs', () => {
    wrap(<DashboardGerencial {...defaultProps} />);
    expect(screen.getByLabelText('Período início')).toBeInTheDocument();
    expect(screen.getByLabelText('Período fim')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de ação')).toBeInTheDocument();
    expect(screen.getByLabelText('Documento')).toBeInTheDocument();
  });

  it('calls onAuditFilter when user types in usuario filter', () => {
    const onAuditFilter = vi.fn();
    wrap(<DashboardGerencial {...defaultProps} onAuditFilter={onAuditFilter} />);
    const input = screen.getByLabelText('Usuário');
    fireEvent.change(input, { target: { value: 'user-03' } });
    expect(onAuditFilter).toHaveBeenCalled();
  });

  it('calls onExport with csv when CSV button clicked', () => {
    const onExport = vi.fn();
    wrap(<DashboardGerencial {...defaultProps} onExport={onExport} />);
    fireEvent.click(screen.getByText('Exportar CSV'));
    expect(onExport).toHaveBeenCalledWith('csv');
  });

  it('calls onExport with pdf when PDF button clicked', () => {
    const onExport = vi.fn();
    wrap(<DashboardGerencial {...defaultProps} onExport={onExport} />);
    fireEvent.click(screen.getByText('Exportar PDF'));
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('disables export buttons when canExport is false', () => {
    wrap(<DashboardGerencial {...defaultProps} canExport={false} />);
    const csvBtn = screen.getByText('Exportar CSV').closest('button');
    const pdfBtn = screen.getByText('Exportar PDF').closest('button');
    expect(csvBtn).toBeDisabled();
    expect(pdfBtn).toBeDisabled();
  });

  it('enables export buttons when canExport is true', () => {
    wrap(<DashboardGerencial {...defaultProps} canExport={true} />);
    const csvBtn = screen.getByText('Exportar CSV').closest('button');
    const pdfBtn = screen.getByText('Exportar PDF').closest('button');
    expect(csvBtn).not.toBeDisabled();
    expect(pdfBtn).not.toBeDisabled();
  });

  it('renders pagination for audit table', () => {
    wrap(<DashboardGerencial {...defaultProps} />);
    expect(screen.getByText(/Página 1 de/)).toBeInTheDocument();
  });
});
