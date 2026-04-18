import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { JustificationModal } from '../JustificationModal';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('JustificationModal', () => {
  it('renders dialog with title when open', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar liberação"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Justificar liberação')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderWithFluent(
      <JustificationModal
        open={false}
        title="Justificar liberação"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Justificar liberação')).not.toBeInTheDocument();
  });

  it('has a required textarea with label', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('Justificativa')).toBeInTheDocument();
  });

  it('disables confirm button when textarea is empty', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmBtn).toBeDisabled();
  });

  it('enables confirm button when textarea has content', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: 'Documento legítimo' } });
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('calls onConfirm with trimmed text when confirmed', () => {
    const onConfirm = vi.fn();
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: '  Justificativa válida  ' } });
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('Justificativa válida');
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows validation error after blur on empty textarea', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.blur(textarea);
    expect(screen.getByText('Justificativa é obrigatória')).toBeInTheDocument();
  });

  it('sets aria-invalid when validation error is shown', () => {
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.blur(textarea);
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not call onConfirm when clicking confirm with only whitespace', () => {
    const onConfirm = vi.fn();
    renderWithFluent(
      <JustificationModal
        open={true}
        title="Justificar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Descreva a justificativa...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    // Button should still be disabled with whitespace-only
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmBtn).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
