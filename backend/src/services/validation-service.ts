import type {
  IAuditService,
  IValidationService,
  ValidationResult,
  RuleResult,
  DuplicateCheckResult,
  ExceptionDecision,
  DocumentoFiscal,
} from '@ap-automation/shared';

/**
 * In-memory Validation Service implementing IValidationService.
 *
 * Validates fiscal documents against business rules, detects duplicates,
 * and resolves exceptions — logging every decision to the audit trail.
 */
export class ValidationService implements IValidationService {
  private readonly auditService: IAuditService;
  private readonly documentStore: DocumentoFiscal[];

  constructor(auditService: IAuditService, documentStore: DocumentoFiscal[] = []) {
    this.auditService = auditService;
    this.documentStore = documentStore;
  }

  async validateDocument(doc: DocumentoFiscal): Promise<ValidationResult> {
    const regras: RuleResult[] = [
      this.validateCnpj(doc),
      this.validateDataVencimento(doc),
      this.validateValorTotal(doc),
      this.validateFornecedor(doc),
    ];

    const aprovado = regras.every((r) => r.status === 'aprovada');

    await this.auditService.log({
      usuarioId: doc.analistaResponsavel ?? 'sistema',
      tipoAcao: 'validacao_executada',
      protocoloUnico: doc.protocoloUnico,
      valoresPosteriores: {
        aprovado,
        regras: regras.map((r) => ({ regra: r.regra, status: r.status })),
      },
    });

    return { protocoloUnico: doc.protocoloUnico, regras, aprovado };
  }

  async checkDuplicate(doc: DocumentoFiscal): Promise<DuplicateCheckResult> {
    const documentosSimilares: DocumentoFiscal[] = [];
    let criterios = {
      cnpjEmitente: false,
      numeroDocumento: false,
      valorDentroTolerancia: false,
    };

    for (const existing of this.documentStore) {
      if (existing.protocoloUnico === doc.protocoloUnico) continue;

      const sameCnpj = existing.cnpjEmitente === doc.cnpjEmitente;
      const sameNumero = existing.numeroDocumento === doc.numeroDocumento;
      const maxVal = Math.max(existing.valorTotal, doc.valorTotal);
      const withinTolerance =
        maxVal === 0
          ? existing.valorTotal === doc.valorTotal
          : Math.abs(existing.valorTotal - doc.valorTotal) / maxVal <= 0.01;

      if (sameCnpj && sameNumero && withinTolerance) {
        documentosSimilares.push(existing);
        criterios = {
          cnpjEmitente: true,
          numeroDocumento: true,
          valorDentroTolerancia: true,
        };
      }
    }

    return {
      duplicataDetectada: documentosSimilares.length > 0,
      documentosSimilares,
      criterios,
    };
  }

  async resolveException(
    protocoloUnico: string,
    decision: ExceptionDecision,
  ): Promise<void> {
    if (!decision.justificativa || decision.justificativa.trim() === '') {
      throw new Error('Justificativa é obrigatória para resolução de exceção');
    }

    const tipoAcao =
      decision.tipo === 'liberar' ? 'duplicata_liberada' : 'duplicata_rejeitada';

    await this.auditService.log({
      usuarioId: decision.usuarioId,
      tipoAcao,
      protocoloUnico,
      justificativa: decision.justificativa,
      valoresPosteriores: { decisao: decision.tipo },
      destaque: decision.tipo === 'liberar',
    });
  }

  // ── Private validation rules ──────────────────────────────────────

  private validateCnpj(doc: DocumentoFiscal): RuleResult {
    const cnpjRegex = /^\d{14}$/;
    const emitenteOk = cnpjRegex.test(doc.cnpjEmitente);
    const destinatarioOk = cnpjRegex.test(doc.cnpjDestinatario);

    if (emitenteOk && destinatarioOk) {
      return {
        regra: 'consistencia_cnpj',
        status: 'aprovada',
        detalhes: 'CNPJ emitente e destinatário são válidos (14 dígitos)',
        criticidade: 'critica',
      };
    }

    const problemas: string[] = [];
    if (!emitenteOk) problemas.push('CNPJ emitente inválido');
    if (!destinatarioOk) problemas.push('CNPJ destinatário inválido');

    return {
      regra: 'consistencia_cnpj',
      status: 'reprovada',
      detalhes: problemas.join('; '),
      criticidade: 'critica',
    };
  }

  private validateDataVencimento(doc: DocumentoFiscal): RuleResult {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(doc.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);

    if (vencimento >= hoje) {
      return {
        regra: 'validade_data_vencimento',
        status: 'aprovada',
        detalhes: 'Data de vencimento é válida',
        criticidade: 'alta',
      };
    }

    return {
      regra: 'validade_data_vencimento',
      status: 'reprovada',
      detalhes: 'Data de vencimento está no passado',
      criticidade: 'alta',
    };
  }

  private validateValorTotal(doc: DocumentoFiscal): RuleResult {
    const somaItens = doc.itensLinha.reduce((sum, item) => sum + item.valorTotal, 0);

    if (doc.itensLinha.length === 0) {
      return {
        regra: 'coerencia_valor_total',
        status: 'aprovada',
        detalhes: 'Documento sem itens de linha — valor total aceito',
        criticidade: 'media',
      };
    }

    // Allow a small tolerance (1 centavo) for rounding
    if (Math.abs(doc.valorTotal - somaItens) <= 1) {
      return {
        regra: 'coerencia_valor_total',
        status: 'aprovada',
        detalhes: `Valor total (${doc.valorTotal}) confere com soma dos itens (${somaItens})`,
        criticidade: 'media',
      };
    }

    return {
      regra: 'coerencia_valor_total',
      status: 'reprovada',
      detalhes: `Valor total (${doc.valorTotal}) diverge da soma dos itens (${somaItens})`,
      criticidade: 'media',
    };
  }

  private validateFornecedor(_doc: DocumentoFiscal): RuleResult {
    // Stub: accept all suppliers for now, structured for future ERP integration
    return {
      regra: 'existencia_fornecedor',
      status: 'aprovada',
      detalhes: 'Fornecedor encontrado no cadastro (stub — aceitar todos)',
      criticidade: 'alta',
    };
  }
}
