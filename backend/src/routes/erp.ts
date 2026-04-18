import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const erpRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { erpConnector, documentStore } = opts.container;

  fastify.post('/erp/register/:id', {
    schema: {
      description: 'Registrar documento aprovado no ERP',
      tags: ['ERP'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = documentStore.get(id);
    if (!doc) {
      return reply.status(404).send({ error: `Documento não encontrado: ${id}` });
    }
    return erpConnector.registerDocument(doc);
  });

  fastify.post('/erp/reprocess/:id', {
    schema: {
      description: 'Reprocessar documento com erro de integração',
      tags: ['ERP'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return erpConnector.reprocessDocument(id);
  });

  fastify.post('/erp/sync', {
    schema: {
      description: 'Sincronizar status de pagamento com o ERP',
      tags: ['ERP'],
    },
  }, async () => {
    return erpConnector.syncPaymentStatus();
  });

  fastify.get('/erp/kpis', {
    schema: {
      description: 'Obter KPIs de integração com o ERP',
      tags: ['ERP'],
    },
  }, async () => {
    return erpConnector.getIntegrationKPIs();
  });

  fastify.get('/erp/transactions', {
    schema: {
      description: 'Listar transações recentes do ERP',
      tags: ['ERP'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['registrado', 'erro', 'reprocessando'] },
          page: { type: 'number', default: 1 },
          pageSize: { type: 'number', default: 10 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      status?: 'registrado' | 'erro' | 'reprocessando';
      page?: number;
      pageSize?: number;
    };
    return erpConnector.getRecentTransactions({
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    });
  });
};
