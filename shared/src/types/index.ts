// Barrel export — tipos e interfaces compartilhados

export type {
  DocumentStatus,
  ProcessStage,
  DocumentChannel,
  DocumentType,
  ItemLinha,
  Imposto,
  DocumentoFiscal,
  DocumentReceipt,
  DocumentFilters,
  FileInput,
} from './document';

export type {
  AuditActionType,
  AuditEntryInput,
  AuditEntry,
  AuditFilters,
} from './audit';

export type {
  AlcadaConfig,
  SLAConfig,
  SoDRule,
} from './config';

export type {
  Permission,
  UserProfile,
} from './auth';

export type {
  PaginatedResult,
} from './common';

export type {
  // Document Service
  IDocumentService,
  // OCR/IDP Service
  ExtractionStatus,
  ExtractedField,
  ExtractionResult,
  IOCRService,
  // Validation Service
  RuleResult,
  ValidationResult,
  DuplicateCheckResult,
  ExceptionDecision,
  IValidationService,
  // Workflow Service
  ApprovalRequest,
  ApprovalResult,
  SoDCheckResult,
  IWorkflowService,
  // Queue Service
  QueueItem,
  QueueFilters,
  QueueKPIs,
  IQueueService,
  // ERP Connector
  ERPRegistrationResult,
  ERPTransaction,
  IntegrationKPIs,
  IntegrationFilters,
  PaymentStatusUpdate,
  IERPConnector,
  // Dashboard Service
  Alert,
  OperationalKPIs,
  PaymentForecast,
  TrendData,
  ManagementKPIs,
  DashboardFilters,
  IDashboardService,
  // Audit Service
  IAuditService,
} from './services';
