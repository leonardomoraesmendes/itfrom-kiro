// Interfaces de serviços de domínio

import type {
  DocumentoFiscal,
  DocumentChannel,
  DocumentType,
  DocumentReceipt,
  DocumentFilters,
  DocumentStatus,
  ProcessStage,
  FileInput,
} from './document';
import type { PaginatedResult } from './common';
import type { AuditEntry, AuditEntryInput, AuditFilters } from './audit';

// ─── Document Service ────────────────────────────────────────────────

export interface IDocumentService {
  receiveDocument(file: FileInput, channel: DocumentChannel): Promise<DocumentReceipt>;
  receiveBatch(files: FileInput[], channel: DocumentChannel): Promise<DocumentReceipt[]>;
  getDocument(protocoloUnico: string): Promise<DocumentoFiscal>;
  listDocuments(filters: DocumentFilters): Promise<PaginatedResult<DocumentoFiscal>>;
  classifyDocument(protocoloUnico: string): Promise<DocumentType>;
}

// ─── OCR/IDP Service ─────────────────────────────────────────────────

export type ExtractionStatus = 'completed' | 'failed' | 'pending';

export interface ExtractedField {
  nome: string;
  valor: string | number | Date;
  indiceConfianca: number; // 0-100
  requerRevisao: boolean;  // true se indiceConfianca < 85
}

export interface ExtractionResult {
  protocoloUnico: string;
  campos: ExtractedField[];
  status: ExtractionStatus;
  tempoProcessamento: number; // ms
}

export interface IOCRService {
  extractData(protocoloUnico: string, documentBuffer: Buffer): Promise<ExtractionResult>;
  getExtractionStatus(protocoloUnico: string): Promise<ExtractionStatus>;
}

// ─── Validation Service ──────────────────────────────────────────────

export interface RuleResult {
  regra: string;
  status: 'aprovada' | 'reprovada';
  detalhes: string;
  criticidade: 'critica' | 'alta' | 'media' | 'baixa';
}

export interface ValidationResult {
  protocoloUnico: string;
  regras: RuleResult[];
  aprovado: boolean; // true se todas as regras passaram
}

export interface DuplicateCheckResult {
  duplicataDetectada: boolean;
  documentosSimilares: DocumentoFiscal[];
  criterios: {
    cnpjEmitente: boolean;
    numeroDocumento: boolean;
    valorDentroTolerancia: boolean;
  };
}

export interface ExceptionDecision {
  tipo: 'liberar' | 'rejeitar';
  justificativa: string; // obrigatória
  usuarioId: string;
}

export interface IValidationService {
  validateDocument(doc: DocumentoFiscal): Promise<ValidationResult>;
  checkDuplicate(doc: DocumentoFiscal): Promise<DuplicateCheckResult>;
  resolveException(protocoloUnico: string, decision: ExceptionDecision): Promise<void>;
}

// ─── Workflow Service ────────────────────────────────────────────────

export interface ApprovalRequest {
  protocoloUnico: string;
  aprovadorDesignado: string;
  alcadaRequerida: number;
  slaLimite: Date;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'devolvido' | 'escalado';
}

export interface ApprovalResult {
  protocoloUnico: string;
  status: 'aprovado' | 'rejeitado' | 'devolvido' | 'escalado';
  aprovadorId: string;
  dataHora: Date;
  justificativa?: string;
}

export interface SoDCheckResult {
  conflito: boolean;
  regrasVioladas: string[];
  mensagem: string;
}

export interface IWorkflowService {
  submitForApproval(protocoloUnico: string): Promise<ApprovalRequest>;
  approve(protocoloUnico: string, aprovadorId: string, justificativa?: string): Promise<ApprovalResult>;
  reject(protocoloUnico: string, aprovadorId: string, justificativa: string): Promise<ApprovalResult>;
  returnForCorrection(protocoloUnico: string, aprovadorId: string, justificativa: string): Promise<ApprovalResult>;
  escalate(protocoloUnico: string): Promise<ApprovalRequest>;
  checkSoDConflict(protocoloUnico: string, userId: string): Promise<SoDCheckResult>;
}

// ─── Queue Service ───────────────────────────────────────────────────

