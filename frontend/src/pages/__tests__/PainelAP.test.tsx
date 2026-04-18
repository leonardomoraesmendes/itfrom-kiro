import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { PainelAP } from '../PainelAP';
import type { PainelAPProps } from '../PainelAP';
import type { OperationalKPIs, Alert, DocumentoFiscal } from '@ap-automation/shared';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const baseKpis: OperationalKPIs = {
  volumePorEtapa: {
    intake: 5,
    captura: 3,
    validacao: 2,
    aprovacao: 4,
    integracao_erp: 1,
    concluido: 10,
  },
  taxaExcecoes: 0.12,
  tempoMedioPorEtapa: {
    intake: 1000,
    captura: 2000,
    validacao: 1500,
    aprovacao: 3000,
    integracao_erp: 500,
    concluido: 0,
  },
  itensVencidosSLA: 3,
  alertasRisco: [],
};

const sampleAlert: Alert = {
  tipo: 'sla',
  mensagem: 'Documento AP-20240101-000001 venceu SLA',
  severidade: 'critica',
  protocoloUnico: 'AP-20240101-000001',
};

const sampleDoc: DocumentoFiscal = {
  protocoloUnico: 'AP-20240101-000001',
  cnpjEmitente: '12345678000199',
  cnpjDestinatario: '98765432000188',
  numeroDocumento: 'NF-001',
  dataEmissao: new Date('2024-01-01'),
  dataVencimento: new Date('2024-02-01'),
  valorTotal: 150000,
  itensLinha: [],
  impostos: [],
  tipoDocumento: 'nota_fiscal',
  canalOrigem: 'upload',
  status: 'aguardando_aprovacao',
  indiceConfiancaPorCampo: {},
  dataRecebimento: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const defaultProps: PainelAPProps = {
  kpis: baseKpis,
  alerts: [],
  criticalDocs: [],
  loading: false,
  error: null,
  onRetry: vi.fn(),
  onNavigateToQueue: vi.fn(),
};

describe('PainelAP', () => {
  it('renders KPI cards when kpis are provided', () => {
    wrap(<PainelAP {...defaultProps} />);
    expect(screen.getByText('Documentos recebidos')).toBeInTheDocument();
    expect(screen.getByText('Pendentes aprovação')).toBeInTheDocument();
    expect(screen.getByText('Vencidos SLA')).toBeInTheDocument();
    expect(screen.getByText('Valor total pipeline')).toBeInTheDocument();
  });

  it('renders loading skeleton state', () => {
    wrap(<PainelAP {...defaultProps} loading={true} />);
    expect(screen.getByLabelText('Carregando painel')).toBeInTheDocument();
    expect(screen.queryByText('Documentos recebidos')).not.toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    wrap(<PainelAP {...defaultProps} error="Falha ao carregar dados" onRetry={onRetry} />);
    expect(screen.getByText('Falha ao carregar dados')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders empty state when no kpis and no docs', () => {
    wrap(<PainelAP {...defaultProps} kpis={null} criticalDocs={[]} />);
    expect(screen.getByText('Nenhum documento no pipeline')).toBeInTheDocument();
  });

  it('renders alerts panel when alerts are provided', () => {
    wrap(<PainelAP {...defaultProps} alerts={[sampleAlert]} />);
    expect(screen.getByText(/venceu SLA/)).toBeInTheDocument();
  });

  it('renders critical documents table', () => {
    wrap(<PainelAP {...defaultProps} criticalDocs={[sampleDoc]} />);
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    expect(screen.getByText('12345678000199')).toBeInTheDocument();
  });

  it('calls onNavigateToQueue when CTA is clicked', () => {
    const onNavigateToQueue = vi.fn();
    wrap(<PainelAP {...defaultProps} onNavigateToQueue={onNavigateToQueue} />);
    fireEvent.click(screen.getByText('Ir para Fila Operacional'));
    expect(onNavigateToQueue).toHaveBeenCalledOnce();
  });

  it('shows CTA button even with empty docs', () => {
    wrap(<PainelAP {...defaultProps} />);
    expect(screen.getByText('Ir para Fila Operacional')).toBeInTheDocument();
  });
});
