// Tipos de autenticação e autorização (RBAC)

import type { AlcadaConfig } from './config';

export type Permission =
  | 'documento.receber'
  | 'documento.revisar'
  | 'documento.validar'
  | 'documento.aprovar'
  | 'documento.rejeitar'
  | 'documento.devolver'
  | 'fila.visualizar'
  | 'fila.reatribuir'
  | 'erp.reprocessar'
  | 'dashboard.operacional'
  | 'dashboard.gerencial'
  | 'auditoria.consultar'
  | 'configuracao.alterar'
  | 'dados.exportar';

export interface UserProfile {
  userId: string;
  perfil: 'analista_ap' | 'aprovador' | 'tesouraria' | 'controladoria' | 'administrador';
  permissoes: Permission[];
  alcadas?: AlcadaConfig[];
}
