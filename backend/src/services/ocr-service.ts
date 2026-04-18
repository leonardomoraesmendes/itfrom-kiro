import type {
  IOCRService,
  ExtractionResult,
  ExtractionStatus,
  ExtractedField,
} from '@ap-automation/shared';

// ─── External OCR Provider Interface ─────────────────────────────────

/**
 * Interface for plugging in a real OCR provider in the future.
 * When provided, `extractData` delegates to this provider instead of
 * generating mock data.
 */
export interface ExternalOCRProvider {
  extract(protocoloUnico: string, buffer: Buffer): Promise<ExtractionResult>;
}

// ─── Constants ───────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 85;

const REQUIRED_FIELDS: Array<{
  nome: string;
  generate: () => string | number | Date;
}> = [
  { nome: 'cnpjEmitente', generate: () => '12345678000195' },
  { nome: 'cnpjDestinatario', generate: () => '98765432000100' },
  { nome: 'numeroDocumento', generate: () => `NF-${Date.now()}` },
  { nome: 'dataEmissao', generate: () => new Date().toISOString() },
  { nome: 'dataVencimento', generate: () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  }},
  { nome: 'valorTotal', generate: () => Math.floor(Math.random() * 1_000_000) + 1000 },
  { nome: 'itensLinha', generate: () => JSON.stringify([
    { descricao: 'Item 1', quantidade: 2, valorUnitario: 5000, valorTotal: 10000 },
  ])},
  { nome: 'impostos', generate: () => JSON.stringify([
    { tipo: 'ICMS', baseCalculo: 10000, aliquota: 18, valor: 1800 },
  ])},
];

// ─── Helpers ─────────────────────────────────────────────────────────

function randomConfidence(): number {
  return Math.floor(Math.random() * 101); // 0-100
}

function buildMockFields(): ExtractedField[] {
  return REQUIRED_FIELDS.map(({ nome, generate }) => {
    const indiceConfianca = randomConfidence();
    return {
      nome,
      valor: generate(),
      indiceConfianca,
      requerRevisao: indiceConfianca < CONFIDENCE_THRESHOLD,
    };
  });
}

// ─── OCRService ──────────────────────────────────────────────────────

export class OCRService implements IOCRService {
  private readonly results = new Map<string, ExtractionResult>();
  private readonly externalProvider?: ExternalOCRProvider;

  constructor(externalProvider?: ExternalOCRProvider) {
    this.externalProvider = externalProvider;
  }

  async extractData(
    protocoloUnico: string,
    documentBuffer: Buffer,
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Delegate to external provider if available
    if (this.externalProvider) {
      const result = await this.externalProvider.extract(protocoloUnico, documentBuffer);
      // Enforce confidence threshold rule on external results too
      result.campos = result.campos.map((campo) => ({
        ...campo,
        requerRevisao: campo.indiceConfianca < CONFIDENCE_THRESHOLD,
      }));
      this.results.set(protocoloUnico, result);
      return result;
    }

    // Mock extraction — simulates OCR processing
    const campos = buildMockFields();
    const tempoProcessamento = Date.now() - startTime;

    const result: ExtractionResult = {
      protocoloUnico,
      campos,
      status: 'completed',
      tempoProcessamento,
    };

    this.results.set(protocoloUnico, result);
    return result;
  }

  async getExtractionStatus(protocoloUnico: string): Promise<ExtractionStatus> {
    const result = this.results.get(protocoloUnico);
    if (!result) {
      return 'pending';
    }
    return result.status;
  }
}
