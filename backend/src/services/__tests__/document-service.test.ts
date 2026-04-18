import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../document-service';
import { AuditService } from '../audit-service';
import type { FileInput } from '@ap-automation/shared';

function makeFile(overrides: Partial<FileInput> = {}): FileInput {
  return {
    name: 'invoice.pdf',
    size: 1024,
    type: 'application/pdf',
    buffer: Buffer.from('fake-pdf-content'),
    ...overrides,
  };
}

describe('DocumentService', () => {
  let auditService: AuditService;
  let service: DocumentService;

  beforeEach(() => {
    auditService = new AuditService();
    service = new DocumentService(auditService);
  });

  // ── receiveDocument ───────────────────────────────────────────

  describe('receiveDocument', () => {
    it('should generate a sequential Protocolo_Unico in AP-YYYYMMDD-NNNNNN format', async () => {
      const receipt = await service.receiveDocument(makeFile(), 'upload');
      expect(receipt.protocoloUnico).toMatch(/^AP-\d{8}-\d{6}$/);
    });

    it('should return a receipt with correct channel and status', async () => {
      const receipt = await service.receiveDocument(makeFile(), 'email');
      expect(receipt.canalOrigem).toBe('email');
      expect(receipt.status).toBe('recebido');
      expect(receipt.dataRecebimento).toBeInstanceOf(Date);
    });

    it('should generate unique protocolo for each document', async () => {
      const r1 = await service.receiveDocument(makeFile(), 'upload');
      const r2 = await service.receiveDocument(makeFile(), 'upload');
      expect(r1.protocoloUnico).not.toBe(r2.protocoloUnico);
    });

    it('should accept PDF files', async () => {
      const receipt = await service.receiveDocument(
        makeFile({ name: 'doc.pdf', type: 'application/pdf' }),
        'upload',
      );
      expect(receipt.tipoDocumento).toBe('boleto');
    });

    it('should accept XML files', async () => {
      const receipt = await service.receiveDocument(
        makeFile({ name: 'nfe.xml', type: 'application/xml' }),
        'api',
      );
      expect(receipt.tipoDocumento).toBe('nota_fiscal');
    });

    it('should accept JPEG files', async () => {
      const receipt = await service.receiveDocument(
        makeFile({ name: 'scan.jpeg', type: 'image/jpeg' }),
        'upload',
      );
      expect(receipt.tipoDocumento).toBe('fatura');
    });

    it('should accept PNG files', async () => {
      const receipt = await service.receiveDocument(
        makeFile({ name: 'scan.png', type: 'image/png' }),
        'upload',
      );
      expect(receipt.tipoDocumento).toBe('fatura');
    });

    it('should reject unsupported file formats with descriptive error', async () => {
      await expect(
        service.receiveDocument(
          makeFile({ name: 'doc.docx', type: 'application/vnd.openxmlformats' }),
          'upload',
        ),
      ).rejects.toThrow(/Formato não suportado.*docx.*Formatos aceitos/);
    });

    it('should reject files exceeding 25 MB', async () => {
      const bigFile = makeFile({ size: 26 * 1024 * 1024 });
      await expect(
        service.receiveDocument(bigFile, 'upload'),
      ).rejects.toThrow(/excede o tamanho máximo de 25 MB/);
    });

    it('should log receipt to audit trail', async () => {
      await service.receiveDocument(makeFile(), 'upload');
      expect(auditService.count).toBe(1);
      const log = await auditService.query({ page: 1, pageSize: 10 });
      expect(log.items[0].tipoAcao).toBe('documento_recebido');
    });
  });

  // ── receiveBatch ──────────────────────────────────────────────

  describe('receiveBatch', () => {
    it('should process each file individually with separate protocolo', async () => {
      const files = [
        makeFile({ name: 'a.pdf' }),
        makeFile({ name: 'b.xml' }),
        makeFile({ name: 'c.png' }),
      ];
      const receipts = await service.receiveBatch(files, 'upload');
      expect(receipts).toHaveLength(3);
      const protocolos = receipts.map((r) => r.protocoloUnico);
      expect(new Set(protocolos).size).toBe(3);
    });

    it('should classify each file independently', async () => {
      const files = [
        makeFile({ name: 'nfe.xml' }),
        makeFile({ name: 'boleto.pdf' }),
      ];
      const receipts = await service.receiveBatch(files, 'api');
      expect(receipts[0].tipoDocumento).toBe('nota_fiscal');
      expect(receipts[1].tipoDocumento).toBe('boleto');
    });
  });

  // ── classifyDocument ──────────────────────────────────────────

  describe('classifyDocument', () => {
    it('should return the document type for a known protocolo', async () => {
      const receipt = await service.receiveDocument(
        makeFile({ name: 'nfe.xml' }),
        'upload',
      );
      const tipo = await service.classifyDocument(receipt.protocoloUnico);
      expect(tipo).toBe('nota_fiscal');
    });

    it('should throw for unknown protocolo', async () => {
      await expect(
        service.classifyDocument('AP-99999999-999999'),
      ).rejects.toThrow(/Documento não encontrado/);
    });
  });

  // ── getDocument ───────────────────────────────────────────────

  describe('getDocument', () => {
    it('should return the stored document', async () => {
      const receipt = await service.receiveDocument(makeFile(), 'upload');
      const doc = await service.getDocument(receipt.protocoloUnico);
      expect(doc.protocoloUnico).toBe(receipt.protocoloUnico);
      expect(doc.status).toBe('recebido');
      expect(doc.canalOrigem).toBe('upload');
    });

    it('should throw for unknown protocolo', async () => {
      await expect(
        service.getDocument('AP-99999999-999999'),
      ).rejects.toThrow(/Documento não encontrado/);
    });
  });

  // ── listDocuments ─────────────────────────────────────────────

  describe('listDocuments', () => {
    it('should return paginated results', async () => {
      for (let i = 0; i < 5; i++) {
        await service.receiveDocument(makeFile(), 'upload');
      }
      const result = await service.listDocuments({ page: 1, pageSize: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it('should filter by status', async () => {
      await service.receiveDocument(makeFile(), 'upload');
      const result = await service.listDocuments({
        status: 'aprovado',
        page: 1,
        pageSize: 10,
      });
      expect(result.items).toHaveLength(0);
    });

    it('should return empty result when no documents match', async () => {
      const result = await service.listDocuments({ page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
