import type {
  IWorkflowService,
  IAuditService,
  ApprovalRequest,
  ApprovalResult,
  SoDCheckResult,
  DocumentoFiscal,
  AlcadaConfig,
  SoDRule,
  SLAConfig,
} from '@ap-automation/shared';

/**
 * In-memory Workflow Service implementing IWorkflowService.
 *
 * Manages the formal approval workflow with:
 * - Automatic routing based on document value vs. approver alcada
 * - Segregation of Duties (SoD) enforcement
 * - Mandatory justification for rejection/return
 * - Automatic escalation when value exceeds alcada
 * - SLA-based escalation notifications
 * - Full audit trail logging
 */
export class WorkflowService implements IWorkflowService {
  private readonly approvalRequests = new Map<string, ApprovalRequest>();

  constructor(
    private readonly auditService: IAuditService,
    private readonly documentStore: Map<string, DocumentoFiscal>,
    private readonly alcadaConfigs: AlcadaConfig[],
    private readonly sodRules: SoDRule[],
    private readonly slaConfig?: SLAConfig,
  ) {}

  async submitForApproval(protocoloUnico: string): Promise<ApprovalRequest> {
    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    // Find the appropriate approver based on document value vs. alcada range
    const approver = this.findApproverForValue(doc.valorTotal);
    if (!approver) {
      throw new Error(
        `Nenhum aprovador configurado para o valor ${doc.valorTotal} centavos`,
      );
    }

    // Calculate SLA deadline
    const slaLimite = this.calculateSlaDeadline();

    const request: ApprovalRequest = {
      protocoloUnico,
      aprovadorDesignado: approver.aprovadorId,
      alcadaRequerida: doc.valorTotal,
      slaLimite,
      status: 'pendente',
    };

    this.approvalRequests.set(protocoloUnico, request);

    // Update document status
    doc.status = 'aguardando_aprovacao';
    doc.aprovadorDesignado = approver.aprovadorId;
    doc.updatedAt = new Date();

    await this.auditService.log({
      usuarioId: 'sistema',
      tipoAcao: 'aprovacao',
      protocoloUnico,
      valoresPosteriores: {
        aprovadorDesignado: approver.aprovadorId,
        alcadaRequerida: doc.valorTotal,
        slaLimite: slaLimite.toISOString(),
      },
    });

    return request;
  }

  async approve(
    protocoloUnico: string,
    aprovadorId: string,
    justificativa?: string,
  ): Promise<ApprovalResult> {
    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    // Check SoD: block if the approver is the same user who registered the document
    const sodCheck = await this.checkSoDConflict(protocoloUnico, aprovadorId);
    if (sodCheck.conflito) {
      await this.auditService.log({
        usuarioId: aprovadorId,
        tipoAcao: 'violacao_sod_bloqueada',
        protocoloUnico,
        valoresPosteriores: {
          regrasVioladas: sodCheck.regrasVioladas,
          mensagem: sodCheck.mensagem,
        },
      });
      throw new Error(sodCheck.mensagem);
    }

    // Block approvals outside the formal workflow
    const request = this.approvalRequests.get(protocoloUnico);
    if (!request || request.status !== 'pendente') {
      throw new Error(
        'Aprovação bloqueada: documento não está em workflow formal de aprovação (status pendente). ' +
        'Aprovações fora do workflow formal não são permitidas.',
      );
    }

    // Record approval
    request.status = 'aprovado';
    doc.status = 'aprovado';
    doc.updatedAt = new Date();

    const result: ApprovalResult = {
      protocoloUnico,
      status: 'aprovado',
      aprovadorId,
      dataHora: new Date(),
      justificativa,
    };

    await this.auditService.log({
      usuarioId: aprovadorId,
      tipoAcao: 'aprovacao',
      protocoloUnico,
      valoresAnteriores: { status: 'aguardando_aprovacao' },
      valoresPosteriores: { status: 'aprovado' },
      justificativa,
    });

    return result;
  }

  async reject(
    protocoloUnico: string,
    aprovadorId: string,
    justificativa: string,
  ): Promise<ApprovalResult> {
    if (!justificativa || justificativa.trim().length === 0) {
      throw new Error('Justificativa é obrigatória para rejeição');
    }

    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    const request = this.approvalRequests.get(protocoloUnico);
    if (!request || request.status !== 'pendente') {
      throw new Error(
        'Rejeição bloqueada: documento não está em workflow formal de aprovação (status pendente).',
      );
    }

    request.status = 'rejeitado';
    doc.status = 'rejeitado';
    doc.updatedAt = new Date();

    const result: ApprovalResult = {
      protocoloUnico,
      status: 'rejeitado',
      aprovadorId,
      dataHora: new Date(),
      justificativa,
    };

    await this.auditService.log({
      usuarioId: aprovadorId,
      tipoAcao: 'rejeicao',
      protocoloUnico,
      valoresAnteriores: { status: 'aguardando_aprovacao' },
      valoresPosteriores: { status: 'rejeitado' },
      justificativa,
    });

    return result;
  }

