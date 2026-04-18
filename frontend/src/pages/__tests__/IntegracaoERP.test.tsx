import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { IntegracaoERP } from '../IntegracaoERP';
import type { IntegracaoERPProps } from '../IntegracaoERP';
import type { ERPTransaction, IntegrationKPIs } from '@ap-automation/shared';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const baseKpis: IntegrationKPIs = {
  totalRegistrados: 42,
  totalErros: 3,
  totalReprocessando: 1,
  taxaSucesso: 91.3,
};

const successTx: ERPTransaction = {
  protocoloUnico: 'AP-20240101-000001',
  erpTransactionId: 'ERP-001',
  status: 'registrado',
  ultimaTentativa: new Date('2024-03-15T10:30:00'),
};

const errorTx: ERPTransaction = {
  protocoloUnico: 'AP-20240101-000002',
  erpTransactionId: 'ERP-002',
  status: 'erro',
  ultimaTentativa: new Date('2024-03-15T11:00:00'),
  motivoErro: 'Timeout na conexão com ERP',
};

const reprocessingTx: ERPTransaction = {
  protocoloUnico: 'AP-20240101-000003',
  erpTransactionId: 'ERP-003',
  status: 'reprocessando',
  ultimaTentativa: new Date('2024-03-15T11:30:00'),
};

const defaultProps: IntegracaoERPProps = {
  kpis: baseKpis,
  transactions: [successTx, errorTx, reprocessingTx],
  canReprocess: true,
  onReprocess: vi.fn(),
};

describe('IntegracaoERP', () => {
  it('renders KPI cards with correct values', () => {
    wrap(<IntegracaoERP {...defaultProps} />);
    expect(screen.getByText('Registrados')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Erros')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Taxa de sucesso')).toBeInTheDocument();
    expect(screen.getByText('91.3%')).toBeInTheDocument();
  });

  it('renders empty state when no transactions', () => {
    wrap(
      <IntegracaoERP
        {...defaultProps}
        transactions={[]}
      />
    );
    expect(screen.getByText('Nenhuma transação recente')).toBeInTheDocument();
  });

  it('renders transaction rows with protocolo and ERP ID', () => {
    wrap(<IntegracaoERP {...defaultProps} />);
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    expect(screen.getByText('AP-20240101-000002')).toBeInTheDocument();
    expect(screen.getByText('AP-20240101-000003')).toBeInTheDocument();
  });

  it('renders IntegrationBadge for each transaction status', () => {
    wrap(<IntegracaoERP {...defaultProps} />);
    expect(screen.getByText('Registrado')).toBeInTheDocument();
    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getByText('Reprocessando')).toBeInTheDocument();
  });

  it('displays motivoErro for error transactions', () => {
    wrap(<IntegracaoERP {...defaultProps} />);
    expect(screen.getByText('Timeout na conexão com ERP')).toBeInTheDocument();
  });

  it('renders reprocess button only for error rows', () => {
    wrap(<IntegracaoERP {...defaultProps} />);
    const reprocessButtons = screen.getAllByText('Reprocessar');
    expect(reprocessButtons).toHaveLength(1);
  });

  it('calls onReprocess with correct protocoloUnico when clicked', () => {
    const onReprocess = vi.fn();
    wrap(<IntegracaoERP {...defaultProps} onReprocess={onReprocess} />);
    const reprocessButton = screen.getByText('Reprocessar');
    fireEvent.click(reprocessButton);
    expect(onReprocess).toHaveBeenCalledWith('AP-20240101-000002');
  });

  it('disables reprocess button when canReprocess is false', () => {
    wrap(<IntegracaoERP {...defaultProps} canReprocess={false} />);
    const reprocessButton = screen.getByText('Reprocessar');
    expect(reprocessButton.closest('button')).toBeDisabled();
  });

  it('enables reprocess button when canReprocess is true', () => {
    wrap(<IntegracaoERP {...defaultProps} canReprocess={true} />);
    const reprocessButton = screen.getByText('Reprocessar');
    expect(reprocessButton.closest('button')).not.toBeDisabled();
  });
});
