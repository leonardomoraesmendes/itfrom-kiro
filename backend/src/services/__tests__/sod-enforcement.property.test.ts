import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowService } from '../workflow-service';
import { AuditService } from '../audit-service';
import type {
  DocumentoFiscal,
  AlcadaConfig,
  SoDRule,
  SLAConfig,
} from '@ap-automation/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeDoc(protocoloUnico: string): DocumentoFiscal {
  const now = new Date();
  return {
    protocoloUnico,
    cnpjEmitente: '12345678000190',
    cnpjDestinatario: '98765432000190',
    numeroDocumento: 'NF-001',
    dataEmissao: now,
    dataVencimento: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    valorTotal: 500000,
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
  };
}

const alcadaConfigs: AlcadaConfig[] = [
  {
    id: 'alc-1',
    aprovadorId: 'system-approver',
    valorMinimo: 0,
    valorMaximo: 99999999,
    nivelHierarquico: 1,
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
    descricao: 'Quem aprovou não pode registrar no ERP',
    ativo: true,
  },
];

const slaConfig: SLAConfig = {
  etapa: 'aprovacao',
  tempoMaximoMinutos: 1440,
  percentualAlerta: 0.8,
};

// ─── Arbitraries ─────────────────────────────────────────────────────

const arbUserId = fc.stringMatching(/^[a-z][a-z0-9_-]{2,19}$/).filter((s) => s !== 'sistema' && s !== 'system-approver');

const arbProtocoloUnico = fc.stringMatching(/^AP-\d{8}-\d{6}$/);

// ─── Property Tests ──────────────────────────────────────────────────

describe('Propriedade 2: Enforcement de Segregação de Funções', () => {
  /**
   * **Validates: Requirements 4.7, 8.4, 8.5**
   *
   * Property A: For any user who registered a document (logged 'documento_recebido'),
   * calling approve() must throw/be blocked for that user on that document.
   */
  it('approve() deve ser bloqueado para o usuário que registrou o documento', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUserId,
        arbProtocoloUnico,
        async (userId, protocoloUnico) => {
          const auditService = new AuditService();
          const documentStore = new Map<string, DocumentoFiscal>();
          const service = new WorkflowService(
            auditService,
            documentStore,
            alcadaConfigs,
            sodRules,
            slaConfig,
          );

          const doc = makeDoc(protocoloUnico);
          documentStore.set(protocoloUnico, doc);

          // User registers the document
          await auditService.log({
            usuarioId: userId,
            tipoAcao: 'documento_recebido',
            protocoloUnico,
          });

          // Submit for approval (creates pending request)
          await service.submitForApproval(protocoloUnico);

          // The same user trying to approve must be blocked
          await expect(
            service.approve(protocoloUnico, userId),
          ).rejects.toThrow('Segregação de Funções');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.7, 8.4, 8.5**
   *
   * Property B: For any user who approved a document (logged 'aprovacao'),
   * checkSoDConflict() must detect a conflict for that user (since the SoD rule
   * blocks 'registro_erp' for that user on that document).
   */
  it('checkSoDConflict() deve detectar conflito para o usuário que aprovou o documento', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUserId,
        arbProtocoloUnico,
        async (userId, protocoloUnico) => {
          const auditService = new AuditService();
          const documentStore = new Map<string, DocumentoFiscal>();
          const service = new WorkflowService(
            auditService,
            documentStore,
            alcadaConfigs,
            sodRules,
            slaConfig,
          );

          const doc = makeDoc(protocoloUnico);
          documentStore.set(protocoloUnico, doc);

          // User approved the document
          await auditService.log({
            usuarioId: userId,
            tipoAcao: 'aprovacao',
            protocoloUnico,
          });

          // SoD check must detect conflict (blocks registro_erp)
          const result = await service.checkSoDConflict(protocoloUnico, userId);

          expect(result.conflito).toBe(true);
          expect(result.regrasVioladas.length).toBeGreaterThan(0);
          expect(result.regrasVioladas).toContain(
            'Quem aprovou não pode registrar no ERP',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.7, 8.4, 8.5**
   *
   * Complementary property: A different user (who did NOT register the document)
   * CAN approve the same document — SoD must not block them.
   */
  it('um usuário diferente do que registrou PODE aprovar o documento', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUserId,
        arbUserId,
        arbProtocoloUnico,
        async (registerUser, approverUser, protocoloUnico) => {
          // Ensure the two users are distinct
          fc.pre(registerUser !== approverUser);

          const auditService = new AuditService();
          const documentStore = new Map<string, DocumentoFiscal>();
          const service = new WorkflowService(
            auditService,
            documentStore,
            alcadaConfigs,
            sodRules,
            slaConfig,
          );

          const doc = makeDoc(protocoloUnico);
          documentStore.set(protocoloUnico, doc);

          // One user registers the document
          await auditService.log({
            usuarioId: registerUser,
            tipoAcao: 'documento_recebido',
            protocoloUnico,
          });

          // Submit for approval
          await service.submitForApproval(protocoloUnico);

          // A different user should be able to approve
          const result = await service.approve(protocoloUnico, approverUser);

          expect(result.status).toBe('aprovado');
          expect(result.aprovadorId).toBe(approverUser);
        },
      ),
      { numRuns: 100 },
    );
  });
});