  async returnForCorrection(
    protocoloUnico: string,
    aprovadorId: string,
    justificativa: string,
  ): Promise<ApprovalResult> {
    if (!justificativa || justificativa.trim().length === 0) {
      throw new Error('Justificativa é obrigatória para devolução');
    }

    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    const request = this.approvalRequests.get(protocoloUnico);
    if (!request || request.status !== 'pendente') {
      throw new Error(
        'Devolução bloqueada: documento não está em workflow formal de aprovação (status pendente).',
      );
    }

    request.status = 'devolvido';
    doc.status = 'devolvido';
    doc.updatedAt = new Date();

    const result: ApprovalResult = {
      protocoloUnico,
      status: 'devolvido',
      aprovadorId,
      dataHora: new Date(),
      justificativa,
    };

    await this.auditService.log({
      usuarioId: aprovadorId,
      tipoAcao: 'devolucao',
      protocoloUnico,
      valoresAnteriores: { status: 'aguardando_aprovacao' },
      valoresPosteriores: { status: 'devolvido' },
      justificativa,
    });

    return result;
  }

  async escalate(protocoloUnico: string): Promise<ApprovalRequest> {
    const doc = this.documentStore.get(protocoloUnico);
    if (!doc) {
      throw new Error(`Documento não encontrado: ${protocoloUnico}`);
    }

    const request = this.approvalRequests.get(protocoloUnico);
    if (!request) {
      throw new Error(
        `Nenhuma solicitação de aprovação encontrada para: ${protocoloUnico}`,
      );
    }

    // Find the current approver's alcada config
    const currentApprover = this.alcadaConfigs.find(
      (a) => a.aprovadorId === request.aprovadorDesignado && a.ativo,
    );

    if (!currentApprover) {
      throw new Error(
        `Configuração de alçada não encontrada para aprovador: ${request.aprovadorDesignado}`,
      );
    }

    // Find the next level approver (higher hierarchy)
    const nextLevelApprover = this.alcadaConfigs
      .filter(
        (a) =>
          a.ativo && a.nivelHierarquico > currentApprover.nivelHierarquico,
      )
      .sort((a, b) => a.nivelHierarquico - b.nivelHierarquico)[0];

    if (!nextLevelApprover) {
      throw new Error(
        'Nenhum aprovador de nível superior disponível para escalação',
      );
    }

    // Update the request
    request.aprovadorDesignado = nextLevelApprover.aprovadorId;
    request.status = 'escalado';
    request.slaLimite = this.calculateSlaDeadline();

    // Update document
    doc.aprovadorDesignado = nextLevelApprover.aprovadorId;
    doc.updatedAt = new Date();

    await this.auditService.log({
      usuarioId: 'sistema',
      tipoAcao: 'aprovacao',
      protocoloUnico,
      valoresAnteriores: {
        aprovadorDesignado: currentApprover.aprovadorId,
        nivelHierarquico: currentApprover.nivelHierarquico,
      },
      valoresPosteriores: {
        aprovadorDesignado: nextLevelApprover.aprovadorId,
        nivelHierarquico: nextLevelApprover.nivelHierarquico,
        motivo: 'escalacao_automatica',
      },
    });

    return request;
  }

  async checkSoDConflict(
    protocoloUnico: string,
    userId: string,
  ): Promise<SoDCheckResult> {
    // Query audit trail for this document
    const auditResult = await this.auditService.query({
      protocoloUnico,
      page: 1,
      pageSize: 1000,
    });

    const userActions = auditResult.items.filter(
      (entry) => entry.usuarioId === userId,
    );

    const regrasVioladas: string[] = [];

    for (const rule of this.sodRules) {
      if (!rule.ativo) continue;

      // Check if user performed the origin action
      const performedOrigin = userActions.some(
        (entry) => entry.tipoAcao === rule.acaoOrigem,
      );

      if (performedOrigin) {
        regrasVioladas.push(rule.descricao);
      }
    }

    if (regrasVioladas.length > 0) {
      return {
        conflito: true,
        regrasVioladas,
        mensagem: `Violação de Segregação de Funções: ${regrasVioladas.join('; ')}`,
      };
    }

    return {
      conflito: false,
      regrasVioladas: [],
      mensagem: 'Nenhum conflito de Segregação de Funções detectado',
    };
  }

  /**
   * Check if any pending approval has exceeded its SLA and trigger escalation notification.
   * Returns the list of escalated protocol IDs.
   */
  async checkAndNotifySlaExceeded(): Promise<string[]> {
    const now = new Date();
    const escalated: string[] = [];

    for (const [protocoloUnico, request] of this.approvalRequests) {
      if (request.status === 'pendente' && now > request.slaLimite) {
        await this.auditService.log({
          usuarioId: 'sistema',
          tipoAcao: 'aprovacao',
          protocoloUnico,
          valoresPosteriores: {
            motivo: 'notificacao_sla_excedido',
            aprovadorDesignado: request.aprovadorDesignado,
            slaLimite: request.slaLimite.toISOString(),
          },
        });
        escalated.push(protocoloUnico);
      }
    }

    return escalated;
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private findApproverForValue(valor: number): AlcadaConfig | undefined {
    return this.alcadaConfigs
      .filter(
        (a) => a.ativo && valor >= a.valorMinimo && valor <= a.valorMaximo,
      )
      .sort((a, b) => a.nivelHierarquico - b.nivelHierarquico)[0];
  }

  private calculateSlaDeadline(): Date {
    const tempoMaximoMinutos = this.slaConfig?.tempoMaximoMinutos ?? 1440; // default 24h
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + tempoMaximoMinutos);
    return deadline;
  }
}
