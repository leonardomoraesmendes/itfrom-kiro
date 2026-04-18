import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from '../validation-service';
import { AuditService } from '../audit-service';
import type { DocumentoFiscal, ExceptionDecision } from '@ap-automation/shared';

function makeDoc(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
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
    itensLinha: [
      { descricao: 'Item A', quantidade: 2, valorUnitario: 2500, valorTotal: 5000 },
      { descricao: 'Item B', quantidade: 1, valorUnitario: 5000, valorTotal: 5000 },
    ],
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

describe('ValidationService', () => {
  let auditService: AuditService;
  let documentStore: DocumentoFiscal[];
  let service: ValidationService;

  beforeEach(() => {
    auditService = new AuditService();
    documentStore = [];
    service = new ValidationService(auditService, documentStore);
  });

  // ── validateDocument ────────────────────────────────────────────

  describe('validateDocument', () => {
    it('should approve a fully valid document', async () => {
      const doc = makeDoc();
      const result = await service.validateDocument(doc);

      expect(result.aprovado).toBe(true);
      expect(result.protocoloUnico).toBe(doc.protocoloUnico);
      expect(result.regras).toHaveLength(4);
      expect(result.regras.every((r) => r.status === 'aprovada')).toBe(true);
    });

    it('should fail CNPJ validation when emitente has wrong length', async () => {
      const doc = makeDoc({ cnpjEmitente: '123' });
      const result = await service.validateDocument(doc);

      expect(result.aprovado).toBe(false);
      const cnpjRule = result.regras.find((r) => r.regra === 'consistencia_cnpj');
      expect(cnpjRule?.status).toBe('reprovada');
      expect(cnpjRule?.detalhes).toContain('emitente');
    });

    it('should fail CNPJ validation when destinatario has wrong length', async () => {
      const doc = makeDoc({ cnpjDestinatario: '999' });
      const result = await service.validateDocument(doc);

      expect(result.aprovado).toBe(false);
      const cnpjRule = result.regras.find((r) => r.regra === 'consistencia_cnpj');
      expect(cnpjRule?.status).toBe('reprovada');
      expect(cnpjRule?.detalhes).toContain('destinatário');
    });

    it('should fail when dataVencimento is in the past', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      const doc = makeDoc({ dataVencimento: past });
      const result = await service.validateDocument(doc);

      expect(result.aprovado).toBe(false);
      const dateRule = result.regras.find((r) => r.regra === 'validade_data_vencimento');
      expect(dateRule?.status).toBe('reprovada');
    });

    it('should approve when dataVencimento is today', async () => {
      const today = new Date();
      const doc = makeDoc({ dataVencimento: today });
      const result = await service.validateDocument(doc);

      const dateRule = result.regras.find((r) => r.regra === 'validade_data_vencimento');
      expect(dateRule?.status).toBe('aprovada');
    });

    it('should fail when valorTotal does not match sum of itensLinha', async () => {
      const doc = makeDoc({ valorTotal: 99999 });
      const result = await service.validateDocument(doc);

      expect(result.aprovado).toBe(false);
      const valorRule = result.regras.find((r) => r.regra === 'coerencia_valor_total');
      expect(valorRule?.status).toBe('reprovada');
    });

    it('should approve when document has no itensLinha', async () => {
      const doc = makeDoc({ itensLinha: [], valorTotal: 5000 });
      const result = await service.validateDocument(doc);

      const valorRule = result.regras.find((r) => r.regra === 'coerencia_valor_total');
      expect(valorRule?.status).toBe('aprovada');
    });

    it('should approve fornecedor (stub always passes)', async () => {
      const doc = makeDoc();
      const result = await service.validateDocument(doc);

      const fornRule = result.regras.find((r) => r.regra === 'existencia_fornecedor');
      expect(fornRule?.status).toBe('aprovada');
    });

    it('should log validation to audit trail', async () => {
      const doc = makeDoc();
      await service.validateDocument(doc);

      expect(auditService.count).toBe(1);
      const entries = await auditService.query({ page: 1, pageSize: 10 });
      expect(entries.items[0].tipoAcao).toBe('validacao_executada');
      expect(entries.items[0].protocoloUnico).toBe(doc.protocoloUnico);
    });
  });

  // ── checkDuplicate ──────────────────────────────────────────────

  describe('checkDuplicate', () => {
    it('should detect duplicate with same CNPJ, number, and value', async () => {
      const existing = makeDoc();
      documentStore.push(existing);

      const newDoc = makeDoc({ protocoloUnico: 'AP-20250101-000002' });
      const result = await service.checkDuplicate(newDoc);

      expect(result.duplicataDetectada).toBe(true);
      expect(result.documentosSimilares).toHaveLength(1);
      expect(result.criterios.cnpjEmitente).toBe(true);
      expect(result.criterios.numeroDocumento).toBe(true);
      expect(result.criterios.valorDentroTolerancia).toBe(true);
    });

    it('should detect duplicate when value is within 1% tolerance', async () => {
      const existing = makeDoc({ valorTotal: 10000 });
      documentStore.push(existing);

      // 10000 * 0.01 = 100 → 10099 is within tolerance
      const newDoc = makeDoc({ protocoloUnico: 'AP-20250101-000002', valorTotal: 10099 });
      const result = await service.checkDuplicate(newDoc);

      expect(result.duplicataDetectada).toBe(true);
    });

    it('should NOT detect duplicate when value exceeds 1% tolerance', async () => {
      const existing = makeDoc({ valorTotal: 10000 });
      documentStore.push(existing);

      // 10000 * 0.01 = 100 → 10200 exceeds tolerance
      const newDoc = makeDoc({ protocoloUnico: 'AP-20250101-000002', valorTotal: 10200 });
      const result = await service.checkDuplicate(newDoc);

      expect(result.duplicataDetectada).toBe(false);
    });

    it('should NOT detect duplicate when CNPJ differs', async () => {
      const existing = makeDoc();
      documentStore.push(existing);

      const newDoc = makeDoc({
        protocoloUnico: 'AP-20250101-000002',
        cnpjEmitente: '11111111000111',
      });
      const result = await service.checkDuplicate(newDoc);

      expect(result.duplicataDetectada).toBe(false);
    });

    it('should NOT detect duplicate when document number differs', async () => {
      const existing = makeDoc();
      documentStore.push(existing);

      const newDoc = makeDoc({
        protocoloUnico: 'AP-20250101-000002',
        numeroDocumento: 'NF-999',
      });
      const result = await service.checkDuplicate(newDoc);

      expect(result.duplicataDetectada).toBe(false);
    });

    it('should not match a document against itself', async () => {
      const doc = makeDoc();
      documentStore.push(doc);

      const result = await service.checkDuplicate(doc);
      expect(result.duplicataDetectada).toBe(false);
    });

    it('should return empty result when store is empty', async () => {
      const doc = makeDoc();
      const result = await service.checkDuplicate(doc);

      expect(result.duplicataDetectada).toBe(false);
      expect(result.documentosSimilares).toHaveLength(0);
    });
  });

  // ── resolveException ────────────────────────────────────────────

  describe('resolveException', () => {
    it('should log liberação to audit trail', async () => {
      const decision: ExceptionDecision = {
        tipo: 'liberar',
        justificativa: 'Documento legítimo, fornecedor confirmou',
        usuarioId: 'analista-01',
      };

      await service.resolveException('AP-20250101-000001', decision);

      const entries = await auditService.query({ page: 1, pageSize: 10 });
      expect(entries.items).toHaveLength(1);
      expect(entries.items[0].tipoAcao).toBe('duplicata_liberada');
      expect(entries.items[0].justificativa).toBe(decision.justificativa);
      expect(entries.items[0].destaque).toBe(true);
    });

    it('should log rejeição to audit trail', async () => {
      const decision: ExceptionDecision = {
        tipo: 'rejeitar',
        justificativa: 'Duplicata confirmada',
        usuarioId: 'analista-01',
      };

      await service.resolveException('AP-20250101-000001', decision);

      const entries = await auditService.query({ page: 1, pageSize: 10 });
      expect(entries.items[0].tipoAcao).toBe('duplicata_rejeitada');
      expect(entries.items[0].destaque).toBe(false);
    });

    it('should throw when justificativa is empty', async () => {
      const decision: ExceptionDecision = {
        tipo: 'liberar',
        justificativa: '',
        usuarioId: 'analista-01',
      };

      await expect(
        service.resolveException('AP-20250101-000001', decision),
      ).rejects.toThrow('Justificativa é obrigatória');
    });

    it('should throw when justificativa is only whitespace', async () => {
      const decision: ExceptionDecision = {
        tipo: 'liberar',
        justificativa: '   ',
        usuarioId: 'analista-01',
      };

      await expect(
        service.resolveException('AP-20250101-000001', decision),
      ).rejects.toThrow('Justificativa é obrigatória');
    });
  });
});
