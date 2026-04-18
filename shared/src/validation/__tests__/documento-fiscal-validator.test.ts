import { describe, it, expect } from 'vitest';
import {
  validateDocumentoFiscal,
  parseDocumentoFiscal,
} from '../documento-fiscal-validator';
import type { DocumentoFiscalJSON } from '../documento-fiscal-schema';

/** Helper: returns a minimal valid DocumentoFiscalJSON object. */
function validDoc(overrides: Partial<DocumentoFiscalJSON> = {}): DocumentoFiscalJSON {
  return {
    protocoloUnico: 'AP-20240101-000001',
    cnpjEmitente: '12345678000199',
    cnpjDestinatario: '98765432000188',
    numeroDocumento: 'NF-001',
    dataEmissao: '2024-01-15',
    dataVencimento: '2024-02-15',
    valorTotal: 100000,
    itensLinha: [
      {
        descricao: 'Serviço de consultoria',
        quantidade: 1,
        valorUnitario: 100000,
        valorTotal: 100000,
      },
    ],
    impostos: [
      {
        tipo: 'ISS',
        baseCalculo: 100000,
        aliquota: 5,
        valor: 5000,
      },
    ],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'recebido',
    indiceConfiancaPorCampo: { cnpjEmitente: 95 },
    dataRecebimento: '2024-01-15',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-15',
    ...overrides,
  };
}

describe('validateDocumentoFiscal', () => {
  it('should accept a valid document', () => {
    const result = validateDocumentoFiscal(validDoc());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid protocoloUnico pattern', () => {
    const result = validateDocumentoFiscal(validDoc({ protocoloUnico: 'INVALID' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('protocoloUnico'))).toBe(true);
  });

  it('should reject CNPJ with wrong length', () => {
    const result = validateDocumentoFiscal(validDoc({ cnpjEmitente: '123' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('cnpjEmitente'))).toBe(true);
  });

  it('should reject CNPJ with non-numeric characters', () => {
    const result = validateDocumentoFiscal(validDoc({ cnpjDestinatario: '1234567800AB99' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('cnpjDestinatario'))).toBe(true);
  });

  it('should reject invalid tipoDocumento enum', () => {
    const doc = validDoc();
    (doc as Record<string, unknown>).tipoDocumento = 'recibo';
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('tipoDocumento'))).toBe(true);
  });

  it('should reject invalid canalOrigem enum', () => {
    const doc = validDoc();
    (doc as Record<string, unknown>).canalOrigem = 'fax';
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('canalOrigem'))).toBe(true);
  });

  it('should reject invalid status enum', () => {
    const doc = validDoc();
    (doc as Record<string, unknown>).status = 'desconhecido';
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('status'))).toBe(true);
  });

  it('should reject missing required fields', () => {
    const result = validateDocumentoFiscal({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Should mention at least protocoloUnico as missing
    expect(result.errors.some((e) => e.message.includes('protocoloUnico'))).toBe(true);
  });

  it('should reject negative valorTotal', () => {
    const result = validateDocumentoFiscal(validDoc({ valorTotal: -100 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('valorTotal'))).toBe(true);
  });

  it('should reject non-integer valorTotal', () => {
    const result = validateDocumentoFiscal(validDoc({ valorTotal: 100.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('valorTotal'))).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = validateDocumentoFiscal(validDoc({ dataEmissao: '15/01/2024' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('dataEmissao'))).toBe(true);
  });

  it('should reject empty numeroDocumento', () => {
    const result = validateDocumentoFiscal(validDoc({ numeroDocumento: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('numeroDocumento'))).toBe(true);
  });

  it('should accept optional fields as absent', () => {
    const doc = validDoc();
    delete (doc as Partial<DocumentoFiscalJSON>).analistaResponsavel;
    delete (doc as Partial<DocumentoFiscalJSON>).aprovadorDesignado;
    delete (doc as Partial<DocumentoFiscalJSON>).erpTransactionId;
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(true);
  });

  it('should validate ItemLinha required fields', () => {
    const doc = validDoc({ itensLinha: [{ descricao: 'Item' } as never] });
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('itensLinha'))).toBe(true);
  });

  it('should validate Imposto required fields', () => {
    const doc = validDoc({ impostos: [{ tipo: 'ICMS' } as never] });
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('impostos'))).toBe(true);
  });

  it('should reject aliquota above 100', () => {
    const doc = validDoc({
      impostos: [{ tipo: 'ISS', baseCalculo: 100000, aliquota: 150, valor: 5000 }],
    });
    const result = validateDocumentoFiscal(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('aliquota'))).toBe(true);
  });

  it('should provide descriptive error messages', () => {
    const result = validateDocumentoFiscal(validDoc({ cnpjEmitente: 'abc' }));
    expect(result.valid).toBe(false);
    const cnpjError = result.errors.find((e) => e.field.includes('cnpjEmitente'));
    expect(cnpjError).toBeDefined();
    expect(cnpjError!.message).toContain('14 dígitos');
  });
});

describe('parseDocumentoFiscal', () => {
  it('should return typed object for valid input', () => {
    const doc = validDoc();
    const parsed = parseDocumentoFiscal(doc);
    expect(parsed.protocoloUnico).toBe('AP-20240101-000001');
    expect(parsed.cnpjEmitente).toBe('12345678000199');
  });

  it('should throw with descriptive errors for invalid input', () => {
    expect(() => parseDocumentoFiscal({})).toThrow('DocumentoFiscal inválido');
  });

  it('should include field paths in thrown error message', () => {
    try {
      parseDocumentoFiscal({ protocoloUnico: 'BAD' });
    } catch (err) {
      expect((err as Error).message).toContain('protocoloUnico');
    }
  });
});
