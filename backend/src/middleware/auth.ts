import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Permission, UserProfile, IAuditService } from '@ap-automation/shared';

// ─── Types ───────────────────────────────────────────────────────────

/** Decoded token payload for MVP (base64-encoded JSON) */
export interface TokenPayload {
  userId: string;
  perfil: UserProfile['perfil'];
}

/** Extend Fastify request with authenticated user info */
export interface AuthenticatedRequest extends FastifyRequest {
  user: TokenPayload;
}

// ─── Permission Mappings ─────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  'documento.receber',
  'documento.revisar',
  'documento.validar',
  'documento.aprovar',
  'documento.rejeitar',
  'documento.devolver',
  'fila.visualizar',
  'fila.reatribuir',
  'erp.reprocessar',
  'dashboard.operacional',
  'dashboard.gerencial',
  'auditoria.consultar',
  'configuracao.alterar',
  'dados.exportar',
];

export const PROFILE_PERMISSIONS: Record<UserProfile['perfil'], Permission[]> = {
  analista_ap: [
    'documento.receber',
    'documento.revisar',
    'documento.validar',
    'fila.visualizar',
  ],
  aprovador: [
    'documento.aprovar',
    'documento.rejeitar',
    'documento.devolver',
    'fila.visualizar',
  ],
  tesouraria: [
    'dashboard.operacional',
    'dashboard.gerencial',
    'dados.exportar',
  ],
  controladoria: [
    'auditoria.consultar',
    'dashboard.operacional',
    'dashboard.gerencial',
    'dados.exportar',
  ],
  administrador: [...ALL_PERMISSIONS],
};

// ─── Token Helpers ───────────────────────────────────────────────────

/** Encode a token payload as a base64 string (MVP helper) */
export function encodeToken(payload: TokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/** Decode and validate a base64-encoded token. Returns null on failure. */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.userId !== 'string' ||
      !parsed.userId ||
      typeof parsed.perfil !== 'string' ||
      !isValidPerfil(parsed.perfil)
    ) {
      return null;
    }

    return { userId: parsed.userId, perfil: parsed.perfil };
  } catch {
    return null;
  }
}

function isValidPerfil(value: string): value is UserProfile['perfil'] {
  return ['analista_ap', 'aprovador', 'tesouraria', 'controladoria', 'administrador'].includes(value);
}

// ─── Authentication Middleware ────────────────────────────────────────

/**
 * Fastify preHandler that validates the Authorization header.
 * Expects `Authorization: Bearer <base64-encoded-json>`.
 * Attaches `request.user` on success; replies 401 on failure.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Token de autenticação ausente ou inválido' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);
  const payload = decodeToken(token);

  if (!payload) {
    reply.code(401).send({ error: 'Token de autenticação ausente ou inválido' });
    return;
  }

  // Attach user info to request for downstream handlers
  (request as AuthenticatedRequest).user = payload;
}

// ─── Authorization Middleware Factory ─────────────────────────────────

/**
 * Returns a Fastify preHandler that checks whether the authenticated user's
 * profile grants the required permission(s). Replies 403 if not.
 *
 * Must be used AFTER `authenticate`.
 */
export function requirePermission(...permissions: Permission[]) {
  return async function authorize(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      reply.code(401).send({ error: 'Token de autenticação ausente ou inválido' });
      return;
    }

    const userPermissions = PROFILE_PERMISSIONS[user.perfil] ?? [];

    const hasAll = permissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      reply.code(403).send({
        error: 'Permissão insuficiente',
        required: permissions,
        perfil: user.perfil,
      });
      return;
    }
  };
}

// ─── Configuration Change Logging ────────────────────────────────────

/**
 * Logs profile/alcada configuration changes to the audit trail.
 * Should be called by admin endpoints that modify RBAC settings.
 */
export async function logConfigChange(
  auditService: IAuditService,
  userId: string,
  valoresAnteriores: Record<string, unknown>,
  valoresPosteriores: Record<string, unknown>,
  justificativa?: string,
): Promise<void> {
  await auditService.log({
    usuarioId: userId,
    tipoAcao: 'alteracao_configuracao',
    valoresAnteriores,
    valoresPosteriores,
    justificativa,
  });
}
