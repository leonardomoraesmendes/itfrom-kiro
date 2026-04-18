import type {
  IQueueService,
  QueueItem,
  QueueFilters,
  QueueKPIs,
  PaginatedResult,
  SLAConfig,
  ProcessStage,
} from '@ap-automation/shared';

/**
 * In-memory Queue Service implementing IQueueService.
 *
 * Manages the operational queue with:
 * - Priority ordering by SLA status (vencido > alerta > dentro_prazo) then by dataVencimento
 * - SLA status calculation based on tempoDecorrido vs configured SLA thresholds
 * - Filtering by etapa, slaStatus, fornecedor, faixa de valor, período de vencimento
 * - Exception highlighting for items with validation failures, returns, or integration errors
 * - Reassignment of items to different analysts
 * - KPI aggregation (totalPendente, totalVencidos, totalAlerta)
 */
export class QueueService implements IQueueService {
  private readonly items = new Map<string, QueueItem>();

  constructor(private readonly slaConfigs: SLAConfig[]) {}

  /**
   * Add or update an item in the queue (used by other services to populate the queue).
   */
  addItem(item: QueueItem): void {
    this.items.set(item.protocoloUnico, item);
  }

  /**
   * Remove an item from the queue.
   */
  removeItem(protocoloUnico: string): void {
    this.items.delete(protocoloUnico);
  }

  async getQueue(
    analistaId: string,
    filters?: QueueFilters,
  ): Promise<PaginatedResult<QueueItem>> {
    let results = Array.from(this.items.values()).filter(
      (item) => item.responsavel === analistaId,
    );

    // Recalculate SLA status for each item
    results = results.map((item) => ({
      ...item,
      slaStatus: this.calculateSlaStatus(item.tempoDecorrido, item.etapaAtual),
    }));

    // Apply filters
    if (filters) {
      results = this.applyFilters(results, filters);
    }

    // Sort by priority: vencido first, then alerta, then dentro_prazo
    // Within same status, sort by closest dataVencimento (ascending)
    results.sort((a, b) => {
      const priorityOrder = { vencido: 0, alerta: 1, dentro_prazo: 2 };
      const priorityDiff = priorityOrder[a.slaStatus] - priorityOrder[b.slaStatus];
      if (priorityDiff !== 0) return priorityDiff;
      return a.dataVencimento.getTime() - b.dataVencimento.getTime();
    });

    const total = results.length;

    return {
      items: results,
      total,
      page: 1,
      pageSize: total,
      totalPages: 1,
    };
  }

  async reassignItem(
    protocoloUnico: string,
    novoAnalistaId: string,
  ): Promise<void> {
    const item = this.items.get(protocoloUnico);
    if (!item) {
      throw new Error(`Item não encontrado na fila: ${protocoloUnico}`);
    }
    item.responsavel = novoAnalistaId;
  }

  async getQueueKPIs(analistaId: string): Promise<QueueKPIs> {
    const analystItems = Array.from(this.items.values()).filter(
      (item) => item.responsavel === analistaId,
    );

    let totalPendente = 0;
    let totalVencidos = 0;
    let totalAlerta = 0;

    for (const item of analystItems) {
      const status = this.calculateSlaStatus(item.tempoDecorrido, item.etapaAtual);
      totalPendente++;
      if (status === 'vencido') totalVencidos++;
      if (status === 'alerta') totalAlerta++;
    }

    return { totalPendente, totalVencidos, totalAlerta };
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Calculate SLA status based on elapsed time vs configured SLA for the stage.
   *
   * - ratio < percentualAlerta (default 0.8) → 'dentro_prazo'
   * - ratio >= percentualAlerta AND ratio <= 1.0 → 'alerta'
   * - ratio > 1.0 → 'vencido'
   */
  calculateSlaStatus(
    tempoDecorrido: number,
    etapa: ProcessStage,
  ): 'dentro_prazo' | 'alerta' | 'vencido' {
    const slaConfig = this.slaConfigs.find((c) => c.etapa === etapa);
    if (!slaConfig) {
      // No SLA configured for this stage — default to dentro_prazo
      return 'dentro_prazo';
    }

    const ratio = tempoDecorrido / slaConfig.tempoMaximoMinutos;

    if (ratio > 1.0) return 'vencido';
    if (ratio >= slaConfig.percentualAlerta) return 'alerta';
    return 'dentro_prazo';
  }

  private applyFilters(items: QueueItem[], filters: QueueFilters): QueueItem[] {
    let result = items;

    if (filters.etapa) {
      result = result.filter((item) => item.etapaAtual === filters.etapa);
    }

    if (filters.slaStatus) {
      result = result.filter((item) => item.slaStatus === filters.slaStatus);
    }

    if (filters.fornecedor) {
      result = result.filter((item) => item.fornecedor === filters.fornecedor);
    }

    if (filters.faixaValorMin !== undefined) {
      result = result.filter((item) => item.valor >= filters.faixaValorMin!);
    }

    if (filters.faixaValorMax !== undefined) {
      result = result.filter((item) => item.valor <= filters.faixaValorMax!);
    }

    if (filters.periodoVencimentoInicio) {
      result = result.filter(
        (item) => item.dataVencimento >= filters.periodoVencimentoInicio!,
      );
    }

    if (filters.periodoVencimentoFim) {
      result = result.filter(
        (item) => item.dataVencimento <= filters.periodoVencimentoFim!,
      );
    }

    return result;
  }
}
