// Tipos relacionados à trilha de auditoria

export type AuditActionType =
  | 'documento_recebido'
  | 'extracao_concluida'
  | 'campo_corrigido'
  | 'validacao_executada'
  | 'duplicata_liberada'
  | 'duplicata_rejeitada'
  | 'aprovacao'
  | 'rejeicao'
  | 'devolucao'
  | 'override_validacao'
  | 'registro_erp'
  | 'reprocessamento_erp'
  | 'alteracao_configuracao'
  | 'violacao_sod_bloqueada';

export interface AuditEntryInput {
  usuarioId: string;
  tipoAcao: AuditActionType;
  protocoloUnico?: string;
  valoresAnteriores?: Record<string, unknown>;
  valoresPosteriores?: Record<string, unknown>;
  justificativa?: string;
  destaque?: boolean; // true para overrides
}

export interface AuditEntry extends AuditEntryInput {
  id: string;
  dataHora: Date; // precisão de segundos
}

export interface AuditFilters {
  periodo?: { inicio: Date; fim: Date };
  usuarioId?: string;
  tipoAcao?: AuditActionType;
  protocoloUnico?: string;
  page: number;
  pageSize: number;
}
