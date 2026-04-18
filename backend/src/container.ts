import type {
  AlcadaConfig,
  SLAConfig,
  SoDRule,
  DocumentoFiscal,
} from '@ap-automation/shared';

import { AuditService } from './services/audit-service';
import { DocumentService } from './services/document-service';
import { OCRService } from './services/ocr-service';
import { ValidationService } from './services/validation-service';
import { WorkflowService } from './services/workflow-service';
import { QueueService } from './services/queue-service';
import { ERPConnector } from './services/erp-connector';
import { DashboardService } from './services/dashboard-service';

// ─── Default Configs ─────────────────────────────────────────────────

const defaultAlcadaConfigs: AlcadaConfig[] = [
  {
    id: 'alc-1',
    aprovadorId: 'aprovador-1',
    valorMinimo: 0,
    valorMaximo: 100_000_00, // R$ 100.000
    nivelHierarquico: 1,
    ativo: true,
  },
  {
    id: 'alc-2',
    aprovadorId: 'aprovador-2',
    valorMinimo: 100_000_01,
    valorMaximo: 500_000_00, // R$ 500.000
    nivelHierarquico: 2,
    ativo: true,
  },
  {
    id: 'alc-3',
    aprovadorId: 'aprovador-3',
    valorMinimo: 500_000_01,
    valorMaximo: Number.MAX_SAFE_INTEGER,
    nivelHierarquico: 3,
    ativo: true,
  },
];

const defaultSoDRules: SoDRule[] = [
  {
    id: 'sod-1',
    acaoOrigem: 'documento_recebido',
    acaoBloqueada: 'aprovacao',
    descricao: 'Quem registrou o documento não pode aprová-lo',
    ativo: true,
  },
  {
    id: 'sod-2',
    acaoOrigem: 'aprovacao',
    acaoBloqueada: 'registro_erp',
    descricao: 'Quem aprovou o documento não pode registrá-lo no ERP',
    ativo: true,
  },
];

const defaultSlaConfigs: SLAConfig[] = [
  { etapa: 'intake', tempoMaximoMinutos: 60, percentualAlerta: 0.8 },
  { etapa: 'captura', tempoMaximoMinutos: 120, percentualAlerta: 0.8 },
  { etapa: 'validacao', tempoMaximoMinutos: 240, percentualAlerta: 0.8 },
  { etapa: 'aprovacao', tempoMaximoMinutos: 480, percentualAlerta: 0.8 },
  { etapa: 'integracao_erp', tempoMaximoMinutos: 120, percentualAlerta: 0.8 },
  { etapa: 'concluido', tempoMaximoMinutos: Infinity, percentualAlerta: 0.8 },
];

// ─── Service Container ───────────────────────────────────────────────

export interface ServiceContainer {
  auditService: AuditService;
  documentService: DocumentService;
  ocrService: OCRService;
  validationService: ValidationService;
  workflowService: WorkflowService;
  queueService: QueueService;
  erpConnector: ERPConnector;
  dashboardService: DashboardService;
  documentStore: Map<string, DocumentoFiscal>;
}

export function createContainer(): ServiceContainer {
  const auditService = new AuditService();

  const documentService = new DocumentService(auditService);

  const ocrService = new OCRService();

  // The document store is shared between services that need direct access
  // DocumentService uses its own internal store, but workflow/erp need a shared Map
  const documentStore = new Map<string, DocumentoFiscal>();

  const validationService = new ValidationService(
    auditService,
    Array.from(documentStore.values()),
  );

  const workflowService = new WorkflowService(
    auditService,
    documentStore,
    defaultAlcadaConfigs,
    defaultSoDRules,
  );

  const queueService = new QueueService(defaultSlaConfigs);

  const erpConnector = new ERPConnector(auditService, documentStore);

  const dashboardService = new DashboardService(auditService, {
    getAll: () => Array.from(documentStore.values()),
  });

  return {
    auditService,
    documentService,
    ocrService,
    validationService,
    workflowService,
    queueService,
    erpConnector,
    dashboardService,
    documentStore,
  };
}
