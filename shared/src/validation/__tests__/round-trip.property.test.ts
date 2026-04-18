import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateDocumentoFiscal } from '../documento-fiscal-validator';
import type { DocumentoFiscalJSON, ItemLinhaJSON, ImpostoJSON } from '../documento-fiscal-schema';

// --- Arbitraries ---

/** Generates a valid protocoloUnico matching pattern ^AP-\d{8}-\d{6}$ */
const arbProtocoloUnico = fc.stringMatching(/^AP-\d{8}-\d{6}$/);

/** Generates a valid 14-digit CNPJ string */
const arbCNPJ = fc.stringMatching(/^\d{14}$/);

/** Generates a valid ISO date string (YYYY-MM-DD) */
const arbISODate = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/** Generates a non-empty alphanumeric string for document number */
const arbNumeroDocumento = fc.stringMatching(/^[A-Z0-9\-]{1,20}$/);

/** Generates a valid ItemLinhaJSON */
const arbItemLinha: fc.Arbitrary<ItemLinhaJSON> = fc.record({
  descricao: fc.string({ minLength: 1, maxLength: 50 }),
  quantidade: fc.double({ min: 0, max: 10000, noNaN: true }),
  valorUnitario: fc.nat({ max: 10_000_000 }),
  valorTotal: fc.nat({ max: 10_000_000 }),
  codigoNCM: fc.option(fc.stringMatching(/^\d{8}$/), { nil: undefined }),
});

/** Generates a valid ImpostoJSON */
const arbImposto: fc.Arbitrary<ImpostoJSON> = fc.record({
  tipo: fc.constantFrom('ICMS', 'IPI', 'PIS', 'COFINS', 'ISS'),
  baseCalculo: fc.nat({ max: 10_000_000 }),
  aliquota: fc.double({ min: 0, max: 100, noNaN: true }),
  valor: fc.nat({ max: 10_000_000 }),
});

const arbTipoDocumento = fc.constantFrom('nota_fiscal' as const, 'boleto' as const, 'fatura' as const);
const arbCanalOrigem = fc.constantFrom('email' as const, 'upload' as const, 'api' as const);
const arbStatus = fc.constantFrom(
  'recebido' as const, 'em_extracao' as const, 'aguardando_revisao' as const,
  'em_validacao' as const, 'aguardando_aprovacao' as const, 'aprovado' as const,
  'rejeitado' as const, 'devolvido' as const, 'registrado_erp' as const,
  'erro_integracao' as const, 'pago' as const, 'cancelado' as const,
);

/** Generates a valid indiceConfiancaPorCampo record */
const arbIndiceConfianca = fc.dictionary(
  fc.constantFrom('cnpjEmitente', 'cnpjDestinatario', 'valorTotal', 'dataEmissao', 'dataVencimento'),
  fc.integer({ min: 0, max: 100 }),
);

/** Generates a complete valid DocumentoFiscalJSON */
const arbDocumentoFiscal: fc.Arbitrary<DocumentoFiscalJSON> = fc.record({
  protocoloUnico: arbProtocoloUnico,
  cnpjEmitente: arbCNPJ,
  cnpjDestinatario: arbCNPJ,
  numeroDocumento: arbNumeroDocumento,
  dataEmissao: arbISODate,
  dataVencimento: arbISODate,
  valorTotal: fc.nat({ max: 100_000_000 }),
  itensLinha: fc.array(arbItemLinha, { minLength: 0, maxLength: 5 }),
  impostos: fc.array(arbImposto, { minLength: 0, maxLength: 5 }),
  tipoDocumento: arbTipoDocumento,
  canalOrigem: arbCanalOrigem,
  status: arbStatus,
  indiceConfiancaPorCampo: arbIndiceConfianca,
  dataRecebimento: arbISODate,
  analistaResponsavel: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  aprovadorDesignado: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  erpTransactionId: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  createdAt: arbISODate,
  updatedAt: arbISODate,
});

// --- Property Tests ---

describe('Round-trip de serialização/desserialização', () => {
  /**
   * **Validates: Requirements 2.7, 10.4**
   *
   * Propriedade 1: Round-trip de serialização/desserialização
   * Para qualquer DocumentoFiscal válido, JSON.parse(JSON.stringify(doc)) deve
   * produzir objeto equivalente ao original. Serializar → desserializar →
   * serializar novamente deve produzir JSON idêntico.
   */
  it('JSON.parse(JSON.stringify(doc)) deve produzir objeto equivalente ao original', () => {
    fc.assert(
      fc.property(arbDocumentoFiscal, (doc) => {
        // Verify the generated doc is valid according to schema
        const preValidation = validateDocumentoFiscal(doc);
        expect(preValidation.valid).toBe(true);

        // Round-trip: serialize → deserialize
        const serialized = JSON.stringify(doc);
        const deserialized = JSON.parse(serialized);

        // The deserialized object must be deeply equal to the original
        expect(deserialized).toEqual(doc);

        // The deserialized object must still be valid
        const postValidation = validateDocumentoFiscal(deserialized);
        expect(postValidation.valid).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('serializar → desserializar → serializar novamente deve produzir JSON idêntico', () => {
    fc.assert(
      fc.property(arbDocumentoFiscal, (doc) => {
        // First serialization
        const json1 = JSON.stringify(doc);

        // Deserialize
        const parsed = JSON.parse(json1);

        // Second serialization
        const json2 = JSON.stringify(parsed);

        // Both JSON strings must be identical
        expect(json2).toBe(json1);
      }),
      { numRuns: 200 },
    );
  });
});
