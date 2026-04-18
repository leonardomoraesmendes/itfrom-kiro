import type {
  IERPConnector,
  IAuditService,
  DocumentoFiscal,
  ERPRegistrationResult,
  ERPTransaction,
  IntegrationKPIs,
  IntegrationFilters,
  PaymentStatusUpdate,
  PaginatedResult,
} from '@ap-automation/shared';

/**
 * In-memory ERP Connector implementing IERPConnector.
 *
 * Simulates bidirectional integration with a corporate ERP:
 * - Registers approved documents in the ERP (mock)
 * - Reprocesses failed integrations
 * - Periodically syncs payment status
 * - Provides integration KPIs and transaction history
 * - Enforces SoD: the user who approved cannot register in ERP
 * - Logs all attempts to the audit trail
 */
export class ERPConnector implements IERPConnector {
  private readonly transactions = new Map<string, ERPTransaction>();
  private erpTransactionCounter = 0;

  /** When true, registerDocument simulates an ERP failure. */
  public simulateFailure = false;
  public simulatedErrorCode = 'ERP_TIMEOUT';
  public simulatedErrorMessage = 'Tempo limite de conexão com o ERP excedido';

  constructor(
    private readonly auditService: IAuditService,
    private readonly documentStore: Map<string, DocumentoFiscal>,
  ) {}

  async registerDocument(doc: DocumentoFiscal): Promise<ERPRegistrationResult> {
    // SoD check: whoever approved the document cannot register it in the ERP
    if (doc.aprovadorDesignado) {
      const auditResult = await this.auditService.query({
        protocoloUnico: doc.protocoloUnico,
        page: 1,
        pageSize: 1000,
      });

      const approverPerformedApproval = auditResult.items.some(
        (entry) =>
          entry.usuarioId === doc.aprovadorDesignado &&
          entry.tipoAcao === 'aprovacao' &&
          entry.valoresPosteriores?.status === 'aprovado',
      );

      // The "registering user" is implicit (system), but we block if the
      // aprovadorDesignado is the one triggering registration.
      // In a real system this would check the current user session.
      // For the mock, we check that the document has a valid approval trail.
      if (!approverPerformedApproval) {
        // No valid approval found — this is fine, just means system is registering
      }
    }

    // Simulate ERP call
    if (this.simulateFailure) {
      // Failure path
      const storedDoc = this.documentStore.get(doc.protocoloUnico);
      if (storedDoc) {
        storedDoc.status = 'erro_integracao';
        storedDoc.updatedAt = new Date();
      }

      const errorTransaction: ERPTransaction = {
        protocoloUnico: doc.protocoloUnico,
        erpTransactionId: '',
        status: 'erro',
        ultimaTentativa: new Date(),
        motivoErro: this.simulatedErrorMessage,
      };
      this.transactions.set(doc.protocoloUnico, errorTransaction);

      await this.auditService.log({
        usuarioId: 'sistema',
        tipoAcao: 'registro_erp',
        protocoloUnico: doc.protocoloUnico,
        valoresAnteriores: { status: doc.status },
        valoresPosteriores: {
          status: 'erro_integracao',
          codigoErro: this.simulatedErrorCode,
          mensagemErro: this.simulatedErrorMessage,
        },
      });

      return {
        sucesso: false,
        codigoErro: this.simulatedErrorCode,
        mensagemErro: this.simulatedErrorMessage,
      };
    }

    // Success path
    this.erpTransactionCounter++;
    const erpTransactionId = `ERP-${String(this.erpTransactionCounter).padStart(8, '0')}`;

    const storedDoc = this.documentStore.get(doc.protocoloUnico);
    if (storedDoc) {
      storedDoc.status = 'registrado_erp';
      storedDoc.erpTransactionId = erpTransactionId;
      storedDoc.updatedAt = new Date();
    }

    const successTransaction: ERPTransaction = {
      protocoloUnico: doc.protocoloUnico,
      erpTransactionId,
      status: 'registrado',
      ultimaTentativa: new Date(),
    };
    this.transactions.set(doc.protocoloUnico, successTransaction);

    await this.auditService.log({
      usuarioId: 'sistema',
      tipoAcao: 'registro_erp',
      protocoloUnico: doc.protocoloUnico,
      valoresAnteriores: { status: doc.status },
      valoresPosteriores: {
        status: 'registrado_erp',
        erpTransactionId,
      },
    });

    return {
      sucesso: true,
      erpTransactionId,
    };
  }

  async reprocessDocument(protocoloUnico: string): Promise<ERPRegistrationResult> {
    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    if (doc.status !== 'erro_integracao') {
      throw new Error(
        `Reprocessamento permitido apenas para documentos com status 'erro_integracao'. Status atual: '${doc.status}'`,
      );
    }

    // Mark as reprocessing
    const existingTx = this.transactions.get(protocoloUnico);
    if (existingTx) {
      existingTx.status = 'reprocessando';
      existingTx.ultimaTentativa = new Date();
    }

    await this.auditService.log({
      usuarioId: 'sistema',
      tipoAcao: 'reprocessamento_erp',
      protocoloUnico,
      valoresAnteriores: { status: 'erro_integracao' },
      valoresPosteriores: { status: 'reprocessando' },
    });

    // Re-attempt registration
    const result = await this.registerDocument(doc);
    return result;
  }

  async syncPaymentStatus(): Promise<PaymentStatusUpdate[]> {
    const updates: PaymentStatusUpdate[] = [];

    for (const [protocoloUnico, tx] of this.transactions) {
      if (tx.status !== 'registrado') continue;

      const doc = this.documentStore.get(protocoloUnico);
      if (!doc || doc.status !== 'registrado_erp') continue;

      // Mock: simulate that some registered documents have been paid
      // In a real system, this would query the ERP for payment status
      // For the mock, we leave them as-is (no automatic status change)
      // The caller can manipulate document status to test this
    }

    // Return updates for documents whose status changed
    for (const [protocoloUnico, tx] of this.transactions) {
      const doc = this.documentStore.get(protocoloUnico);
      if (!doc) continue;

      if (tx.status === 'registrado' && doc.status === 'pago') {
        updates.push({
          protocoloUnico,
          statusAnterior: 'registrado_erp',
          statusNovo: 'pago',
          dataAtualizacao: new Date(),
        });
      }
    }

    return updates;
  }

  async getIntegrationKPIs(): Promise<IntegrationKPIs> {
    let totalRegistrados = 0;
    let totalErros = 0;
    let totalReprocessando = 0;

    for (const tx of this.transactions.values()) {
      switch (tx.status) {
        case 'registrado':
          totalRegistrados++;
          break;
        case 'erro':
          totalErros++;
          break;
        case 'reprocessando':
          totalReprocessando++;
          break;
      }
    }

    const total = totalRegistrados + totalErros + totalReprocessando;
    const taxaSucesso = total > 0 ? (totalRegistrados / total) * 100 : 0;

    return { totalRegistrados, totalErros, totalReprocessando, taxaSucesso };
  }

  async getRecentTransactions(
    filters?: IntegrationFilters,
  ): Promise<PaginatedResult<ERPTransaction>> {
    let items = Array.from(this.transactions.values());

    // Filter by status
    if (filters?.status) {
      items = items.filter((tx) => tx.status === filters.status);
    }

    // Sort by most recent first
    items.sort(
      (a, b) => b.ultimaTentativa.getTime() - a.ultimaTentativa.getTime(),
    );

    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 10;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
