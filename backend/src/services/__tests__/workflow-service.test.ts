import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowService } from '../workflow-service';
import { AuditService } from '../audit-service';
import type {
  DocumentoFiscal,
  AlcadaConfig,
  SoDRule,
  SLAConfig,
} from '@ap-automation/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  const now = new Date();
  return {
    protocoloUnico: 'AP-20240101-000001',
    cnpjEmitente: '12345678000190',
    cnpjDestinatario: '98765432000190',
    numeroDocumento: 'NF-001',
    dataEmissao: now,
    dataVencimento: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    valorTotal: 500000, // R$ 5.000,00
    itensLinha: [
      { descricao: 'Item 1', quantidade: 1, valorUnitario: 500000, valorTotal: 500000 },
    ],
    impostos: [
      { tipo: 'ICMS', baseCalculo: 500000, aliquota: 18, valor: 90000 },
    ],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'aguardando_aprovacao',
    indiceConfiancaPorCampo: {},
    dataRecebimento: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const defaultAlcadas: AlcadaConfig[] = [
  {
    id: 'alc-1',
    aprovadorId: 'aprovador-1',
    valorMinimo: 0,
    valorMaximo: 1000000, // up to R$ 10.000
    nivelHierarquico: 1,
    ativo: true,
  },
  {
    id: 'alc-2',
    aprovadorId: 'aprovador-2',
    valorMinimo: 1000001,
    valorMaximo: 5000000, // up to R$ 50.000
    nivelHierarquico: 2,
    ativo: true,
  },
  {
    id: 'alc-3',
    aprovadorId: 'aprovador-3',
    valorMinimo: 5000001,
    valorMaximo: 99999999,
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
    descricao: 'Quem aprovou não pode registrar no ERP',
    ativo: true,
  },
];

const defaultSlaConfig: SLAConfig = {
  etapa: 'aprovacao',
  tempoMaximoMinutos: 1440, // 24h
  percentualAlerta: 0.8,
};

// ─── Test Suite ──────────────────────────────────────────────────────

describe('WorkflowService', () => {
  let auditService: AuditService;
  let documentStore: Map<string, DocumentoFiscal>;
  let service: WorkflowService;

  beforeEach(() => {
    auditService = new AuditService();
    documentStore = new Map();
    service = new WorkflowService(
      auditService,
      documentStore,
      defaultAlcadas,
      defaultSoDRules,
      defaultSlaConfig,
    );
  });

  // ─── submitForApproval ───────────────────────────────────────────

  describe('submitForApproval', () => {
    it('should route document to correct approver based on value vs. alcada', async () => {
      const doc = makeDoc({ valorTotal: 500000 }); // R$ 5.000 → alcada level 1
      documentStore.set(doc.protocoloUnico, doc);

      const request = await service.submitForApproval(doc.protocoloUnico);

      expect(request.aprovadorDesignado).toBe('aprovador-1');
      expect(request.status).toBe('pendente');
      expect(request.alcadaRequerida).toBe(500000);
      expect(request.protocoloUnico).toBe(doc.protocoloUnico);
    });

    it('should route high-value document to higher-level approver', async () => {
      const doc = makeDoc({ valorTotal: 2000000 }); // R$ 20.000 → alcada level 2
      documentStore.set(doc.protocoloUnico, doc);

      const request = await service.submitForApproval(doc.protocoloUnico);

      expect(request.aprovadorDesignado).toBe('aprovador-2');
    });

    it('should set SLA deadline based on configuration', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      const before = new Date();
      const request = await service.submitForApproval(doc.protocoloUnico);
      const after = new Date();

      // SLA is 1440 minutes = 24 hours
      const expectedMin = new Date(before.getTime() + 1440 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 1440 * 60 * 1000);

      expect(request.slaLimite.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
      expect(request.slaLimite.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
    });

    it('should update document status to aguardando_aprovacao', async () => {
      const doc = makeDoc({ status: 'em_validacao' });
      documentStore.set(doc.protocoloUnico, doc);

      await service.submitForApproval(doc.protocoloUnico);

      expect(doc.status).toBe('aguardando_aprovacao');
      expect(doc.aprovadorDesignado).toBe('aprovador-1');
    });

    it('should log submission in audit trail', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await service.submitForApproval(doc.protocoloUnico);

      expect(auditService.count).toBe(1);
    });

    it('should throw when document not found', async () => {
      await expect(
        service.submitForApproval('AP-99999999-999999'),
      ).rejects.toThrow('Documento não encontrado');
    });

    it('should throw when no approver configured for value', async () => {
      // Create a service with no alcada configs
      const emptyService = new WorkflowService(
        auditService,
        documentStore,
        [],
        defaultSoDRules,
        defaultSlaConfig,
      );
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await expect(
        emptyService.submitForApproval(doc.protocoloUnico),
      ).rejects.toThrow('Nenhum aprovador configurado');
    });
  });

  // ─── approve ─────────────────────────────────────────────────────

  describe('approve', () => {
    it('should approve a document in pendente status', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const result = await service.approve(doc.protocoloUnico, 'aprovador-1');

      expect(result.status).toBe('aprovado');
      expect(result.aprovadorId).toBe('aprovador-1');
      expect(result.protocoloUnico).toBe(doc.protocoloUnico);
      expect(result.dataHora).toBeInstanceOf(Date);
      expect(doc.status).toBe('aprovado');
    });

    it('should accept optional justificativa on approval', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const result = await service.approve(
        doc.protocoloUnico,
        'aprovador-1',
        'Valores conferidos',
      );

      expect(result.justificativa).toBe('Valores conferidos');
    });

    it('should block approval when SoD conflict exists (same user registered)', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      // Simulate: user 'analista-1' registered the document
      await auditService.log({
        usuarioId: 'analista-1',
        tipoAcao: 'documento_recebido',
        protocoloUnico: doc.protocoloUnico,
      });

      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.approve(doc.protocoloUnico, 'analista-1'),
      ).rejects.toThrow('Segregação de Funções');
    });

    it('should log SoD violation in audit trail when blocked', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await auditService.log({
        usuarioId: 'analista-1',
        tipoAcao: 'documento_recebido',
        protocoloUnico: doc.protocoloUnico,
      });

      await service.submitForApproval(doc.protocoloUnico);
      const countBefore = auditService.count;

      await expect(
        service.approve(doc.protocoloUnico, 'analista-1'),
      ).rejects.toThrow();

      // Should have logged the SoD violation
      expect(auditService.count).toBeGreaterThan(countBefore);
    });

    it('should block approval outside formal workflow', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      // Do NOT submit for approval — no pending request

      await expect(
        service.approve(doc.protocoloUnico, 'aprovador-1'),
      ).rejects.toThrow('workflow formal');
    });

    it('should block approval when document already approved', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);
      await service.approve(doc.protocoloUnico, 'aprovador-1');

      // Try to approve again
      await expect(
        service.approve(doc.protocoloUnico, 'aprovador-1'),
      ).rejects.toThrow();
    });

    it('should log approval in audit trail', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const countBefore = auditService.count;
      await service.approve(doc.protocoloUnico, 'aprovador-1');

      expect(auditService.count).toBeGreaterThan(countBefore);
    });

    it('should throw when document not found', async () => {
      await expect(
        service.approve('AP-99999999-999999', 'aprovador-1'),
      ).rejects.toThrow('Documento não encontrado');
    });
  });

  // ─── reject ──────────────────────────────────────────────────────

  describe('reject', () => {
    it('should reject a document with mandatory justificativa', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const result = await service.reject(
        doc.protocoloUnico,
        'aprovador-1',
        'Valores inconsistentes',
      );

      expect(result.status).toBe('rejeitado');
      expect(result.justificativa).toBe('Valores inconsistentes');
      expect(doc.status).toBe('rejeitado');
    });

    it('should throw when justificativa is empty', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.reject(doc.protocoloUnico, 'aprovador-1', ''),
      ).rejects.toThrow('Justificativa é obrigatória');
    });

    it('should throw when justificativa is whitespace only', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.reject(doc.protocoloUnico, 'aprovador-1', '   '),
      ).rejects.toThrow('Justificativa é obrigatória');
    });

    it('should log rejection in audit trail', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const countBefore = auditService.count;
      await service.reject(doc.protocoloUnico, 'aprovador-1', 'Motivo');

      expect(auditService.count).toBeGreaterThan(countBefore);
    });

    it('should block rejection outside formal workflow', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await expect(
        service.reject(doc.protocoloUnico, 'aprovador-1', 'Motivo'),
      ).rejects.toThrow();
    });
  });

  // ─── returnForCorrection ─────────────────────────────────────────

  describe('returnForCorrection', () => {
    it('should return document for correction with mandatory justificativa', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const result = await service.returnForCorrection(
        doc.protocoloUnico,
        'aprovador-1',
        'CNPJ incorreto',
      );

      expect(result.status).toBe('devolvido');
      expect(result.justificativa).toBe('CNPJ incorreto');
      expect(doc.status).toBe('devolvido');
    });

    it('should throw when justificativa is empty', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.returnForCorrection(doc.protocoloUnico, 'aprovador-1', ''),
      ).rejects.toThrow('Justificativa é obrigatória');
    });

    it('should throw when justificativa is whitespace only', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.returnForCorrection(doc.protocoloUnico, 'aprovador-1', '   '),
      ).rejects.toThrow('Justificativa é obrigatória');
    });

    it('should log return in audit trail', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const countBefore = auditService.count;
      await service.returnForCorrection(
        doc.protocoloUnico,
        'aprovador-1',
        'Correção necessária',
      );

      expect(auditService.count).toBeGreaterThan(countBefore);
    });
  });

  // ─── escalate ────────────────────────────────────────────────────

  describe('escalate', () => {
    it('should escalate to next hierarchical level approver', async () => {
      const doc = makeDoc({ valorTotal: 500000 });
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const escalated = await service.escalate(doc.protocoloUnico);

      expect(escalated.aprovadorDesignado).toBe('aprovador-2');
      expect(escalated.status).toBe('escalado');
    });

    it('should escalate from level 2 to level 3', async () => {
      const doc = makeDoc({ valorTotal: 2000000 }); // level 2
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const escalated = await service.escalate(doc.protocoloUnico);

      expect(escalated.aprovadorDesignado).toBe('aprovador-3');
    });

    it('should throw when no higher level approver available', async () => {
      const doc = makeDoc({ valorTotal: 6000000 }); // level 3 (highest)
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      await expect(
        service.escalate(doc.protocoloUnico),
      ).rejects.toThrow('Nenhum aprovador de nível superior');
    });

    it('should update SLA deadline on escalation', async () => {
      const doc = makeDoc({ valorTotal: 500000 });
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const before = new Date();
      const escalated = await service.escalate(doc.protocoloUnico);

      expect(escalated.slaLimite.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should log escalation in audit trail', async () => {
      const doc = makeDoc({ valorTotal: 500000 });
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const countBefore = auditService.count;
      await service.escalate(doc.protocoloUnico);

      expect(auditService.count).toBeGreaterThan(countBefore);
    });

    it('should throw when no approval request exists', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await expect(
        service.escalate(doc.protocoloUnico),
      ).rejects.toThrow('Nenhuma solicitação de aprovação');
    });
  });

  // ─── checkSoDConflict ────────────────────────────────────────────

  describe('checkSoDConflict', () => {
    it('should detect conflict when user registered the document', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await auditService.log({
        usuarioId: 'analista-1',
        tipoAcao: 'documento_recebido',
        protocoloUnico: doc.protocoloUnico,
      });

      const result = await service.checkSoDConflict(
        doc.protocoloUnico,
        'analista-1',
      );

      expect(result.conflito).toBe(true);
      expect(result.regrasVioladas.length).toBeGreaterThan(0);
      expect(result.mensagem).toContain('Segregação de Funções');
    });

    it('should not detect conflict for different user', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await auditService.log({
        usuarioId: 'analista-1',
        tipoAcao: 'documento_recebido',
        protocoloUnico: doc.protocoloUnico,
      });

      const result = await service.checkSoDConflict(
        doc.protocoloUnico,
        'aprovador-1',
      );

      expect(result.conflito).toBe(false);
      expect(result.regrasVioladas).toHaveLength(0);
    });

    it('should detect conflict when user approved (blocks ERP registration)', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await auditService.log({
        usuarioId: 'aprovador-1',
        tipoAcao: 'aprovacao',
        protocoloUnico: doc.protocoloUnico,
      });

      const result = await service.checkSoDConflict(
        doc.protocoloUnico,
        'aprovador-1',
      );

      expect(result.conflito).toBe(true);
      expect(result.regrasVioladas).toContain(
        'Quem aprovou não pode registrar no ERP',
      );
    });

    it('should ignore inactive SoD rules', async () => {
      const inactiveRules: SoDRule[] = [
        {
          id: 'sod-inactive',
          acaoOrigem: 'documento_recebido',
          acaoBloqueada: 'aprovacao',
          descricao: 'Regra inativa',
          ativo: false,
        },
      ];

      const svc = new WorkflowService(
        auditService,
        documentStore,
        defaultAlcadas,
        inactiveRules,
        defaultSlaConfig,
      );

      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);

      await auditService.log({
        usuarioId: 'analista-1',
        tipoAcao: 'documento_recebido',
        protocoloUnico: doc.protocoloUnico,
      });

      const result = await svc.checkSoDConflict(
        doc.protocoloUnico,
        'analista-1',
      );

      expect(result.conflito).toBe(false);
    });
  });

  // ─── checkAndNotifySlaExceeded ───────────────────────────────────

  describe('checkAndNotifySlaExceeded', () => {
    it('should detect and log SLA exceeded notifications', async () => {
      // Create a service with very short SLA (0 minutes = already expired)
      const shortSla: SLAConfig = {
        etapa: 'aprovacao',
        tempoMaximoMinutos: 0,
        percentualAlerta: 0.8,
      };
      const svc = new WorkflowService(
        auditService,
        documentStore,
        defaultAlcadas,
        defaultSoDRules,
        shortSla,
      );

      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await svc.submitForApproval(doc.protocoloUnico);

      // Wait a tiny bit so now > slaLimite
      await new Promise((r) => setTimeout(r, 10));

      const escalated = await svc.checkAndNotifySlaExceeded();

      expect(escalated).toContain(doc.protocoloUnico);
    });

    it('should not flag documents within SLA', async () => {
      const doc = makeDoc();
      documentStore.set(doc.protocoloUnico, doc);
      await service.submitForApproval(doc.protocoloUnico);

      const escalated = await service.checkAndNotifySlaExceeded();

      expect(escalated).not.toContain(doc.protocoloUnico);
    });
  });
});
