import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { ValidacoesAntiDuplicidade } from '../ValidacoesAntiDuplicidade';
import type { ValidacoesAntiDuplicidadeProps } from '../ValidacoesAntiDuplicidade';
import type { DocumentoFiscal } from '@ap-automation/shared';
import type { ValidationResult, DuplicateCheckResult } from '@ap-automation/shared/src/types/services';

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
  valorTotal: 150000,
  itensLinha: [{ descricao: 'Item 1', quantidade: 1, valorUnitario: 150000, valorTotal: 150000 }],
  impostos: [{ tipo: 'ICMS', baseCalculo: 150000, aliquota: 18, valor: 27000 }],
  tipoDocumento: 'nota_fiscal',
  canalOrigem: 'upload',
  status: 'em_validacao',
  indiceConfiancaPorCampo: { cnpjEmitente: 95 },
  dataRecebimento: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

const sampleValidation: ValidationResult = {
  protocoloUnico: 'AP-20240101-000001',
  aprovado: false,
  regras: [
    { regra: 'Consistência CNPJ', status: 'aprovada', detalhes: 'CNPJ válido', criticidade: 'critica' },
    { regra: 'Data de vencimento', status: 'aprovada', detalhes: 'Data futura', criticidade: 'alta' },
    { regra: 'Coerência valor total', status: 'reprovada', detalhes: 'Divergência de R$ 50,00', criticidade: 'critica' },
  ],
};

const sampleDuplicateNone: DuplicateCheckResult = {
  duplicataDetectada: false,
  documentosSimilares: [],
  criterios: { cnpjEmitente: false, numeroDocumento: false, valorDentroTolerancia: false },
};

const similarDoc: DocumentoFiscal = {
  ...sampleDoc,
  protocoloUnico: 'AP-20240101-000002',
  valorTotal: 149500,
};

const sampleDuplicateFound: DuplicateCheckResult = {
  duplicataDetectada: true,
  documentosSimilares: [similarDoc],
  criterios: { cnpjEmitente: true, numeroDocumento: true, valorDentroTolerancia: true },
};

const defaultProps: ValidacoesAntiDuplicidadeProps = {
  document: sampleDoc,
  validationResult: sampleValidation,
  duplicateResult: sampleDuplicateNone,
  onLiberar: vi.fn(),
  onRejeitar: vi.fn(),
  onBloquear: vi.fn(),
};

describe('ValidacoesAntiDuplicidade', () => {
  it('renders document summary header', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    expect(screen.getByLabelText('Resumo do documento')).toBeInTheDocument();
  });

  it('renders validation rules with status badges', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    expect(screen.getByText('Consistência CNPJ')).toBeInTheDocument();
    expect(screen.getByText('Coerência valor total')).toBeInTheDocument();
    // Check status badges
    const aprovadaBadges = screen.getAllByText('aprovada');
    expect(aprovadaBadges.length).toBe(2);
    expect(screen.getByText('reprovada')).toBeInTheDocument();
  });

  it('renders criticidade badges for each rule', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    const criticaBadges = screen.getAllByText('critica');
    expect(criticaBadges.length).toBe(2); // two rules with criticidade critica
    expect(screen.getByText('alta')).toBeInTheDocument();
  });

  it('does not render similar documents table when none found', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} duplicateResult={sampleDuplicateNone} />);
    expect(screen.queryByLabelText('Documentos similares')).not.toBeInTheDocument();
  });

  it('renders similar documents table side by side when duplicates found', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} duplicateResult={sampleDuplicateFound} />);
    expect(screen.getByLabelText('Documentos similares')).toBeInTheDocument();
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    expect(screen.getByText('AP-20240101-000002')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toBeInTheDocument();
    expect(screen.getByText('Similar')).toBeInTheDocument();
  });

  it('renders three decision buttons', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    expect(screen.getByText('Bloquear')).toBeInTheDocument();
    expect(screen.getByText('Justificar e Liberar')).toBeInTheDocument();
    expect(screen.getByText('Rejeitar')).toBeInTheDocument();
  });

  it('calls onBloquear when Bloquear is clicked', () => {
    const onBloquear = vi.fn();
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} onBloquear={onBloquear} />);
    fireEvent.click(screen.getByText('Bloquear'));
    expect(onBloquear).toHaveBeenCalledOnce();
  });

  it('opens justification modal when Justificar e Liberar is clicked', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    fireEvent.click(screen.getByText('Justificar e Liberar'));
    expect(screen.getByText('Justificativa para liberação de duplicata')).toBeInTheDocument();
  });

  it('opens justification modal when Rejeitar is clicked', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    fireEvent.click(screen.getByText('Rejeitar'));
    expect(screen.getByText('Justificativa para rejeição')).toBeInTheDocument();
  });

  it('calls onLiberar with justificativa when modal is confirmed for liberar', () => {
    const onLiberar = vi.fn();
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} onLiberar={onLiberar} />);
    fireEvent.click(screen.getByText('Justificar e Liberar'));
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: 'Documento legítimo' } });
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onLiberar).toHaveBeenCalledWith('Documento legítimo');
  });

  it('calls onRejeitar with justificativa when modal is confirmed for rejeitar', () => {
    const onRejeitar = vi.fn();
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} onRejeitar={onRejeitar} />);
    fireEvent.click(screen.getByText('Rejeitar'));
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: 'Duplicata confirmada' } });
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onRejeitar).toHaveBeenCalledWith('Duplicata confirmada');
  });

  it('shows validation details text', () => {
    wrap(<ValidacoesAntiDuplicidade {...defaultProps} />);
    expect(screen.getByText('CNPJ válido')).toBeInTheDocument();
    expect(screen.getByText('Divergência de R$ 50,00')).toBeInTheDocument();
  });
});