export interface QueueItem {
  protocoloUnico: string;
  fornecedor: string;
  valor: number;
  dataVencimento: Date;
  etapaAtual: ProcessStage;
  tempoDecorrido: number; // minutos
  slaStatus: 'dentro_prazo' | 'alerta' | 'vencido';
  excecao?: { tipo: string; motivo: string };
  responsavel: string;
}

export interface QueueFilters {
  etapa?: ProcessStage;
  slaStatus?: 'dentro_prazo' | 'alerta' | 'vencido';
  fornecedor?: string;
  faixaValorMin?: number;
  faixaValorMax?: number;
  periodoVencimentoInicio?: Date;
  periodoVencimentoFim?: Date;
}

export interface QueueKPIs {
  totalPendente: number;
  totalVencidos: number;
  totalAlerta: number;
}

export interface IQueueService {
  getQueue(analistaId: string, filters?: QueueFilters): Promise<PaginatedResult<QueueItem>>;
  reassignItem(protocoloUnico: string, novoAnalistaId: string): Promise<void>;
  getQueueKPIs(analistaId: string): Promise<QueueKPIs>;
}

// ─── ERP Connector ───────────────────────────────────────────────────

export interface ERPRegistrationResult {
  sucesso: boolean;
  erpTransactionId?: string;
  codigoErro?: string;
  mensagemErro?: string;
}

export interface ERPTransaction {
  protocoloUnico: string;
  erpTransactionId: string;
  status: 'registrado' | 'erro' | 'reprocessando';
  ultimaTentativa: Date;
  motivoErro?: string;
}

export interface IntegrationKPIs {
  totalRegistrados: number;
  totalErros: number;
  totalReprocessando: number;
  taxaSucesso: number; // percentual
}

export interface IntegrationFilters {
  status?: 'registrado' | 'erro' | 'reprocessando';
  page: number;
  pageSize: number;
}

export interface PaymentStatusUpdate {
  protocoloUnico: string;
  statusAnterior: DocumentStatus;
  statusNovo: DocumentStatus;
  dataAtualizacao: Date;
}

export interface IERPConnector {
  registerDocument(doc: DocumentoFiscal): Promise<ERPRegistrationResult>;
  reprocessDocument(protocoloUnico: string): Promise<ERPRegistrationResult>;
  syncPaymentStatus(): Promise<PaymentStatusUpdate[]>;
  getIntegrationKPIs(): Promise<IntegrationKPIs>;
  getRecentTransactions(filters?: IntegrationFilters): Promise<PaginatedResult<ERPTransaction>>;
}

// ─── Dashboard Service ───────────────────────────────────────────────

export interface Alert {
  tipo: string;
  mensagem: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  protocoloUnico?: string;
}

export interface OperationalKPIs {
  volumePorEtapa: Record<ProcessStage, number>;
  taxaExcecoes: number;
  tempoMedioPorEtapa: Record<ProcessStage, number>;
  itensVencidosSLA: number;
  alertasRisco: Alert[];
}

export interface PaymentForecast {
  fornecedor: string;
  centroCusto: string;
  valorPrevisto: number; // centavos
  dataPrevisao: Date;
}

export interface TrendData {
  periodo: string;
  valor: number;
}

export interface ManagementKPIs {
  previsaoPagamentos30d: PaymentForecast[];
  tendenciaVolume: TrendData[];
  tendenciaValor: TrendData[];
  taxaAutomacao: number; // % documentos sem intervenção manual
  duplicatasEvitadas: number;
}

export interface DashboardFilters {
  periodoInicio?: Date;
  periodoFim?: Date;
  fornecedor?: string;
  centroCusto?: string;
}

export interface IDashboardService {
  getOperationalKPIs(): Promise<OperationalKPIs>;
  getManagementKPIs(filters?: DashboardFilters): Promise<ManagementKPIs>;
  getPaymentForecast(periodo: number): Promise<PaymentForecast[]>;
  getAuditLog(filters: AuditFilters): Promise<PaginatedResult<AuditEntry>>;
  exportData(format: 'csv' | 'pdf', filters: DashboardFilters): Promise<Buffer>;
}

// ─── Audit Service ───────────────────────────────────────────────────

export interface IAuditService {
  log(entry: AuditEntryInput): Promise<void>;
  query(filters: AuditFilters): Promise<PaginatedResult<AuditEntry>>;
}
