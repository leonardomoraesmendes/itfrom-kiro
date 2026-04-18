import type {
  IDashboardService,
  IAuditService,
  OperationalKPIs,
  ManagementKPIs,
  PaymentForecast,
  DashboardFilters,
  AuditFilters,
  AuditEntry,
  PaginatedResult,
  Alert,
  TrendData,
  DocumentoFiscal,
  ProcessStage,
} from '@ap-automation/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

const ALL_STAGES: ProcessStage[] = [
  'intake',
  'captura',
  'validacao',
  'aprovacao',
  'integracao_erp',
  'concluido',
];

const STAGE_FOR_STATUS: Record<string, ProcessStage> = {
  recebido: 'intake',
  em_extracao: 'captura',
  aguardando_revisao: 'captura',
  em_validacao: 'validacao',
  aguardando_aprovacao: 'aprovacao',
  aprovado: 'aprovacao',
  rejeitado: 'aprovacao',
  devolvido: 'aprovacao',
  registrado_erp: 'integracao_erp',
  erro_integracao: 'integracao_erp',
  pago: 'concluido',
  cancelado: 'concluido',
};

function stageForDoc(doc: DocumentoFiscal): ProcessStage {
  return STAGE_FOR_STATUS[doc.status] ?? 'intake';
}

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── SLA defaults (minutes) ──────────────────────────────────────────

const DEFAULT_SLA: Record<ProcessStage, number> = {
  intake: 60,
  captura: 120,
  validacao: 240,
  aprovacao: 480,
  integracao_erp: 120,
  concluido: Infinity,
};

// ─── Document Store interface ────────────────────────────────────────

export interface DocumentStore {
  getAll(): DocumentoFiscal[];
}

// ─── DashboardService ────────────────────────────────────────────────

export class DashboardService implements IDashboardService {
  constructor(
    private readonly auditService: IAuditService,
    private readonly documentStore: DocumentStore,
  ) {}

  // ── getOperationalKPIs ────────────────────────────────────────────

  async getOperationalKPIs(): Promise<OperationalKPIs> {
    const docs = this.documentStore.getAll();

    // Volume per stage
    const volumePorEtapa = {} as Record<ProcessStage, number>;
    for (const stage of ALL_STAGES) {
      volumePorEtapa[stage] = 0;
    }
    for (const doc of docs) {
      const stage = stageForDoc(doc);
      volumePorEtapa[stage]++;
    }

    // Exception rate: docs with status rejeitado, devolvido, or erro_integracao
    const exceptionStatuses = new Set(['rejeitado', 'devolvido', 'erro_integracao']);
    const exceptions = docs.filter((d) => exceptionStatuses.has(d.status));
    const taxaExcecoes = docs.length > 0 ? exceptions.length / docs.length : 0;

    // Average time per stage (minutes since createdAt)
    const stageTimes: Record<ProcessStage, number[]> = {} as any;
    for (const stage of ALL_STAGES) {
      stageTimes[stage] = [];
    }
    const now = Date.now();
    for (const doc of docs) {
      const stage = stageForDoc(doc);
      const elapsed = (now - doc.updatedAt.getTime()) / 60_000;
      stageTimes[stage].push(elapsed);
    }
    const tempoMedioPorEtapa = {} as Record<ProcessStage, number>;
    for (const stage of ALL_STAGES) {
      const times = stageTimes[stage];
      tempoMedioPorEtapa[stage] =
        times.length > 0
          ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          : 0;
    }

    // SLA-expired items
    const itensVencidosSLA = docs.filter((doc) => {
      const stage = stageForDoc(doc);
      const slaMinutes = DEFAULT_SLA[stage];
      if (!isFinite(slaMinutes)) return false;
      const elapsed = (now - doc.updatedAt.getTime()) / 60_000;
      return elapsed > slaMinutes;
    }).length;

    // Risk alerts
    const alertasRisco: Alert[] = [];
    for (const doc of docs) {
      if (doc.status === 'erro_integracao') {
        alertasRisco.push({
          tipo: 'erro_integracao',
          mensagem: `Documento ${doc.protocoloUnico} com erro de integração ERP`,
          severidade: 'alta',
          protocoloUnico: doc.protocoloUnico,
        });
      }
      const stage = stageForDoc(doc);
      const slaMinutes = DEFAULT_SLA[stage];
      if (isFinite(slaMinutes)) {
        const elapsed = (now - doc.updatedAt.getTime()) / 60_000;
        if (elapsed > slaMinutes) {
          alertasRisco.push({
            tipo: 'sla_vencido',
            mensagem: `Documento ${doc.protocoloUnico} excedeu SLA na etapa ${stage}`,
            severidade: 'critica',
            protocoloUnico: doc.protocoloUnico,
          });
        }
      }
    }

    return {
      volumePorEtapa,
      taxaExcecoes,
      tempoMedioPorEtapa,
      itensVencidosSLA,
      alertasRisco,
    };
  }

