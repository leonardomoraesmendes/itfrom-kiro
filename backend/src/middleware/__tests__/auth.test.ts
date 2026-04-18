import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { IAuditService } from '@ap-automation/shared';
import {
  authenticate,
  requirePermission,
  encodeToken,
  decodeToken,
  logConfigChange,
  PROFILE_PERMISSIONS,
  type TokenPayload,
  type AuthenticatedRequest,
} from '../auth';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): FastifyRequest {
  return {
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
  } as unknown as FastifyRequest;
}

function makeReply() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply as unknown as FastifyReply & { statusCode: number; body: unknown };
}

// ─── Token Encoding / Decoding ───────────────────────────────────────

describe('encodeToken / decodeToken', () => {
  it('should round-trip a valid payload', () => {
    const payload: TokenPayload = { userId: 'user-1', perfil: 'analista_ap' };
    const token = encodeToken(payload);
    const decoded = decodeToken(token);
    expect(decoded).toEqual(payload);
  });

  it('should return null for non-base64 garbage', () => {
    expect(decodeToken('not-valid!!!')).toBeNull();
  });

  it('should return null for valid base64 but invalid JSON', () => {
    const token = Buffer.from('not json').toString('base64');
    expect(decodeToken(token)).toBeNull();
  });

  it('should return null when userId is missing', () => {
    const token = Buffer.from(JSON.stringify({ perfil: 'aprovador' })).toString('base64');
    expect(decodeToken(token)).toBeNull();
  });

  it('should return null when perfil is invalid', () => {
    const token = Buffer.from(JSON.stringify({ userId: 'u1', perfil: 'hacker' })).toString('base64');
    expect(decodeToken(token)).toBeNull();
  });

  it('should return null when userId is empty string', () => {
    const token = Buffer.from(JSON.stringify({ userId: '', perfil: 'aprovador' })).toString('base64');
    expect(decodeToken(token)).toBeNull();
  });

  it('should decode all valid profiles', () => {
    const profiles = ['analista_ap', 'aprovador', 'tesouraria', 'controladoria', 'administrador'] as const;
    for (const perfil of profiles) {
      const token = encodeToken({ userId: 'u1', perfil });
      expect(decodeToken(token)).toEqual({ userId: 'u1', perfil });
    }
  });
});

// ─── authenticate middleware ─────────────────────────────────────────

describe('authenticate', () => {
  it('should return 401 when no Authorization header is present', async () => {
    const req = makeRequest();
    const reply = makeReply();
    await authenticate(req, reply);
    expect(reply.statusCode).toBe(401);
    expect((reply.body as { error: string }).error).toContain('autenticação');
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const req = makeRequest('Basic abc123');
    const reply = makeReply();
    await authenticate(req, reply);
    expect(reply.statusCode).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const req = makeRequest('Bearer invalidtoken!!!');
    const reply = makeReply();
    await authenticate(req, reply);
    expect(reply.statusCode).toBe(401);
  });

  it('should attach user to request on valid token', async () => {
    const payload: TokenPayload = { userId: 'user-42', perfil: 'tesouraria' };
    const token = encodeToken(payload);
    const req = makeRequest(`Bearer ${token}`);
    const reply = makeReply();
    await authenticate(req, reply);
    expect(reply.statusCode).toBe(200); // not changed
    expect((req as AuthenticatedRequest).user).toEqual(payload);
  });

  it('should return 401 when Bearer token is empty', async () => {
    const req = makeRequest('Bearer ');
    const reply = makeReply();
    await authenticate(req, reply);
    expect(reply.statusCode).toBe(401);
  });
});

// ─── requirePermission middleware ────────────────────────────────────

