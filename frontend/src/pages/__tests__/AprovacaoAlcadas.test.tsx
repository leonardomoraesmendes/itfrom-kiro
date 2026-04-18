import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { AprovacaoAlcadas } from '../AprovacaoAlcadas';
import type { AprovacaoAlcadasProps } from '../AprovacaoAlcadas';
import type { DocumentoFiscal } from '@ap-automation/shared';
import type { TimelineEvent } from '../../components/HistoryTimeline';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const sampleDoc: DocumentoFiscal = {
  protocoloUnico: 'AP-20240101-000001',
  cnpjEmitente: '12345678000199',
  cnpjDestinatario: '98765432000100',
  numeroDocumento: 'NF-001',
  dataEmissao: new Date('2024-01-15'),
  dataVencimento: new Date('2024-02-15'),
  valorTotal: 250000,
  itensLinha: [{ descricao: 'Serviço', quantidade: 1, valorUnitario: 250000, valorTotal: 250000 }],
  impostos: [{ tipo: 'ISS', baseCalculo: 250000, aliquota: 5, valor: 12500 }],
  tipoDocumento: 'nota_fiscal',
  canalOrigem: 'upload',
  status: 'aguardando_aprovacao',
  indiceConfiancaPorCampo: { cnpjEmitente: 98 },
  dataRecebimento: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

const sampleEvents: TimelineEvent[] = [
  { dataHora: new Date('2024-01-15T10:00:00'), tipoAcao: 'Recebimento', usuarioId: 'analista1', descricao: 'Documento recebido via upload' },
  { dataHora: new Date('2024-01-15T10:05:00'), tipoAcao: 'Extração OCR', usuarioId: 'sistema', descricao: 'Extração concluída' },
];

const defaultProps: AprovacaoAlcadasProps = {
  document: sampleDoc,
  historyEvents: sampleEvents,
  slaRemaining: '4h 30min',
  blocked: false,
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onReturn: vi.fn(),
};

describe('AprovacaoAlcadas', () => {
  it('renders document header with financial summary', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    expect(screen.getByLabelText('Resumo do documento')).toBeInTheDocument();
  });

  it('renders SLA countdown', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    expect(screen.getByText('SLA restante: 4h 30min')).toBeInTheDocument();
  });

  it('renders history timeline', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    expect(screen.getByText('Histórico de Etapas')).toBeInTheDocument();
    expect(screen.getByText('Recebimento')).toBeInTheDocument();
    expect(screen.getByText('Extração OCR')).toBeInTheDocument();
  });

  it('renders three action buttons', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
    expect(screen.getByText('Rejeitar')).toBeInTheDocument();
    expect(screen.getByText('Devolver')).toBeInTheDocument();
  });

  it('calls onApprove when Aprovar is clicked', () => {
    const onApprove = vi.fn();
    wrap(<AprovacaoAlcadas {...defaultProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByText('Aprovar'));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('opens justification modal when Rejeitar is clicked', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    fireEvent.click(screen.getByText('Rejeitar'));
    expect(screen.getByText('Justificativa para rejeição')).toBeInTheDocument();
  });

  it('opens justification modal when Devolver is clicked', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    fireEvent.click(screen.getByText('Devolver'));
    expect(screen.getByText('Justificativa para devolução')).toBeInTheDocument();
  });

  it('calls onReject with justificativa when rejection modal is confirmed', () => {
    const onReject = vi.fn();
    wrap(<AprovacaoAlcadas {...defaultProps} onReject={onReject} />);
    fireEvent.click(screen.getByText('Rejeitar'));
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: 'Valor incorreto' } });
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onReject).toHaveBeenCalledWith('Valor incorreto');
  });

  it('calls onReturn with justificativa when return modal is confirmed', () => {
    const onReturn = vi.fn();
    wrap(<AprovacaoAlcadas {...defaultProps} onReturn={onReturn} />);
    fireEvent.click(screen.getByText('Devolver'));
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: 'Falta anexo' } });
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onReturn).toHaveBeenCalledWith('Falta anexo');
  });

  it('disables all actions when blocked is true', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} blocked={true} blockReason="Conflito de Segregação de Funções" />);
    expect(screen.getByText('Aprovar').closest('button')).toBeDisabled();
    expect(screen.getByText('Rejeitar').closest('button')).toBeDisabled();
    expect(screen.getByText('Devolver').closest('button')).toBeDisabled();
  });

  it('shows block reason message when blocked', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} blocked={true} blockReason="Alçada insuficiente para este valor" />);
    expect(screen.getByText('Alçada insuficiente para este valor')).toBeInTheDocument();
  });

  it('does not show block message when not blocked', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} blocked={false} />);
    expect(screen.queryByText(/Alçada insuficiente/)).not.toBeInTheDocument();
  });

  it('renders action bar with toolbar role', () => {
    wrap(<AprovacaoAlcadas {...defaultProps} />);
    expect(screen.getByRole('toolbar', { name: 'Ações de aprovação' })).toBeInTheDocument();
  });
});
