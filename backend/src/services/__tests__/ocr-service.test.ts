import { describe, it, expect, beforeEach } from 'vitest';
import { OCRService, ExternalOCRProvider } from '../ocr-service';
import type { ExtractionResult } from '@ap-automation/shared';

const REQUIRED_FIELD_NAMES = [
  'cnpjEmitente',
  'cnpjDestinatario',
  'numeroDocumento',
  'dataEmissao',
  'dataVencimento',
  'valorTotal',
  'itensLinha',
  'impostos',
];

function makeBuffer(content = 'fake-pdf-content'): Buffer {
  return Buffer.from(content);
}

describe('OCRService', () => {
  let service: OCRService;

  beforeEach(() => {
    service = new OCRService();
  });

  // ── extractData ──────────────────────────────────────────────

  describe('extractData', () => {
    it('should return a completed ExtractionResult with the correct protocoloUnico', async () => {
      const result = await service.extractData('AP-20240101-000001', makeBuffer());

      expect(result.protocoloUnico).toBe('AP-20240101-000001');
      expect(result.status).toBe('completed');
      expect(result.tempoProcessamento).toBeGreaterThanOrEqual(0);
    });

    it('should extract all required fields', async () => {
      const result = await service.extractData('AP-20240101-000001', makeBuffer());
      const fieldNames = result.campos.map((c) => c.nome);

      for (const name of REQUIRED_FIELD_NAMES) {
        expect(fieldNames).toContain(name);
      }
    });

    it('should assign indiceConfianca between 0 and 100 for every field', async () => {
      const result = await service.extractData('AP-20240101-000001', makeBuffer());

      for (const campo of result.campos) {
        expect(campo.indiceConfianca).toBeGreaterThanOrEqual(0);
        expect(campo.indiceConfianca).toBeLessThanOrEqual(100);
      }
    });

    it('should mark fields with indiceConfianca < 85 as requerRevisao: true', async () => {
      const result = await service.extractData('AP-20240101-000001', makeBuffer());

      for (const campo of result.campos) {
        if (campo.indiceConfianca < 85) {
          expect(campo.requerRevisao).toBe(true);
        }
      }
    });

    it('should mark fields with indiceConfianca >= 85 as requerRevisao: false', async () => {
      const result = await service.extractData('AP-20240101-000001', makeBuffer());

      for (const campo of result.campos) {
        if (campo.indiceConfianca >= 85) {
          expect(campo.requerRevisao).toBe(false);
        }
      }
    });

    it('should store the result for later status queries', async () => {
      await service.extractData('AP-20240101-000001', makeBuffer());
      const status = await service.getExtractionStatus('AP-20240101-000001');

      expect(status).toBe('completed');
    });
  });

  // ── getExtractionStatus ──────────────────────────────────────

  describe('getExtractionStatus', () => {
    it('should return pending for unknown protocoloUnico', async () => {
      const status = await service.getExtractionStatus('AP-99999999-999999');
      expect(status).toBe('pending');
    });

    it('should return completed after successful extraction', async () => {
      await service.extractData('AP-20240101-000001', makeBuffer());
      const status = await service.getExtractionStatus('AP-20240101-000001');
      expect(status).toBe('completed');
    });
  });

  // ── External provider integration ────────────────────────────

  describe('with external OCR provider', () => {
    it('should delegate to external provider when provided', async () => {
      const mockResult: ExtractionResult = {
        protocoloUnico: 'AP-20240101-000001',
        campos: [
          { nome: 'cnpjEmitente', valor: '11111111000111', indiceConfianca: 95, requerRevisao: false },
          { nome: 'valorTotal', valor: 50000, indiceConfianca: 60, requerRevisao: false },
        ],
        status: 'completed',
        tempoProcessamento: 150,
      };

      const provider: ExternalOCRProvider = {
        extract: async () => mockResult,
      };

      const serviceWithProvider = new OCRService(provider);
      const result = await serviceWithProvider.extractData('AP-20240101-000001', makeBuffer());

      expect(result.protocoloUnico).toBe('AP-20240101-000001');
      expect(result.status).toBe('completed');
    });

    it('should enforce confidence threshold on external provider results', async () => {
      const mockResult: ExtractionResult = {
        protocoloUnico: 'AP-20240101-000001',
        campos: [
          { nome: 'cnpjEmitente', valor: '11111111000111', indiceConfianca: 95, requerRevisao: false },
          { nome: 'valorTotal', valor: 50000, indiceConfianca: 60, requerRevisao: false },
        ],
        status: 'completed',
        tempoProcessamento: 150,
      };

      const provider: ExternalOCRProvider = {
        extract: async () => mockResult,
      };

      const serviceWithProvider = new OCRService(provider);
      const result = await serviceWithProvider.extractData('AP-20240101-000001', makeBuffer());

      const lowConfField = result.campos.find((c) => c.nome === 'valorTotal');
      expect(lowConfField?.requerRevisao).toBe(true);

      const highConfField = result.campos.find((c) => c.nome === 'cnpjEmitente');
      expect(highConfField?.requerRevisao).toBe(false);
    });

    it('should store external provider results for status queries', async () => {
      const mockResult: ExtractionResult = {
        protocoloUnico: 'AP-20240101-000002',
        campos: [],
        status: 'completed',
        tempoProcessamento: 100,
      };

      const provider: ExternalOCRProvider = {
        extract: async () => mockResult,
      };

      const serviceWithProvider = new OCRService(provider);
      await serviceWithProvider.extractData('AP-20240101-000002', makeBuffer());

      const status = await serviceWithProvider.getExtractionStatus('AP-20240101-000002');
      expect(status).toBe('completed');
    });
  });
});
