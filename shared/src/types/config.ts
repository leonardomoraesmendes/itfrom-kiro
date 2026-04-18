// Tipos de configuração: alçadas, SLA e segregação de funções

import type { ProcessStage } from './document';
import type { AuditActionType } from './audit';

export interface AlcadaConfig {
  id: string;
  aprovadorId: string;
  valorMinimo: number;    // centavos
  valorMaximo: number;    // centavos
  nivelHierarquico: number;
  ativo: boolean;
}

export interface SLAConfig {
  etapa: ProcessStage;
  tempoMaximoMinutos: number;
  percentualAlerta: number; // 0.8 = 80%
}

export interface SoDRule {
  id: string;
  acaoOrigem: AuditActionType;
  acaoBloqueada: AuditActionType;
  descricao: string;
  ativo: boolean;
}
