import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect } from 'vitest';
import { IntegrationBadge, type IntegrationStatus } from '../IntegrationBadge';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('IntegrationBadge', () => {
  it('renders "Registrado" label for registrado status', () => {
    renderWithFluent(<IntegrationBadge status="registrado" />);
    expect(screen.getByText('Registrado')).toBeInTheDocument();
  });

  it('renders "Erro" label for erro status', () => {
    renderWithFluent(<IntegrationBadge status="erro" />);
    expect(screen.getByText('Erro')).toBeInTheDocument();
  });

  it('renders "Reprocessando" label for reprocessando status', () => {
    renderWithFluent(<IntegrationBadge status="reprocessando" />);
    expect(screen.getByText('Reprocessando')).toBeInTheDocument();
  });

  it('renders "Pendente" label for pendente status', () => {
    renderWithFluent(<IntegrationBadge status="pendente" />);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('has accessible aria-label describing the status', () => {
    renderWithFluent(<IntegrationBadge status="registrado" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Integração: Registrado'
    );
  });

  it('shows ERP transaction ID when provided', () => {
    renderWithFluent(
      <IntegrationBadge status="registrado" erpTransactionId="ERP-12345" />
    );
    expect(screen.getByText('ERP: ERP-12345')).toBeInTheDocument();
  });

  it('includes ERP transaction ID in aria-label when provided', () => {
    renderWithFluent(
      <IntegrationBadge status="registrado" erpTransactionId="ERP-12345" />
    );
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Integração: Registrado — ERP ERP-12345'
    );
  });

  it('does not show ERP text when erpTransactionId is not provided', () => {
    renderWithFluent(<IntegrationBadge status="pendente" />);
    expect(screen.queryByText(/ERP:/)).not.toBeInTheDocument();
  });

  it.each<IntegrationStatus>(['registrado', 'erro', 'reprocessando', 'pendente'])(
    'renders role="status" for %s',
    (status) => {
      renderWithFluent(<IntegrationBadge status={status} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    }
  );
});
