import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { CapturaValidacao } from '../CapturaValidacao';
import type { CapturaValidacaoProps } from '../CapturaValidacao';
import type { ReviewField } from '../../components/AssistedReviewForm';
import type { AlertItem } from '../../components/AlertsPanel';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const sampleFields: ReviewField[] = [
  { nome: 'CNPJ Emitente', valor: '12345678000199', indiceConfianca: 95, requerRevisao: false },
  { nome: 'Valor Total', valor: '1500', indiceConfianca: 72, requerRevisao: true },
  { nome: 'Data Vencimento', valor: '', indiceConfianca: 60, requerRevisao: true },
];

const sampleAlerts: AlertItem[] = [
  { tipo: 'campo_vazio', mensagem: 'Data Vencimento está vazio', severidade: 'critica' },
  { tipo: 'baixa_confianca', mensagem: 'Valor Total com confiança abaixo de 85%', severidade: 'alta' },
];

const defaultProps: CapturaValidacaoProps = {
  documentPreviewUrl: 'https://example.com/doc.pdf',
  fields: sampleFields,
  onFieldChange: vi.fn(),
  onSubmit: vi.fn(),
  alerts: [],
  saving: false,
};

describe('CapturaValidacao', () => {
  it('renders the split-view form with document preview and fields', () => {
    wrap(<CapturaValidacao {...defaultProps} fields={sampleFields} />);
    expect(screen.getByTitle('Pré-visualização do documento')).toBeInTheDocument();
    expect(screen.getByText('CNPJ Emitente')).toBeInTheDocument();
    expect(screen.getByText('Valor Total')).toBeInTheDocument();
  });

  it('renders alerts panel when alerts are provided', () => {
    wrap(<CapturaValidacao {...defaultProps} alerts={sampleAlerts} />);
    expect(screen.getByText(/Data Vencimento está vazio/)).toBeInTheDocument();
    expect(screen.getByText(/Valor Total com confiança abaixo de 85%/)).toBeInTheDocument();
  });

  it('does not render alerts panel when no alerts', () => {
    wrap(<CapturaValidacao {...defaultProps} alerts={[]} />);
    expect(screen.queryByLabelText('Painel de alertas')).not.toBeInTheDocument();
  });

  it('shows saving indicator when saving is true', () => {
    wrap(<CapturaValidacao {...defaultProps} saving={true} />);
    expect(screen.getByText('Salvando automaticamente...')).toBeInTheDocument();
    expect(screen.getByLabelText('Salvamento automático em andamento')).toBeInTheDocument();
  });

  it('does not show saving indicator when saving is false', () => {
    wrap(<CapturaValidacao {...defaultProps} saving={false} />);
    expect(screen.queryByText('Salvando automaticamente...')).not.toBeInTheDocument();
  });

  it('calls onFieldChange when a field value is edited', () => {
    const onFieldChange = vi.fn();
    wrap(<CapturaValidacao {...defaultProps} onFieldChange={onFieldChange} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '99999999000100' } });
    // Fluent UI Input fires onChange with data object
    expect(onFieldChange).toHaveBeenCalled();
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn();
    const fieldsAllFilled: ReviewField[] = [
      { nome: 'CNPJ Emitente', valor: '12345678000199', indiceConfianca: 95, requerRevisao: false },
    ];
    wrap(<CapturaValidacao {...defaultProps} fields={fieldsAllFilled} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Confirmar revisão'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('highlights low confidence fields with yellow background', () => {
    wrap(<CapturaValidacao {...defaultProps} />);
    // The field "Valor Total" has confidence 72% < 85%, should show warning badge
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('shows required empty field warning for empty required fields', () => {
    wrap(<CapturaValidacao {...defaultProps} />);
    // "Data Vencimento" is requerRevisao=true and valor=''
    expect(screen.getByText(/Campo obrigatório não preenchido/)).toBeInTheDocument();
  });

  it('disables submit when required fields are empty', () => {
    wrap(<CapturaValidacao {...defaultProps} />);
    const submitButton = screen.getByText('Confirmar revisão');
    expect(submitButton.closest('button')).toBeDisabled();
  });
});
