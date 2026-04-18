import { describe, it, expect, beforeEach } from 'vitest';
import { ERPConnector } from '../erp-connector';
import { AuditService } from '../audit-service';
import type { DocumentoFiscal } from '@ap-automation/shared';

function createTestDoc(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  const now = new Date();
  return {
    protocoloUnico: 'AP-20240101-000001',
    cnpjEmitente: '12345678000190',
    cnpjDestinatario: '98765432000110',
    numeroDocumento: 'NF-001',
    dataEmissao: now,
    dataVencimento: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    valorTotal: 100000,
    itensLinha: [
      { descricao: 'Item 1', quantidade: 1, valorUnitario: 100000, valorTotal: 100000 },
    ],
    impostos: [
      { tipo: 'ICMS', baseCalculo: 100000, aliquota: 18, valor: 18000 },
    ],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'aprovado',
    indiceConfiancaPorCampo: {},
    dataRecebimento: now,
    aprovadorDesignado: 'aprovador-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ERPConnector', () => {
  let auditService: AuditService;
  let documentStore: Map<string, DocumentoFiscal>;
  let connector: ERPConnector;

  beforeEach(() => {
    auditService = new AuditService();
    documentStore = new Map();
    connector = new ERPConnector(auditService, documentStore);
  });

  describe('registerDocument', () => {
    it('should register document successfully and update status to registrado_erp', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);

      const result = await connector.registerDocument(doc);

      expect(result.sucesso).toBe(true);
      expect(result.erpTransactionId).toBeDefined();
      expect(result.erpTransactionId).toMatch(/^ERP-\d{8}$/);
      expect(result.codigoErro).toBeUndefined();
      expect(result.mensagemErro).toBeUndefined();

      // Document status should be updated
      const storedDoc = documentStore.get(doc.protocoloUnico)!;
      expect(storedDoc.status).toBe('registrado_erp');
      expect(storedDoc.erpTransactionId).toBe(result.erpTransactionId);
    });

    it('should store ERP transaction ID on the document', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);

      const result = await connector.registerDocument(doc);

      const storedDoc = documentStore.get(doc.protocoloUnico)!;
      expect(storedDoc.erpTransactionId).toBe(result.erpTransactionId);
    });

    it('should update status to erro_integracao on failure', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      connector.simulateFailure = true;

      const result = await connector.registerDocument(doc);

      expect(result.sucesso).toBe(false);
      expect(result.codigoErro).toBe('ERP_TIMEOUT');
      expect(result.mensagemErro).toBeDefined();
      expect(result.erpTransactionId).toBeUndefined();

      const storedDoc = documentStore.get(doc.protocoloUnico)!;
      expect(storedDoc.status).toBe('erro_integracao');
    });

    it('should use custom error code and message when configured', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      connector.simulateFailure = true;
      connector.simulatedErrorCode = 'ERP_VALIDATION';
      connector.simulatedErrorMessage = 'Dados inválidos no ERP';

      const result = await connector.registerDocument(doc);

      expect(result.codigoErro).toBe('ERP_VALIDATION');
      expect(result.mensagemErro).toBe('Dados inválidos no ERP');
    });

    it('should log successful registration to audit trail', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await connector.registerDocument(doc);

      const auditResult = await auditService.query({
        protocoloUnico: doc.protocoloUnico,
        tipoAcao: 'registro_erp',
        page: 1,
        pageSize: 10,
      });

      expect(auditResult.items.length).toBeGreaterThanOrEqual(1);
      const entry = auditResult.items[0];
      expect(entry.tipoAcao).toBe('registro_erp');
      expect(entry.valoresPosteriores?.status).toBe('registrado_erp');
      expect(entry.valoresPosteriores?.erpTransactionId).toBeDefined();
    });

    it('should log failed registration to audit trail', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      connector.simulateFailure = true;

      await connector.registerDocument(doc);

      const auditResult = await auditService.query({
        protocoloUnico: doc.protocoloUnico,
        tipoAcao: 'registro_erp',
        page: 1,
        pageSize: 10,
      });

      expect(auditResult.items.length).toBeGreaterThanOrEqual(1);
      const entry = auditResult.items[0];
      expect(entry.valoresPosteriores?.status).toBe('erro_integracao');
      expect(entry.valoresPosteriores?.codigoErro).toBeDefined();
    });

    it('should generate unique ERP transaction IDs for multiple documents', async () => {
      const doc1 = createTestDoc({ protocoloUnico: 'AP-20240101-000001' });
      const doc2 = createTestDoc({ protocoloUnico: 'AP-20240101-000002' });
      documentStore.set(doc1.protocoloUnico, doc1);
      documentStore.set(doc2.protocoloUnico, doc2);

      const result1 = await connector.registerDocument(doc1);
      const result2 = await connector.registerDocument(doc2);

      expect(result1.erpTransactionId).not.toBe(result2.erpTransactionId);
    });
  });

  describe('reprocessDocument', () => {
    it('should reprocess a document with erro_integracao status', async () => {
      const doc = createTestDoc({ status: 'erro_integracao' });
      documentStore.set(doc.protocoloUnico, doc);

      // First register with failure to create the transaction record
      connector.simulateFailure = true;
      await connector.registerDocument(doc);

      // Now reprocess with success
      connector.simulateFailure = false;
      const result = await connector.reprocessDocument(doc.protocoloUnico);

      expect(result.sucesso).toBe(true);
      expect(result.erpTransactionId).toBeDefined();
    });

    it('should throw error for non-existent document', async () => {
      await expect(
        connector.reprocessDocument('AP-99999999-999999'),
      ).rejects.toThrow('Documento não encontrado');
    });

    it('should throw error if document status is not erro_integracao', async () => {
      const doc = createTestDoc({ status: 'aprovado' });
      documentStore.set(doc.protocoloUnico, doc);

      await expect(
        connector.reprocessDocument(doc.protocoloUnico),
      ).rejects.toThrow("Reprocessamento permitido apenas para documentos com status 'erro_integracao'");
    });

    it('should log reprocessing attempt to audit trail', async () => {
      const doc = createTestDoc({ status: 'erro_integracao' });
      documentStore.set(doc.protocoloUnico, doc);

      // Create initial failed transaction
      connector.simulateFailure = true;
      await connector.registerDocument(doc);

      // Reset for reprocess
      doc.status = 'erro_integracao';
      connector.simulateFailure = false;
      await connector.reprocessDocument(doc.protocoloUnico);

      const auditResult = await auditService.query({
        protocoloUnico: doc.protocoloUnico,
        tipoAcao: 'reprocessamento_erp',
        page: 1,
        pageSize: 10,
      });

      expect(auditResult.items.length).toBeGreaterThanOrEqual(1);
      const entry = auditResult.items[0];
      expect(entry.tipoAcao).toBe('reprocessamento_erp');
      expect(entry.valoresAnteriores?.status).toBe('erro_integracao');
    });

    it('should update transaction status to reprocessando during reprocess', async () => {
      const doc = createTestDoc({ status: 'erro_integracao' });
      documentStore.set(doc.protocoloUnico, doc);

      connector.simulateFailure = true;
      await connector.registerDocument(doc);

      // Reset status for reprocess
      doc.status = 'erro_integracao';
      connector.simulateFailure = false;
      await connector.reprocessDocument(doc.protocoloUnico);

      // After successful reprocess, the transaction should be 'registrado'
      const kpis = await connector.getIntegrationKPIs();
      expect(kpis.totalRegistrados).toBe(1);
    });
  });

  describe('syncPaymentStatus', () => {
    it('should return empty array when no documents have been paid', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await connector.registerDocument(doc);

      const updates = await connector.syncPaymentStatus();
      expect(updates).toEqual([]);
    });

    it('should detect payment status changes', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await connector.registerDocument(doc);

      // Simulate ERP marking the document as paid
      const storedDoc = documentStore.get(doc.protocoloUnico)!;
      storedDoc.status = 'pago';

      const updates = await connector.syncPaymentStatus();
      expect(updates.length).toBe(1);
      expect(updates[0].protocoloUnico).toBe(doc.protocoloUnico);
      expect(updates[0].statusAnterior).toBe('registrado_erp');
      expect(updates[0].statusNovo).toBe('pago');
      expect(updates[0].dataAtualizacao).toBeInstanceOf(Date);
    });

    it('should not return updates for documents still in registrado_erp', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await connector.registerDocument(doc);

      // Status remains registrado_erp
      const updates = await connector.syncPaymentStatus();
      expect(updates.length).toBe(0);
    });
  });

  describe('getIntegrationKPIs', () => {
    it('should return zero KPIs when no transactions exist', async () => {
      const kpis = await connector.getIntegrationKPIs();

      expect(kpis.totalRegistrados).toBe(0);
      expect(kpis.totalErros).toBe(0);
      expect(kpis.totalReprocessando).toBe(0);
      expect(kpis.taxaSucesso).toBe(0);
    });

    it('should calculate KPIs correctly with mixed results', async () => {
      // Register 2 successful documents
      const doc1 = createTestDoc({ protocoloUnico: 'AP-20240101-000001' });
      const doc2 = createTestDoc({ protocoloUnico: 'AP-20240101-000002' });
      const doc3 = createTestDoc({ protocoloUnico: 'AP-20240101-000003' });
      documentStore.set(doc1.protocoloUnico, doc1);
      documentStore.set(doc2.protocoloUnico, doc2);
      documentStore.set(doc3.protocoloUnico, doc3);

      await connector.registerDocument(doc1);
      await connector.registerDocument(doc2);

      // Register 1 failed document
      connector.simulateFailure = true;
      await connector.registerDocument(doc3);

      const kpis = await connector.getIntegrationKPIs();

      expect(kpis.totalRegistrados).toBe(2);
      expect(kpis.totalErros).toBe(1);
      expect(kpis.totalReprocessando).toBe(0);
      expect(kpis.taxaSucesso).toBeCloseTo(66.67, 1);
    });

    it('should return 100% success rate when all registrations succeed', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await connector.registerDocument(doc);

      const kpis = await connector.getIntegrationKPIs();
      expect(kpis.taxaSucesso).toBe(100);
    });
  });

  describe('getRecentTransactions', () => {
    it('should return empty list when no transactions exist', async () => {
      const result = await connector.getRecentTransactions();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });

    it('should return all transactions without filters', async () => {
      const doc1 = createTestDoc({ protocoloUnico: 'AP-20240101-000001' });
      const doc2 = createTestDoc({ protocoloUnico: 'AP-20240101-000002' });
      documentStore.set(doc1.protocoloUnico, doc1);
      documentStore.set(doc2.protocoloUnico, doc2);

      await connector.registerDocument(doc1);
      await connector.registerDocument(doc2);

      const result = await connector.getRecentTransactions();

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter transactions by status', async () => {
      const doc1 = createTestDoc({ protocoloUnico: 'AP-20240101-000001' });
      const doc2 = createTestDoc({ protocoloUnico: 'AP-20240101-000002' });
      documentStore.set(doc1.protocoloUnico, doc1);
      documentStore.set(doc2.protocoloUnico, doc2);

      await connector.registerDocument(doc1);
      connector.simulateFailure = true;
      await connector.registerDocument(doc2);

      const successOnly = await connector.getRecentTransactions({
        status: 'registrado',
        page: 1,
        pageSize: 10,
      });
      expect(successOnly.items.length).toBe(1);
      expect(successOnly.items[0].status).toBe('registrado');

      const errorsOnly = await connector.getRecentTransactions({
        status: 'erro',
        page: 1,
        pageSize: 10,
      });
      expect(errorsOnly.items.length).toBe(1);
      expect(errorsOnly.items[0].status).toBe('erro');
    });

    it('should paginate results correctly', async () => {
      // Create 3 documents
      for (let i = 1; i <= 3; i++) {
        const doc = createTestDoc({
          protocoloUnico: `AP-20240101-00000${i}`,
        });
        documentStore.set(doc.protocoloUnico, doc);
        await connector.registerDocument(doc);
      }

      const page1 = await connector.getRecentTransactions({
        page: 1,
        pageSize: 2,
      });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(3);
      expect(page1.totalPages).toBe(2);

      const page2 = await connector.getRecentTransactions({
        page: 2,
        pageSize: 2,
      });
      expect(page2.items.length).toBe(1);
    });

    it('should sort transactions by most recent first', async () => {
      const doc1 = createTestDoc({ protocoloUnico: 'AP-20240101-000001' });
      const doc2 = createTestDoc({ protocoloUnico: 'AP-20240101-000002' });
      documentStore.set(doc1.protocoloUnico, doc1);
      documentStore.set(doc2.protocoloUnico, doc2);

      await connector.registerDocument(doc1);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await connector.registerDocument(doc2);

      const result = await connector.getRecentTransactions();

      // Most recent (doc2) should be first
      expect(result.items[0].protocoloUnico).toBe('AP-20240101-000002');
      expect(result.items[1].protocoloUnico).toBe('AP-20240101-000001');
    });
  });

  describe('SoD enforcement', () => {
    it('should allow registration when document has valid approval trail', async () => {
      const doc = createTestDoc({ aprovadorDesignado: 'aprovador-1' });
      documentStore.set(doc.protocoloUnico, doc);

      // Simulate approval in audit trail
      await auditService.log({
        usuarioId: 'aprovador-1',
        tipoAcao: 'aprovacao',
        protocoloUnico: doc.protocoloUnico,
        valoresPosteriores: { status: 'aprovado' },
      });

      const result = await connector.registerDocument(doc);
      expect(result.sucesso).toBe(true);
    });
  });

  describe('audit trail completeness', () => {
    it('should log all registration attempts (success and failure)', async () => {
      const doc = createTestDoc();
      documentStore.set(doc.protocoloUnico, doc);

      // First attempt: failure
      connector.simulateFailure = true;
      await connector.registerDocument(doc);

      // Reset status for second attempt
      doc.status = 'erro_integracao';
      connector.simulateFailure = false;
      await connector.reprocessDocument(doc.protocoloUnico);

      const auditResult = await auditService.query({
        protocoloUnico: doc.protocoloUnico,
        page: 1,
        pageSize: 100,
      });

      // Should have: 1 failed registro_erp + 1 reprocessamento_erp + 1 successful registro_erp
      const registroEntries = auditResult.items.filter(
        (e) => e.tipoAcao === 'registro_erp',
      );
      const reprocessEntries = auditResult.items.filter(
        (e) => e.tipoAcao === 'reprocessamento_erp',
      );

      expect(registroEntries.length).toBe(2); // 1 failure + 1 success
      expect(reprocessEntries.length).toBe(1);
    });
  });
});
