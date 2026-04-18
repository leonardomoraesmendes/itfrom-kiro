import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('API Gateway', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to health check', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('should serve OpenAPI JSON spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('AP Automation API');
    expect(spec.info.version).toBe('1.0.0');
  });

  it('should include all expected tags in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = res.json();
    const tagNames = spec.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain('Documentos');
    expect(tagNames).toContain('OCR');
    expect(tagNames).toContain('Validação');
    expect(tagNames).toContain('Workflow');
    expect(tagNames).toContain('Fila Operacional');
    expect(tagNames).toContain('ERP');
    expect(tagNames).toContain('Dashboard');
    expect(tagNames).toContain('Auditoria');
  });

  it('should register all expected API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = res.json();
    const paths = Object.keys(spec.paths);

    // Documents
    expect(paths).toContain('/api/documents');
    expect(paths).toContain('/api/documents/batch');
    expect(paths).toContain('/api/documents/{id}');

    // OCR
    expect(paths).toContain('/api/ocr/extract/{id}');
    expect(paths).toContain('/api/ocr/status/{id}');

    // Validation
    expect(paths).toContain('/api/validation/validate/{id}');
    expect(paths).toContain('/api/validation/duplicate/{id}');
    expect(paths).toContain('/api/validation/resolve/{id}');

    // Workflow
    expect(paths).toContain('/api/workflow/submit/{id}');
    expect(paths).toContain('/api/workflow/approve/{id}');
    expect(paths).toContain('/api/workflow/reject/{id}');
    expect(paths).toContain('/api/workflow/return/{id}');
    expect(paths).toContain('/api/workflow/escalate/{id}');
    expect(paths).toContain('/api/workflow/sod/{id}/{userId}');

    // Queue
    expect(paths).toContain('/api/queue/{analistaId}');
    expect(paths).toContain('/api/queue/reassign/{id}');
    expect(paths).toContain('/api/queue/kpis/{analistaId}');

    // ERP
    expect(paths).toContain('/api/erp/register/{id}');
    expect(paths).toContain('/api/erp/reprocess/{id}');
    expect(paths).toContain('/api/erp/sync');
    expect(paths).toContain('/api/erp/kpis');
    expect(paths).toContain('/api/erp/transactions');

    // Dashboard
    expect(paths).toContain('/api/dashboard/operational');
    expect(paths).toContain('/api/dashboard/management');
    expect(paths).toContain('/api/dashboard/forecast/{periodo}');
    expect(paths).toContain('/api/dashboard/audit');
    expect(paths).toContain('/api/dashboard/export');

    // Audit
    expect(paths).toContain('/api/audit');
  });

  // ── Smoke tests for key endpoints ──────────────────────────────

  it('POST /api/documents should receive a document', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/documents',
      payload: {
        fileName: 'nota.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        channel: 'upload',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.protocoloUnico).toMatch(/^AP-\d{8}-\d{6}$/);
    expect(body.status).toBe('recebido');
  });

  it('GET /api/documents should list documents', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/documents?page=1&pageSize=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
  });

  it('GET /api/dashboard/operational should return KPIs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/operational' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('volumePorEtapa');
    expect(body).toHaveProperty('taxaExcecoes');
  });

  it('GET /api/audit should return paginated audit entries', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/audit?page=1&pageSize=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
  });

  it('GET /api/erp/kpis should return integration KPIs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/erp/kpis' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('totalRegistrados');
    expect(body).toHaveProperty('taxaSucesso');
  });

  it('POST /api/ocr/extract/:id should trigger extraction', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/ocr/extract/test-doc' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.protocoloUnico).toBe('test-doc');
    expect(body.campos).toBeInstanceOf(Array);
  });

  it('GET /api/ocr/status/:id should return extraction status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ocr/status/test-doc' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('completed');
  });
});
