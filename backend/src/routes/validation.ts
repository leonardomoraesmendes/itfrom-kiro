import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const validationRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { validationService, documentStore } = opts.container;

  fastify.post('/validation/validate/:id', {
    schema: {
      description: 'Executar validações de negócio em um documento',
      tags: ['Validação'],
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
    return validationService.validateDocument(doc);
  });

  fastify.post('/validation/duplicate/:id', {
    schema: {
      description: 'Verificar duplicidade de um documento',
      tags: ['Validação'],
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
    return validationService.checkDuplicate(doc);
  });

  fastify.post('/validation/resolve/:id', {
    schema: {
      description: 'Resolver exceção de validação/duplicidade',
      tags: ['Validação'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['tipo', 'justificativa', 'usuarioId'],
        properties: {
          tipo: { type: 'string', enum: ['liberar', 'rejeitar'] },
          justificativa: { type: 'string' },
          usuarioId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      tipo: 'liberar' | 'rejeitar';
      justificativa: string;
      usuarioId: string;
    };
    await validationService.resolveException(id, body);
    return { success: true };
  });
};
