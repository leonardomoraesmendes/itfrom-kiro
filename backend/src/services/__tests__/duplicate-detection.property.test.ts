import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ValidationService } from '../validation-service';
import { AuditService } from '../audit-service';
import type { DocumentoFiscal } from '@ap-automation/shared';

// --- Helpers ---

function makeBaseDoc(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + 30);

  return {
    protocoloUnico: 'AP-20250101-000001',
    cnpjEmitente: '12345678000199',
    cnpjDestinatario: '98765432000188',
    numeroDocumento: 'NF-001',
    dataEmissao: now,
    dataVencimento: future,
    valorTotal: 10000,
    itensLinha: [],
    impostos: [],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'em_validacao',
    indiceConfiancaPorCampo: {},
    dataRecebimento: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// --- Arbitraries ---

const arbCnpj: fc.Arbitrary<string> = fc.stringMatching(/^\d{14}$/);

const arbNumeroDocumento: fc.Arbitrary<string> = fc.stringMatching(
  /^[A-Z0-9\-]{1,20}$/,
);

// Positive integer values in centavos (1 to 100_000_000 = R$1.000.000,00)
const arbValorTotal: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100_000_000 });

// --- Property Tests ---

describe('Propriedade 3: Detecção de duplicidade com tolerância de 1%', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * Para dois documentos com mesmo CNPJ emitente e mesmo número,
   * se |valorA - valorB| / max(valorA, valorB) <= 0.01,
   * então checkDuplicate deve retornar duplicataDetectada: true.
   */
  it('detecta duplicata quando mesmo CNPJ, mesmo número e valor dentro de 1%', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCnpj,
        arbNumeroDocumento,
        arbValorTotal,
        fc.double({ min: 0, max: 0.01, noNaN: true }),
        async (cnpj, numero, valorBase, fracao) => {
          // Compute valorB such that |valorA - valorB| / max(valorA, valorB) <= 0.01
          const delta = Math.floor(valorBase * fracao);
          const valorB = valorBase + delta;

          // Verify the tolerance condition holds
          const maxVal = Math.max(valorBase, valorB);
          if (maxVal === 0) return; // skip degenerate case
          const ratio = Math.abs(valorBase - valorB) / maxVal;
          fc.pre(ratio <= 0.01);

          const existing = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000001',
            cnpjEmitente: cnpj,
            numeroDocumento: numero,
            valorTotal: valorBase,
          });

          const newDoc = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000002',
            cnpjEmitente: cnpj,
            numeroDocumento: numero,
            valorTotal: valorB,
          });

          const auditService = new AuditService();
          const service = new ValidationService(auditService, [existing]);
          const result = await service.checkDuplicate(newDoc);

          expect(result.duplicataDetectada).toBe(true);
          expect(result.criterios.cnpjEmitente).toBe(true);
          expect(result.criterios.numeroDocumento).toBe(true);
          expect(result.criterios.valorDentroTolerancia).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Se a diferença de valor exceder 1%, não deve ser detectada como duplicata
   * (considerando mesmo CNPJ emitente e mesmo número de documento).
   */
  it('NÃO detecta duplicata quando valor excede tolerância de 1%', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCnpj,
        arbNumeroDocumento,
        arbValorTotal,
        fc.double({ min: 0.02, max: 1.0, noNaN: true }),
        async (cnpj, numero, valorBase, fracao) => {
          // Compute valorB such that |valorA - valorB| / max(valorA, valorB) > 0.01
          const delta = Math.max(1, Math.floor(valorBase * fracao));
          const valorB = valorBase + delta;

          const maxVal = Math.max(valorBase, valorB);
          const ratio = Math.abs(valorBase - valorB) / maxVal;
          fc.pre(ratio > 0.01);

          const existing = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000001',
            cnpjEmitente: cnpj,
            numeroDocumento: numero,
            valorTotal: valorBase,
          });

          const newDoc = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000002',
            cnpjEmitente: cnpj,
            numeroDocumento: numero,
            valorTotal: valorB,
          });

          const auditService = new AuditService();
          const service = new ValidationService(auditService, [existing]);
          const result = await service.checkDuplicate(newDoc);

          expect(result.duplicataDetectada).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Documentos com CNPJ emitente diferente nunca devem ser detectados
   * como duplicata, independentemente do valor.
   */
  it('NÃO detecta duplicata quando CNPJ emitente difere', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCnpj,
        arbCnpj,
        arbNumeroDocumento,
        arbValorTotal,
        async (cnpjA, cnpjB, numero, valor) => {
          fc.pre(cnpjA !== cnpjB);

          const existing = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000001',
            cnpjEmitente: cnpjA,
            numeroDocumento: numero,
            valorTotal: valor,
          });

          const newDoc = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000002',
            cnpjEmitente: cnpjB,
            numeroDocumento: numero,
            valorTotal: valor,
          });

          const auditService = new AuditService();
          const service = new ValidationService(auditService, [existing]);
          const result = await service.checkDuplicate(newDoc);

          expect(result.duplicataDetectada).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Documentos com número de documento diferente nunca devem ser detectados
   * como duplicata, independentemente do valor.
   */
  it('NÃO detecta duplicata quando número de documento difere', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCnpj,
        arbNumeroDocumento,
        arbNumeroDocumento,
        arbValorTotal,
        async (cnpj, numeroA, numeroB, valor) => {
          fc.pre(numeroA !== numeroB);

          const existing = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000001',
            cnpjEmitente: cnpj,
            numeroDocumento: numeroA,
            valorTotal: valor,
          });

          const newDoc = makeBaseDoc({
            protocoloUnico: 'AP-20250101-000002',
            cnpjEmitente: cnpj,
            numeroDocumento: numeroB,
            valorTotal: valor,
          });

          const auditService = new AuditService();
          const service = new ValidationService(auditService, [existing]);
          const result = await service.checkDuplicate(newDoc);

          expect(result.duplicataDetectada).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