describe('requirePermission', () => {
  it('should return 401 when user is not attached to request', async () => {
    const middleware = requirePermission('documento.receber');
    const req = makeRequest();
    const reply = makeReply();
    await middleware(req, reply);
    expect(reply.statusCode).toBe(401);
  });

  it('should pass when user profile has the required permission', async () => {
    const middleware = requirePermission('documento.receber');
    const payload: TokenPayload = { userId: 'u1', perfil: 'analista_ap' };
    const token = encodeToken(payload);
    const req = makeRequest(`Bearer ${token}`);
    const reply = makeReply();
    // First authenticate
    await authenticate(req, reply);
    // Then authorize
    const authReply = makeReply();
    await middleware(req, authReply);
    expect(authReply.statusCode).toBe(200); // not changed = pass
  });

  it('should return 403 when user profile lacks the required permission', async () => {
    const middleware = requirePermission('configuracao.alterar');
    const payload: TokenPayload = { userId: 'u1', perfil: 'analista_ap' };
    const token = encodeToken(payload);
    const req = makeRequest(`Bearer ${token}`);
    const reply = makeReply();
    await authenticate(req, reply);
    const authReply = makeReply();
    await middleware(req, authReply);
    expect(authReply.statusCode).toBe(403);
    expect((authReply.body as { error: string }).error).toContain('Permissão insuficiente');
  });

  it('should pass for administrador with any permission', async () => {
    const middleware = requirePermission('configuracao.alterar', 'auditoria.consultar', 'erp.reprocessar');
    const payload: TokenPayload = { userId: 'admin-1', perfil: 'administrador' };
    const token = encodeToken(payload);
    const req = makeRequest(`Bearer ${token}`);
    const reply = makeReply();
    await authenticate(req, reply);
    const authReply = makeReply();
    await middleware(req, authReply);
    expect(authReply.statusCode).toBe(200);
  });

  it('should return 403 when user has some but not all required permissions', async () => {
    // aprovador has fila.visualizar but not documento.receber
    const middleware = requirePermission('fila.visualizar', 'documento.receber');
    const payload: TokenPayload = { userId: 'u1', perfil: 'aprovador' };
    const token = encodeToken(payload);
    const req = makeRequest(`Bearer ${token}`);
    const reply = makeReply();
    await authenticate(req, reply);
    const authReply = makeReply();
    await middleware(req, authReply);
    expect(authReply.statusCode).toBe(403);
  });
});

// ─── PROFILE_PERMISSIONS mapping ─────────────────────────────────────

describe('PROFILE_PERMISSIONS', () => {
  it('analista_ap should have document intake and queue permissions', () => {
    const perms = PROFILE_PERMISSIONS.analista_ap;
    expect(perms).toContain('documento.receber');
    expect(perms).toContain('documento.revisar');
    expect(perms).toContain('documento.validar');
    expect(perms).toContain('fila.visualizar');
    expect(perms).not.toContain('documento.aprovar');
  });

  it('aprovador should have approval permissions', () => {
    const perms = PROFILE_PERMISSIONS.aprovador;
    expect(perms).toContain('documento.aprovar');
    expect(perms).toContain('documento.rejeitar');
    expect(perms).toContain('documento.devolver');
    expect(perms).toContain('fila.visualizar');
    expect(perms).not.toContain('documento.receber');
  });

  it('tesouraria should have dashboard and export permissions', () => {
    const perms = PROFILE_PERMISSIONS.tesouraria;
    expect(perms).toContain('dashboard.operacional');
    expect(perms).toContain('dashboard.gerencial');
    expect(perms).toContain('dados.exportar');
    expect(perms).not.toContain('documento.aprovar');
  });

  it('controladoria should have audit and dashboard permissions', () => {
    const perms = PROFILE_PERMISSIONS.controladoria;
    expect(perms).toContain('auditoria.consultar');
    expect(perms).toContain('dashboard.operacional');
    expect(perms).toContain('dashboard.gerencial');
    expect(perms).toContain('dados.exportar');
    expect(perms).not.toContain('configuracao.alterar');
  });

  it('administrador should have all permissions', () => {
    const perms = PROFILE_PERMISSIONS.administrador;
    expect(perms).toContain('documento.receber');
    expect(perms).toContain('documento.aprovar');
    expect(perms).toContain('configuracao.alterar');
    expect(perms).toContain('auditoria.consultar');
    expect(perms).toContain('erp.reprocessar');
    expect(perms).toContain('dados.exportar');
    expect(perms.length).toBe(14); // all permissions
  });
});

// ─── logConfigChange ─────────────────────────────────────────────────

describe('logConfigChange', () => {
  it('should log configuration change to audit service', async () => {
    const mockAudit: IAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
    };

    await logConfigChange(
      mockAudit,
      'admin-1',
      { perfil: 'analista_ap', permissoes: ['documento.receber'] },
      { perfil: 'analista_ap', permissoes: ['documento.receber', 'fila.reatribuir'] },
      'Adicionada permissão de reatribuição',
    );

    expect(mockAudit.log).toHaveBeenCalledOnce();
    expect(mockAudit.log).toHaveBeenCalledWith({
      usuarioId: 'admin-1',
      tipoAcao: 'alteracao_configuracao',
      valoresAnteriores: { perfil: 'analista_ap', permissoes: ['documento.receber'] },
      valoresPosteriores: { perfil: 'analista_ap', permissoes: ['documento.receber', 'fila.reatribuir'] },
      justificativa: 'Adicionada permissão de reatribuição',
    });
  });

  it('should log without justificativa when not provided', async () => {
    const mockAudit: IAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
    };

    await logConfigChange(
      mockAudit,
      'admin-1',
      { alcada: 100000 },
      { alcada: 200000 },
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoAcao: 'alteracao_configuracao',
        justificativa: undefined,
      }),
    );
  });
});
