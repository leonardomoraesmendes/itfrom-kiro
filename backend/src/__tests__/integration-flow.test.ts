import { describe, it, expect, beforeEach } from 'vitest';
import type {
  DocumentoFiscal,
  AlcadaConfig,
  SoDRule,
  SLAConfig,
  FileInput,
} from '@ap-automation/shared';

import { AuditService } from '../services/audit-service';
import { DocumentService } from '../services/document-service';
import { OCRService } from '../services/ocr-service';
import { ValidationService } from '../services/validation-service';
import { WorkflowService } from '../services/workflow-service';
import { ERPConnector } from '../services/erp-connector';

// ─── Shared test fixtures ────────────────────────────────────────────

const alcadaConfigs: AlcadaConfig[] = [
  {
    id: 'alc-1',
    aprovadorId: 'aprovador-1',
    valorMinimo: 0,
    valorMaximo: 100_000_00,
    nivelHierarquico: 1,
    ativo: true,
  },
  {
    id: 'alc-2',
    aprovadorId: 'aprovador-2',
    valorMinimo: 100_000_01,
    valorMaximo: 500_000_00,
    nivelHierarquico: 2,
    ativo: true,
  },
];

const sodRules: SoDRule[] = [
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

const slaConfig: SLAConfig = {
  etapa: 'aprovacao',
  tempoMaximoMinutos: 480,
  percentualAlerta: 0.8,
};

function makeFile(name: string): FileInput {
  return {
    name,
    size: 1024,
    type: 'application/xml',
    buffer: Buffer.from('<xml>test</xml>'),
  };
}

/**
 * Build a valid DocumentoFiscal that passes all validation rules.
 * The document is placed into the shared documentStore so that
 * WorkflowService and ERPConnector can find it.
 */
function buildValidDoc(
  protocoloUnico: string,
  overrides: Partial<DocumentoFiscal> = {},
): DocumentoFiscal {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  return {
    protocoloUnico,
    cnpjEmitente: '12345678000195',
    cnpjDestinatario: '98765432000100',
    numeroDocumento: `NF-${Date.now()}`,
    dataEmissao: now,
    dataVencimento: futureDate,
    valorTotal: 10000, // R$ 100,00
    itensLinha: [
      { descricao: 'Item 1', quantidade: 1, valorUnitario: 10000, valorTotal: 10000 },
    ],
    impostos: [
      { tipo: 'ICMS', baseCalculo: 10000, aliquota: 18, valor: 1800 },
    ],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'recebido',
    indiceConfiancaPorCampo: {},
    dataRecebimento: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Integration Tests ───────────────────────────────────────────────

describe('Integration Flow: Intake → OCR → Validação → Aprovação → ERP', () => {
  let auditService: AuditService;
  let documentService: DocumentService;
  let ocrService: OCRService;
  let validationService: ValidationService;
  let workflowService: WorkflowService;
  let erpConnector: ERPConnector;
  let documentStore: Map<string, DocumentoFiscal>;

  beforeEach(() => {
    auditService = new AuditService();
    documentService = new DocumentService(auditService);
    ocrService = new OCRService();
    documentStore = new Map<string, DocumentoFiscal>();
    validationService = new ValidationService(auditService, []);
    workflowService = new WorkflowService(
      auditService,
      documentStore,
      alcadaConfigs,
      sodRules,
      slaConfig,
    );
    erpConnector = new ERPConnector(auditService, documentStore);
  });

  // ── Test 1: Happy path ──────────────────────────────────────────────

  it('happy path: Intake → OCR → Validation → Approval → ERP with full audit trail', async () => {
    // Step 1: Intake — receive document
    const receipt = await documentService.receiveDocument(makeFile('nota.xml'), 'upload');
    expect(receipt.protocoloUnico).toMatch(/^AP-/);
    expect(receipt.status).toBe('recebido');

    // Step 2: OCR — extract data
    const extraction = await ocrService.extractData(
      receipt.protocoloUnico,
      Buffer.from('<xml>test</xml>'),
    );
    expect(extraction.status).toBe('completed');
    expect(extraction.campos.length).toBeGreaterThan(0);

    // Step 3: Build a valid document and validate it
    const doc = buildValidDoc(receipt.protocoloUnico);
    const validationResult = await validationService.validateDocument(doc);
    expect(validationResult.aprovado).toBe(true);
    expect(validationResult.regras.every((r) => r.status === 'aprovada')).toBe(true);

    // Step 4: Place doc in shared store for workflow/ERP and submit for approval
    documentStore.set(doc.protocoloUnico, doc);
    const approvalRequest = await workflowService.submitForApproval(doc.protocoloUnico);
    expect(approvalRequest.status).toBe('pendente');
    expect(approvalRequest.aprovadorDesignado).toBe('aprovador-1');

    // Step 5: Approve (by a different user than the one who registered)
    const approvalResult = await workflowService.approve(
      doc.protocoloUnico,
      'aprovador-1',
    );
    expect(approvalResult.status).toBe('aprovado');

    // Step 6: Register in ERP
    const updatedDoc = documentStore.get(doc.protocoloUnico)!;
    expect(updatedDoc.status).toBe('aprovado');

    const erpResult = await erpConnector.registerDocument(updatedDoc);
    expect(erpResult.sucesso).toBe(true);
    expect(erpResult.erpTransactionId).toMatch(/^ERP-/);

    // Verify final status
    const finalDoc = documentStore.get(doc.protocoloUnico)!;
    expect(finalDoc.status).toBe('registrado_erp');

    // Step 7: Verify audit trail has entries for each step
    const auditResult = await auditService.query({
      protocoloUnico: doc.protocoloUnico,
      page: 1,
      pageSize: 100,
    });

    const actionTypes = auditResult.items.map((e) => e.tipoAcao);
    // Should have: documento_recebido, validacao_executada, aprovacao (submit), aprovacao (approve), registro_erp
    expect(actionTypes).toContain('documento_recebido');
    expect(actionTypes).toContain('validacao_executada');
    expect(actionTypes).toContain('aprovacao');
    expect(actionTypes).toContain('registro_erp');
    expect(auditResult.items.length).toBeGreaterThanOrEqual(4);
  });

  // ── Test 2: Exception path ──────────────────────────────────────────

  it('exception path: validation fails → document NOT auto-forwarded → ERP failure → reprocess', async () => {
    // Step 1: Intake
    const receipt = await documentService.receiveDocument(makeFile('boleto.pdf'), 'email');
    expect(receipt.protocoloUnico).toMatch(/^AP-/);

    // Step 2: Build a document with invalid CNPJ (will fail validation)
    const invalidDoc = buildValidDoc(receipt.protocoloUnico, {
      cnpjEmitente: 'INVALID',
      cnpjDestinatario: 'ALSO_INVALID',
    });

    // Step 3: Validate — should fail
    const validationResult = await validationService.validateDocument(invalidDoc);
    expect(validationResult.aprovado).toBe(false);
    const failedRules = validationResult.regras.filter((r) => r.status === 'reprovada');
    expect(failedRules.length).toBeGreaterThan(0);

    // Step 4: Document should NOT be auto-forwarded to approval
    // (The system only forwards when all validations pass — Req 3.4)
    // Verify the document is not in the approval workflow
    expect(invalidDoc.status).toBe('recebido'); // status unchanged

    // Step 5: Now test ERP failure path with a valid, approved document
    const validDoc = buildValidDoc('AP-ERP-FAIL-001');
    documentStore.set(validDoc.protocoloUnico, validDoc);

    // Submit and approve
    await workflowService.submitForApproval(validDoc.protocoloUnico);
    await workflowService.approve(validDoc.protocoloUnico, 'aprovador-1');

    // Simulate ERP failure
    erpConnector.simulateFailure = true;
    const failedErp = await erpConnector.registerDocument(
      documentStore.get(validDoc.protocoloUnico)!,
    );
    expect(failedErp.sucesso).toBe(false);
    expect(failedErp.codigoErro).toBe('ERP_TIMEOUT');

    const errorDoc = documentStore.get(validDoc.protocoloUnico)!;
    expect(errorDoc.status).toBe('erro_integracao');

    // Step 6: Reprocess — now with success
    erpConnector.simulateFailure = false;
    const reprocessResult = await erpConnector.reprocessDocument(validDoc.protocoloUnico);
    expect(reprocessResult.sucesso).toBe(true);

    const reprocessedDoc = documentStore.get(validDoc.protocoloUnico)!;
    expect(reprocessedDoc.status).toBe('registrado_erp');

    // Verify audit trail includes reprocessamento
    const auditResult = await auditService.query({
      protocoloUnico: validDoc.protocoloUnico,
      page: 1,
      pageSize: 100,
    });
    const actionTypes = auditResult.items.map((e) => e.tipoAcao);
    expect(actionTypes).toContain('reprocessamento_erp');
    expect(actionTypes).toContain('registro_erp');
  });

  // ── Test 3: SoD enforcement in full flow ────────────────────────────

  it('SoD: user who registered cannot approve; user who approved cannot register in ERP', async () => {
    const userA = 'user-A';
    const userB = 'aprovador-1';

    // Step 1: User A registers a document (logged as documento_recebido by user A)
    const doc = buildValidDoc('AP-SOD-001');
    documentStore.set(doc.protocoloUnico, doc);

    // Manually log the intake action as user A (simulating user A performing the intake)
    await auditService.log({
      usuarioId: userA,
      tipoAcao: 'documento_recebido',
      protocoloUnico: doc.protocoloUnico,
      valoresPosteriores: { canalOrigem: 'upload' },
    });

    // Submit for approval
    await workflowService.submitForApproval(doc.protocoloUnico);

    // Step 2: User A tries to approve → should be BLOCKED by SoD
    const sodCheckA = await workflowService.checkSoDConflict(doc.protocoloUnico, userA);
    expect(sodCheckA.conflito).toBe(true);
    expect(sodCheckA.regrasVioladas.length).toBeGreaterThan(0);
    expect(sodCheckA.mensagem).toContain('Segregação de Funções');

    await expect(
      workflowService.approve(doc.protocoloUnico, userA),
    ).rejects.toThrow(/Segregação de Funções/);

    // Step 3: User B approves successfully
    const approvalResult = await workflowService.approve(doc.protocoloUnico, userB);
    expect(approvalResult.status).toBe('aprovado');

    // Step 4: Verify SoD detects conflict for user B trying to register in ERP
    // (user B approved, so SoD rule sod-2 should flag registro_erp as blocked)
    const sodCheckB = await workflowService.checkSoDConflict(doc.protocoloUnico, userB);
    // User B performed 'aprovacao', and sod-2 blocks 'registro_erp' for that user
    // The checkSoDConflict checks if the user performed the acaoOrigem
    expect(sodCheckB.conflito).toBe(true);
    expect(sodCheckB.regrasVioladas).toContain(
      'Quem aprovou o documento não pode registrá-lo no ERP',
    );

    // Verify audit trail recorded the SoD violation attempt
    const auditResult = await auditService.query({
      protocoloUnico: doc.protocoloUnico,
      page: 1,
      pageSize: 100,
    });
    const sodViolations = auditResult.items.filter(
      (e) => e.tipoAcao === 'violacao_sod_bloqueada',
    );
    expect(sodViolations.length).toBeGreaterThanOrEqual(1);
    expect(sodViolations[0].usuarioId).toBe(userA);
  });
});
