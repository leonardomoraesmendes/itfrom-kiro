import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const workflowRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { workflowService } = opts.container;

  fastify.post('/workflow/submit/:id', {
    schema: {
      description: 'Submeter documento para aprovação',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return workflowService.submitForApproval(id);
  });

  fastify.post('/workflow/approve/:id', {
    schema: {
      description: 'Aprovar documento',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['aprovadorId'],
        properties: {
          aprovadorId: { type: 'string' },
          justificativa: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { aprovadorId, justificativa } = request.body as {
      aprovadorId: string;
      justificativa?: string;
    };
    return workflowService.approve(id, aprovadorId, justificativa);
  });

  fastify.post('/workflow/reject/:id', {
    schema: {
      description: 'Rejeitar documento (justificativa obrigatória)',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['aprovadorId', 'justificativa'],
        properties: {
          aprovadorId: { type: 'string' },
          justificativa: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { aprovadorId, justificativa } = request.body as {
      aprovadorId: string;
      justificativa: string;
    };
    return workflowService.reject(id, aprovadorId, justificativa);
  });

  fastify.post('/workflow/return/:id', {
    schema: {
      description: 'Devolver documento para correção (justificativa obrigatória)',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['aprovadorId', 'justificativa'],
        properties: {
          aprovadorId: { type: 'string' },
          justificativa: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { aprovadorId, justificativa } = request.body as {
      aprovadorId: string;
      justificativa: string;
    };
    return workflowService.returnForCorrection(id, aprovadorId, justificativa);
  });

  fastify.post('/workflow/escalate/:id', {
    schema: {
      description: 'Escalar aprovação para nível hierárquico superior',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return workflowService.escalate(id);
  });

  fastify.get('/workflow/sod/:id/:userId', {
    schema: {
      description: 'Verificar conflito de Segregação de Funções',
      tags: ['Workflow'],
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string };
    return workflowService.checkSoDConflict(id, userId);
  });
};
