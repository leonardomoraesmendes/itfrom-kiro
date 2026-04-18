import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const queueRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { queueService } = opts.container;

  fastify.get('/queue/:analistaId', {
    schema: {
      description: 'Obter fila operacional de um analista',
      tags: ['Fila Operacional'],
      params: {
        type: 'object',
        required: ['analistaId'],
        properties: { analistaId: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          etapa: { type: 'string' },
          slaStatus: { type: 'string', enum: ['dentro_prazo', 'alerta', 'vencido'] },
          fornecedor: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { analistaId } = request.params as { analistaId: string };
    const filters = request.query as {
      etapa?: string;
      slaStatus?: 'dentro_prazo' | 'alerta' | 'vencido';
      fornecedor?: string;
    };
    return queueService.getQueue(analistaId, {
      etapa: filters.etapa as any,
      slaStatus: filters.slaStatus,
      fornecedor: filters.fornecedor,
    });
  });

  fastify.put('/queue/reassign/:id', {
    schema: {
      description: 'Reatribuir item da fila para outro analista',
      tags: ['Fila Operacional'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['novoAnalistaId'],
        properties: {
          novoAnalistaId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { novoAnalistaId } = request.body as { novoAnalistaId: string };
    await queueService.reassignItem(id, novoAnalistaId);
    return { success: true };
  });

  fastify.get('/queue/kpis/:analistaId', {
    schema: {
      description: 'Obter KPIs da fila operacional de um analista',
      tags: ['Fila Operacional'],
      params: {
        type: 'object',
        required: ['analistaId'],
        properties: { analistaId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { analistaId } = request.params as { analistaId: string };
    return queueService.getQueueKPIs(analistaId);
  });
};
