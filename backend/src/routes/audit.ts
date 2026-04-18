import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const auditRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { auditService } = opts.container;

  fastify.get('/audit', {
    schema: {
      description: 'Consultar trilha de auditoria',
      tags: ['Auditoria'],
      querystring: {
        type: 'object',
        properties: {
          usuarioId: { type: 'string' },
          tipoAcao: { type: 'string' },
          protocoloUnico: { type: 'string' },
          page: { type: 'number', default: 1 },
          pageSize: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      usuarioId?: string;
      tipoAcao?: string;
      protocoloUnico?: string;
      page?: number;
      pageSize?: number;
    };
    return auditService.query({
      usuarioId: query.usuarioId,
      tipoAcao: query.tipoAcao as any,
      protocoloUnico: query.protocoloUnico,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  });
};