  // ── getManagementKPIs ─────────────────────────────────────────────

  async getManagementKPIs(filters?: DashboardFilters): Promise<ManagementKPIs> {
    let docs = this.documentStore.getAll();

    if (filters?.periodoInicio) {
      docs = docs.filter((d) => d.dataVencimento >= filters.periodoInicio!);
    }
    if (filters?.periodoFim) {
      docs = docs.filter((d) => d.dataVencimento <= filters.periodoFim!);
    }
    if (filters?.fornecedor) {
      docs = docs.filter((d) => d.cnpjEmitente === filters.fornecedor);
    }

    // 30-day payment forecast
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingDocs = docs.filter(
      (d) =>
        d.dataVencimento >= now &&
        d.dataVencimento <= thirtyDaysLater &&
        d.status !== 'cancelado' &&
        d.status !== 'rejeitado',
    );

    const forecastMap = new Map<string, PaymentForecast>();
    for (const doc of upcomingDocs) {
      const key = `${doc.cnpjEmitente}|${filters?.centroCusto ?? 'default'}`;
      const existing = forecastMap.get(key);
      if (existing) {
        existing.valorPrevisto += doc.valorTotal;
      } else {
        forecastMap.set(key, {
          fornecedor: doc.cnpjEmitente,
          centroCusto: filters?.centroCusto ?? 'default',
          valorPrevisto: doc.valorTotal,
          dataPrevisao: doc.dataVencimento,
        });
      }
    }
    const previsaoPagamentos30d = Array.from(forecastMap.values());

    // Volume trend (by month)
    const volumeByMonth = new Map<string, number>();
    const valueByMonth = new Map<string, number>();
    for (const doc of docs) {
      const month = formatMonth(doc.dataRecebimento);
      volumeByMonth.set(month, (volumeByMonth.get(month) ?? 0) + 1);
      valueByMonth.set(month, (valueByMonth.get(month) ?? 0) + doc.valorTotal);
    }
    const tendenciaVolume: TrendData[] = Array.from(volumeByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, valor]) => ({ periodo, valor }));
    const tendenciaValor: TrendData[] = Array.from(valueByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, valor]) => ({ periodo, valor }));

    // Automation rate: docs that reached 'registrado_erp' or 'pago' without manual intervention
    // Heuristic: docs where no 'campo_corrigido' audit entry exists
    const autoStatuses = new Set(['registrado_erp', 'pago']);
    const completedDocs = docs.filter((d) => autoStatuses.has(d.status));
    // For simplicity, check confidence — if all fields >= 85, consider automated
    const automatedDocs = completedDocs.filter((d) => {
      const confidences = Object.values(d.indiceConfiancaPorCampo);
      return confidences.length === 0 || confidences.every((c) => c >= 85);
    });
    const taxaAutomacao =
      completedDocs.length > 0
        ? (automatedDocs.length / completedDocs.length) * 100
        : 0;

    // Duplicates avoided: count docs with status 'rejeitado' that were duplicate rejections
    // Heuristic: count rejeitado docs (in a real system, we'd query audit for 'duplicata_rejeitada')
    const duplicatasEvitadas = docs.filter((d) => d.status === 'rejeitado').length;

    return {
      previsaoPagamentos30d,
      tendenciaVolume,
      tendenciaValor,
      taxaAutomacao,
      duplicatasEvitadas,
    };
  }

  // ── getPaymentForecast ────────────────────────────────────────────

  async getPaymentForecast(periodo: number): Promise<PaymentForecast[]> {
    const docs = this.documentStore.getAll();
    const now = new Date();
    const endDate = new Date(now.getTime() + periodo * 24 * 60 * 60 * 1000);

    const upcomingDocs = docs.filter(
      (d) =>
        d.dataVencimento >= now &&
        d.dataVencimento <= endDate &&
        d.status !== 'cancelado' &&
        d.status !== 'rejeitado',
    );

    const forecastMap = new Map<string, PaymentForecast>();
    for (const doc of upcomingDocs) {
      const key = `${doc.cnpjEmitente}|default`;
      const existing = forecastMap.get(key);
      if (existing) {
        existing.valorPrevisto += doc.valorTotal;
        // Keep the earliest date
        if (doc.dataVencimento < existing.dataPrevisao) {
          existing.dataPrevisao = doc.dataVencimento;
        }
      } else {
        forecastMap.set(key, {
          fornecedor: doc.cnpjEmitente,
          centroCusto: 'default',
          valorPrevisto: doc.valorTotal,
          dataPrevisao: doc.dataVencimento,
        });
      }
    }

    return Array.from(forecastMap.values());
  }

  // ── getAuditLog ───────────────────────────────────────────────────

  async getAuditLog(filters: AuditFilters): Promise<PaginatedResult<AuditEntry>> {
    return this.auditService.query(filters);
  }

  // ── exportData ────────────────────────────────────────────────────

  async exportData(
    format: 'csv' | 'pdf',
    filters: DashboardFilters,
  ): Promise<Buffer> {
    const docs = this.filterDocs(filters);

    if (format === 'csv') {
      return this.generateCSV(docs);
    }

    // PDF: return a simple text-based mock
    return this.generatePDF(docs);
  }

  // ── Private helpers ───────────────────────────────────────────────

  private filterDocs(filters: DashboardFilters): DocumentoFiscal[] {
    let docs = this.documentStore.getAll();

    if (filters.periodoInicio) {
      docs = docs.filter((d) => d.dataVencimento >= filters.periodoInicio!);
    }
    if (filters.periodoFim) {
      docs = docs.filter((d) => d.dataVencimento <= filters.periodoFim!);
    }
    if (filters.fornecedor) {
      docs = docs.filter((d) => d.cnpjEmitente === filters.fornecedor);
    }

    return docs;
  }

  private generateCSV(docs: DocumentoFiscal[]): Buffer {
    const header = [
      'protocoloUnico',
      'cnpjEmitente',
      'numeroDocumento',
      'dataVencimento',
      'valorTotal',
      'status',
      'tipoDocumento',
    ].join(',');

    const rows = docs.map((d) =>
      [
        escapeCSV(d.protocoloUnico),
        escapeCSV(d.cnpjEmitente),
        escapeCSV(d.numeroDocumento),
        d.dataVencimento.toISOString(),
        String(d.valorTotal),
        escapeCSV(d.status),
        escapeCSV(d.tipoDocumento),
      ].join(','),
    );

    const csv = [header, ...rows].join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  private generatePDF(docs: DocumentoFiscal[]): Buffer {
    // Simple text-based PDF placeholder
    const lines = [
      '%PDF-1.4 (mock)',
      `Relatório AP Automation - ${docs.length} documentos`,
      '',
      ...docs.map(
        (d) =>
          `${d.protocoloUnico} | ${d.cnpjEmitente} | ${d.valorTotal} | ${d.status}`,
      ),
    ];
    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}
