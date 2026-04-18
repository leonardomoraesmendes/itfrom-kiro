import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect } from 'vitest';
import { DocumentHeader, formatCurrency, formatDate } from '../DocumentHeader';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('formatCurrency', () => {
  it('formats centavos to BRL currency', () => {
    const result = formatCurrency(150000);
    expect(result).toContain('1.500');
    expect(result).toContain('00');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
  });

  it('formats small values', () => {
    const result = formatCurrency(99);
    expect(result).toContain('0,99');
  });
});

describe('formatDate', () => {
  it('formats date to dd/mm/yyyy', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    const formatted = formatDate(date);
    expect(formatted).toBe('15/06/2024');
  });
});

describe('DocumentHeader', () => {
  const defaultProps = {
    valor: 1234500, // R$ 12.345,00
    fornecedor: 'Empresa ABC Ltda',
    dataVencimento: new Date(2024, 11, 31), // Dec 31, 2024
    centroCusto: 'CC-001 Marketing',
  };

  it('renders formatted currency value', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    // toLocaleString may use non-breaking space; use a function matcher
    expect(screen.getByText((_content, element) => {
      return element?.tagName === 'SPAN' && !!element.textContent?.includes('12.345');
    })).toBeInTheDocument();
  });

  it('renders supplier name', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    expect(screen.getByText('Empresa ABC Ltda')).toBeInTheDocument();
  });

  it('renders formatted due date', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    expect(screen.getByText('31/12/2024')).toBeInTheDocument();
  });

  it('renders cost center', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    expect(screen.getByText('CC-001 Marketing')).toBeInTheDocument();
  });

  it('has accessible region label', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    expect(screen.getByRole('region', { name: 'Resumo do documento' })).toBeInTheDocument();
  });

  it('has accessible labels for all fields', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor')).toBeInTheDocument();
    expect(screen.getByText('Vencimento')).toBeInTheDocument();
    expect(screen.getByText('Centro de Custo')).toBeInTheDocument();
  });

  it('associates values with labels via aria-labelledby', () => {
    renderWithFluent(<DocumentHeader {...defaultProps} />);
    const valorLabel = screen.getByText('Valor');
    expect(valorLabel).toHaveAttribute('id', 'doc-valor-label');
    // Find the value element by aria-labelledby attribute
    const valorValue = document.querySelector('[aria-labelledby="doc-valor-label"]');
    expect(valorValue).toBeInTheDocument();
    expect(valorValue?.textContent).toContain('12.345');
  });
});
