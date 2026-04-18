import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const dashboardRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { dashboardService } = opts.container;

  fastify.get('/dashboard/operational', {
    schema: {
      description: 'Obter KPIs operacionais',
      tags: ['Dashboard'],
    },
  }, async () => {
    return dashboardService.getOperationalKPIs();
  });

  fastify.get('/dashboard/management', {
    schema: {
      description: 'Obter KPIs gerenciais',
      tags: ['Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          fornecedor: { type: 'string' },
          centroCusto: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      fornecedor?: string;
      centroCusto?: string;
    };
    return dashboardService.getManagementKPIs({
      fornecedor: query.fornecedor,
      centroCusto: query.centroCusto,
    });
  });

  fastify.get('/dashboard/forecast/:periodo', {
    schema: {
      description: 'Obter previsão de pagamentos para um período (dias)',
      tags: ['Dashboard'],
      params: {
        type: 'object',
        required: ['periodo'],
        properties: { periodo: { type: 'number' } },
      },
    },
  }, async (request) => {
    const { periodo } = request.params as { periodo: number };
    return dashboardService.getPaymentForecast(periodo);
  });

  fastify.get('/dashboard/audit', {
    schema: {
      description: 'Consultar trilha de auditoria via dashboard',
      tags: ['Dashboard'],
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
    return dashboardService.getAuditLog({
      usuarioId: query.usuarioId,
      tipoAcao: query.tipoAcao as any,
      protocoloUnico: query.protocoloUnico,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  });

  fastify.get('/dashboard/export', {
    schema: {
      description: 'Exportar dados do dashboard em CSV ou PDF',
      tags: ['Dashboard'],
      querystring: {
        type: 'object',
        required: ['format'],
        properties: {
          format: { type: 'string', enum: ['csv', 'pdf'] },
          fornecedor: { type: 'string' },
          centroCusto: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as {
      format: 'csv' | 'pdf';
      fornecedor?: string;
      centroCusto?: string;
    };
    const buffer = await dashboardService.exportData(query.format, {
      fornecedor: query.fornecedor,
      centroCusto: query.centroCusto,
    });
    const contentType = query.format === 'csv' ? 'text/csv' : 'application/pdf';
    return reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="export.${query.format}"`)
      .send(buffer);
  });
};
