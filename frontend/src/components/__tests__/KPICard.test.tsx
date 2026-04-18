import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect } from 'vitest';
import { KPICard } from '../KPICard';
import type { KPICardProps } from '../KPICard';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('KPICard', () => {
  const defaultProps: KPICardProps = {
    value: 42,
    label: 'Documentos Pendentes',
    trend: 'up',
    severity: 'warning',
  };

  it('renders value and label', () => {
    renderWithFluent(<KPICard {...defaultProps} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Documentos Pendentes')).toBeInTheDocument();
  });

  it('renders string value', () => {
    renderWithFluent(<KPICard {...defaultProps} value="R$ 1.500" />);
    expect(screen.getByText('R$ 1.500')).toBeInTheDocument();
  });

  it('has aria-label on the card region', () => {
    renderWithFluent(<KPICard {...defaultProps} />);
    const region = screen.getByRole('region', { name: 'Documentos Pendentes' });
    expect(region).toBeInTheDocument();
  });

  it('has aria-live="polite" for value updates', () => {
    renderWithFluent(<KPICard {...defaultProps} />);
    const liveRegion = screen.getByText('42').closest('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('renders with success severity', () => {
    renderWithFluent(<KPICard {...defaultProps} severity="success" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with danger severity', () => {
    renderWithFluent(<KPICard {...defaultProps} severity="danger" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders trend indicator with accessible title', () => {
    renderWithFluent(<KPICard {...defaultProps} trend="up" />);
    expect(screen.getByTitle('Tendência de alta')).toBeInTheDocument();
  });

  it('renders stable trend', () => {
    renderWithFluent(<KPICard {...defaultProps} trend="stable" />);
    expect(screen.getByTitle('Estável')).toBeInTheDocument();
  });

  it('renders down trend', () => {
    renderWithFluent(<KPICard {...defaultProps} trend="down" />);
    expect(screen.getByTitle('Tendência de queda')).toBeInTheDocument();
  });
});
