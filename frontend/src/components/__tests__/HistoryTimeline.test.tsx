import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect } from 'vitest';
import {
  HistoryTimeline,
  formatDateTime,
  type TimelineEvent,
} from '../HistoryTimeline';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('formatDateTime', () => {
  it('formats date and time to pt-BR locale', () => {
    const date = new Date(2024, 5, 15, 14, 30); // June 15, 2024 14:30
    const result = formatDateTime(date);
    expect(result).toContain('15/06/2024');
    expect(result).toContain('14:30');
  });
});

describe('HistoryTimeline', () => {
  const sampleEvents: TimelineEvent[] = [
    {
      dataHora: new Date(2024, 5, 10, 9, 0),
      tipoAcao: 'documento_recebido',
      usuarioId: 'user-001',
      descricao: 'Documento recebido via upload',
    },
    {
      dataHora: new Date(2024, 5, 10, 9, 15),
      tipoAcao: 'extracao_concluida',
      usuarioId: 'system',
      descricao: 'Extração OCR concluída com 95% de confiança',
    },
    {
      dataHora: new Date(2024, 5, 10, 10, 0),
      tipoAcao: 'aprovacao',
      usuarioId: 'user-002',
      descricao: 'Documento aprovado',
    },
  ];

  it('renders an ordered list with aria-label', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    const list = screen.getByRole('list', { name: 'Histórico de eventos do documento' });
    expect(list).toBeInTheDocument();
    expect(list.tagName).toBe('OL');
  });

  it('renders all events as list items', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('displays action type for each event', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    expect(screen.getByText('documento_recebido')).toBeInTheDocument();
    expect(screen.getByText('extracao_concluida')).toBeInTheDocument();
    expect(screen.getByText('aprovacao')).toBeInTheDocument();
  });

  it('displays description for each event', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    expect(screen.getByText('Documento recebido via upload')).toBeInTheDocument();
    expect(screen.getByText('Extração OCR concluída com 95% de confiança')).toBeInTheDocument();
    expect(screen.getByText('Documento aprovado')).toBeInTheDocument();
  });

  it('displays user ID for each event', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    expect(screen.getByText(/user-001/)).toBeInTheDocument();
    expect(screen.getByText(/system/)).toBeInTheDocument();
    expect(screen.getByText(/user-002/)).toBeInTheDocument();
  });

  it('renders time elements with ISO datetime attribute', () => {
    renderWithFluent(<HistoryTimeline events={sampleEvents} />);
    const timeElements = document.querySelectorAll('time');
    expect(timeElements).toHaveLength(3);
    expect(timeElements[0].getAttribute('dateTime')).toBe(
      sampleEvents[0].dataHora.toISOString()
    );
  });

  it('shows empty state message when no events', () => {
    renderWithFluent(<HistoryTimeline events={[]} />);
    expect(screen.getByText('Nenhum evento registrado.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders a single event without trailing line', () => {
    renderWithFluent(
      <HistoryTimeline events={[sampleEvents[0]]} />
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
  });
});
