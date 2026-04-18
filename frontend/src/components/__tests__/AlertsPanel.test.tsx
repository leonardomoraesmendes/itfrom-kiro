import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { AlertsPanel } from '../AlertsPanel';
import type { AlertItem } from '../AlertsPanel';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('AlertsPanel', () => {
  const sampleAlerts: AlertItem[] = [
    { tipo: 'sla', mensagem: 'SLA vencido para AP-20240101-000001', severidade: 'critica', protocoloUnico: 'AP-20240101-000001' },
    { tipo: 'duplicidade', mensagem: 'Possível duplicata detectada', severidade: 'alta' },
    { tipo: 'validacao', mensagem: 'Campo CNPJ com baixa confiança', severidade: 'media' },
    { tipo: 'info', mensagem: 'Documento classificado automaticamente', severidade: 'baixa' },
  ];

  it('renders all alerts', () => {
    renderWithFluent(<AlertsPanel alerts={sampleAlerts} />);
    expect(screen.getByText(/SLA vencido/)).toBeInTheDocument();
    expect(screen.getByText(/Possível duplicata/)).toBeInTheDocument();
    expect(screen.getByText(/Campo CNPJ/)).toBeInTheDocument();
    expect(screen.getByText(/Documento classificado/)).toBeInTheDocument();
  });

  it('renders severity labels as text (color never sole indicator)', () => {
    renderWithFluent(<AlertsPanel alerts={sampleAlerts} />);
    expect(screen.getByText('Crítico:')).toBeInTheDocument();
    expect(screen.getByText('Alta prioridade:')).toBeInTheDocument();
    // media and baixa both map to 'Informação'
    const infoLabels = screen.getAllByText('Informação:');
    expect(infoLabels.length).toBe(2);
  });

  it('returns null when alerts array is empty', () => {
    const { container } = renderWithFluent(<AlertsPanel alerts={[]} />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('has aria-live="polite" for dynamic updates', () => {
    renderWithFluent(<AlertsPanel alerts={sampleAlerts} />);
    const region = screen.getByRole('region', { name: 'Painel de alertas' });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders action button when onAction is provided', () => {
    const onAction = vi.fn();
    const alertsWithAction: AlertItem[] = [
      { tipo: 'sla', mensagem: 'SLA vencido', severidade: 'critica', onAction },
    ];
    renderWithFluent(<AlertsPanel alerts={alertsWithAction} />);
    const button = screen.getByRole('button', { name: 'Ver detalhes' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('uses custom action label', () => {
    const alertsWithAction: AlertItem[] = [
      { tipo: 'sla', mensagem: 'SLA vencido', severidade: 'critica', onAction: vi.fn() },
    ];
    renderWithFluent(<AlertsPanel alerts={alertsWithAction} actionLabel="Tratar" />);
    expect(screen.getByRole('button', { name: 'Tratar' })).toBeInTheDocument();
  });

  it('does not render action button when onAction is not provided', () => {
    const alertsNoAction: AlertItem[] = [
      { tipo: 'info', mensagem: 'Informação geral', severidade: 'baixa' },
    ];
    renderWithFluent(<AlertsPanel alerts={alertsNoAction} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
