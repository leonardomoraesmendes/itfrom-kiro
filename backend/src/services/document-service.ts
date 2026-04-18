import type {
  IDocumentService,
  DocumentChannel,
  DocumentType,
  DocumentReceipt,
  DocumentFilters,
  DocumentoFiscal,
  PaginatedResult,
  IAuditService,
  FileInput,
} from '@ap-automation/shared';

export type { FileInput } from '@ap-automation/shared';

// ─── Constants ───────────────────────────────────────────────────────

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/xml',
  'text/xml',
  'image/jpeg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.xml', '.jpeg', '.jpg', '.png']);

// ─── Helpers ─────────────────────────────────────────────────────────

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function classifyByExtension(filename: string): DocumentType {
  const ext = getFileExtension(filename);
  if (ext === '.xml') return 'nota_fiscal';
  if (ext === '.pdf') return 'boleto';
  return 'fatura';
}

// ─── DocumentService ─────────────────────────────────────────────────

export class DocumentService implements IDocumentService {
  private readonly store = new Map<string, DocumentoFiscal>();
  private sequenceCounter = 0;

  constructor(private readonly auditService: IAuditService) {}

  // ── Protocolo generation ────────────────────────────────────────

  private nextProtocolo(): string {
    this.sequenceCounter++;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const seq = String(this.sequenceCounter).padStart(6, '0');
    return `AP-${yyyy}${mm}${dd}-${seq}`;
  }

  // ── Validation ──────────────────────────────────────────────────

  private validateFile(file: FileInput): void {
    const ext = getFileExtension(file.name);

    if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(
        `Formato não suportado: "${file.name}". Formatos aceitos: PDF, XML, JPEG, PNG.`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `Arquivo "${file.name}" excede o tamanho máximo de 25 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      );
    }
  }

  // ── receiveDocument ─────────────────────────────────────────────

  async receiveDocument(
    file: FileInput,
    channel: DocumentChannel,
  ): Promise<DocumentReceipt> {
    this.validateFile(file);

    const protocoloUnico = this.nextProtocolo();
    const now = new Date();
    const tipoDocumento = classifyByExtension(file.name);

    const doc: DocumentoFiscal = {
      protocoloUnico,
      cnpjEmitente: '',
      cnpjDestinatario: '',
      numeroDocumento: '',
      dataEmissao: now,
      dataVencimento: now,
      valorTotal: 0,
      itensLinha: [],
      impostos: [],
      tipoDocumento,
      canalOrigem: channel,
      status: 'recebido',
      indiceConfiancaPorCampo: {},
      dataRecebimento: now,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(protocoloUnico, doc);

    await this.auditService.log({
      usuarioId: 'system',
      tipoAcao: 'documento_recebido',
      protocoloUnico,
      valoresPosteriores: {
        canalOrigem: channel,
        tipoDocumento,
        nomeArquivo: file.name,
        tamanho: file.size,
      },
    });

    return {
      protocoloUnico,
      dataRecebimento: now,
      canalOrigem: channel,
      tipoDocumento,
      status: 'recebido',
    };
  }

  // ── receiveBatch ────────────────────────────────────────────────

  async receiveBatch(
    files: FileInput[],
    channel: DocumentChannel,
  ): Promise<DocumentReceipt[]> {
    const receipts: DocumentReceipt[] = [];
    for (const file of files) {
      receipts.push(await this.receiveDocument(file, channel));
    }
    return receipts;
  }

  // ── classifyDocument ────────────────────────────────────────────

  async classifyDocument(protocoloUnico: string): Promise<DocumentType> {
    const doc = this.store.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }
    return doc.tipoDocumento;
  }

  // ── getDocument ─────────────────────────────────────────────────

  async getDocument(protocoloUnico: string): Promise<DocumentoFiscal> {
    const doc = this.store.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }
    return doc;
  }

  // ── listDocuments ───────────────────────────────────────────────

  async listDocuments(
    filters: DocumentFilters,
  ): Promise<PaginatedResult<DocumentoFiscal>> {
    let results = Array.from(this.store.values());

    if (filters.status) {
      results = results.filter((d) => d.status === filters.status);
    }
    if (filters.fornecedor) {
      results = results.filter((d) => d.cnpjEmitente === filters.fornecedor);
    }
    if (filters.dataVencimentoInicio) {
      results = results.filter(
        (d) => d.dataVencimento >= filters.dataVencimentoInicio!,
      );
    }
    if (filters.dataVencimentoFim) {
      results = results.filter(
        (d) => d.dataVencimento <= filters.dataVencimentoFim!,
      );
    }
    if (filters.faixaValorMin !== undefined) {
      results = results.filter((d) => d.valorTotal >= filters.faixaValorMin!);
    }
    if (filters.faixaValorMax !== undefined) {
      results = results.filter((d) => d.valorTotal <= filters.faixaValorMax!);
    }

    const total = results.length;
    const page = filters.page;
    const pageSize = filters.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }
}
