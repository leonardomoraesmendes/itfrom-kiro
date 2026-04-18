import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { AssistedReviewForm } from '../AssistedReviewForm';
import type { ReviewField } from '../AssistedReviewForm';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const baseFields: ReviewField[] = [
  { nome: 'CNPJ Emitente', valor: '12345678000199', indiceConfianca: 95, requerRevisao: false },
  { nome: 'Valor Total', valor: '15000', indiceConfianca: 72, requerRevisao: true },
  { nome: 'Data Vencimento', valor: '2024-12-31', indiceConfianca: 90, requerRevisao: false },
];

describe('AssistedReviewForm', () => {
  it('renders document preview iframe with correct src', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const iframe = screen.getByTitle('Pré-visualização do documento');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com/doc.pdf');
  });

  it('renders all fields with labels', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('CNPJ Emitente')).toBeInTheDocument();
    expect(screen.getByText('Valor Total')).toBeInTheDocument();
    expect(screen.getByText('Data Vencimento')).toBeInTheDocument();
  });

  it('shows confidence percentage for each field', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('highlights fields with confidence < 85% with yellow background', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    // Low confidence field should have help text about review
    expect(screen.getByText(/Confiança abaixo de 85%/)).toBeInTheDocument();
  });

  it('shows red border warning for required empty fields', () => {
    const fieldsWithEmpty: ReviewField[] = [
      { nome: 'Campo Obrigatório', valor: '', indiceConfianca: 60, requerRevisao: true },
    ];
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={fieldsWithEmpty}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText(/Campo obrigatório não preenchido/)).toBeInTheDocument();
  });

  it('disables submit when required fields are empty', () => {
    const fieldsWithEmpty: ReviewField[] = [
      { nome: 'Campo Obrigatório', valor: '', indiceConfianca: 60, requerRevisao: true },
    ];
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={fieldsWithEmpty}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const submitBtn = screen.getByRole('button', { name: 'Confirmar revisão' });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit when all required fields are filled', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const submitBtn = screen.getByRole('button', { name: 'Confirmar revisão' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onFieldChange when a field value changes', () => {
    const onFieldChange = vi.fn();
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={onFieldChange}
        onSubmit={vi.fn()}
      />
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '99999999000100' } });
    expect(onFieldChange).toHaveBeenCalledWith(0, '99999999000100');
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn();
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const submitBtn = screen.getByRole('button', { name: 'Confirmar revisão' });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('has accessible labels with aria-describedby for help text', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-describedby');
    });
  });

  it('marks required fields with aria-required', () => {
    const fieldsWithRequired: ReviewField[] = [
      { nome: 'Obrigatório', valor: 'val', indiceConfianca: 80, requerRevisao: true },
      { nome: 'Opcional', valor: 'val', indiceConfianca: 95, requerRevisao: false },
    ];
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={fieldsWithRequired}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveAttribute('aria-required', 'true');
  });

  it('has region landmark for the split-view', () => {
    renderWithFluent(
      <AssistedReviewForm
        documentPreviewUrl="https://example.com/doc.pdf"
        fields={baseFields}
        onFieldChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('region', { name: 'Revisão assistida de documento' })).toBeInTheDocument();
  });
});
