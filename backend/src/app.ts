import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { createContainer } from './container';
import { documentsRoutes } from './routes/documents';
import { ocrRoutes } from './routes/ocr';
import { validationRoutes } from './routes/validation';
import { workflowRoutes } from './routes/workflow';
import { queueRoutes } from './routes/queue';
import { erpRoutes } from './routes/erp';
import { dashboardRoutes } from './routes/dashboard';
import { auditRoutes } from './routes/audit';

export async function buildApp() {
  const app = Fastify({ logger: true });

  // CORS
  await app.register(cors, { origin: true });

  // OpenAPI / Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AP Automation API',
        description: 'API REST para o sistema de Automação de Contas a Pagar',
        version: '1.0.0',
      },
      tags: [
        { name: 'Documentos', description: 'Recebimento e consulta de documentos fiscais' },
        { name: 'OCR', description: 'Extração inteligente de dados via OCR/IDP' },
        { name: 'Validação', description: 'Validações de negócio e anti-duplicidade' },
        { name: 'Workflow', description: 'Workflow de aprovação com alçadas' },
        { name: 'Fila Operacional', description: 'Fila operacional com SLA' },
        { name: 'ERP', description: 'Integração com ERP corporativo' },
        { name: 'Dashboard', description: 'KPIs operacionais e gerenciais' },
        { name: 'Auditoria', description: 'Trilha de auditoria imutável' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Service container
  const container = createContainer();

  // Register route modules
  await app.register(documentsRoutes, { prefix: '/api', container });
  await app.register(ocrRoutes, { prefix: '/api', container });
  await app.register(validationRoutes, { prefix: '/api', container });
  await app.register(workflowRoutes, { prefix: '/api', container });
  await app.register(queueRoutes, { prefix: '/api', container });
  await app.register(erpRoutes, { prefix: '/api', container });
  await app.register(dashboardRoutes, { prefix: '/api', container });
  await app.register(auditRoutes, { prefix: '/api', container });

  // Health check
  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));

  return app;
}
