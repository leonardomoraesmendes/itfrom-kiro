import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardService, type DocumentStore } from '../dashboard-service';
import { AuditService } from '../audit-service';
import type { DocumentoFiscal } from '@ap-automation/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  const now = new Date();
  return {
    protocoloUnico: `AP-${Date.now()}-000001`,
    cnpjEmitente: '12345678000199',
    cnpjDestinatario: '98765432000188',
    numeroDocumento: 'NF-001',
    dataEmissao: now,
    dataVencimento: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days ahead
    valorTotal: 100_00,
    itensLinha: [{ descricao: 'Item 1', quantidade: 1, valorUnitario: 100_00, valorTotal: 100_00 }],
    impostos: [{ tipo: 'ICMS', baseCalculo: 100_00, aliquota: 18, valor: 18_00 }],
    tipoDocumento: 'nota_fiscal',
    canalOrigem: 'upload',
    status: 'recebido',
    indiceConfiancaPorCampo: {},
    dataRecebimento: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class InMemoryDocStore implements DocumentStore {
  private docs: DocumentoFiscal[] = [];

  add(doc: DocumentoFiscal) {
    this.docs.push(doc);
  }

  getAll(): DocumentoFiscal[] {
    return this.docs;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('DashboardService', () => {
  let auditService: AuditService;
  let docStore: InMemoryDocStore;
  let dashboard: DashboardService;

  beforeEach(() => {
    auditService = new AuditService();
    docStore = new InMemoryDocStore();
    dashboard = new DashboardService(auditService, docStore);
  });

  // ── getOperationalKPIs ──────────────────────────────────────────

  describe('getOperationalKPIs', () => {
    it('returns zero counts when store is empty', async () => {
      const kpis = await dashboard.getOperationalKPIs();

      expect(kpis.volumePorEtapa.intake).toBe(0);
      expect(kpis.taxaExcecoes).toBe(0);
      expect(kpis.itensVencidosSLA).toBe(0);
      expect(kpis.alertasRisco).toHaveLength(0);
    });

    it('counts volume per stage correctly', async () => {
      docStore.add(makeDoc({ status: 'recebido' }));
      docStore.add(makeDoc({ status: 'recebido' }));
      docStore.add(makeDoc({ status: 'em_validacao' }));
      docStore.add(makeDoc({ status: 'aguardando_aprovacao' }));
      docStore.add(makeDoc({ status: 'pago' }));

      const kpis = await dashboard.getOperationalKPIs();

      expect(kpis.volumePorEtapa.intake).toBe(2);
      expect(kpis.volumePorEtapa.validacao).toBe(1);
      expect(kpis.volumePorEtapa.aprovacao).toBe(1);
      expect(kpis.volumePorEtapa.concluido).toBe(1);
    });

    it('calculates exception rate', async () => {
      docStore.add(makeDoc({ status: 'recebido' }));
      docStore.add(makeDoc({ status: 'rejeitado' }));
      docStore.add(makeDoc({ status: 'devolvido' }));
      docStore.add(makeDoc({ status: 'erro_integracao' }));

      const kpis = await dashboard.getOperationalKPIs();

      // 3 exceptions out of 4 docs = 0.75
      expect(kpis.taxaExcecoes).toBe(0.75);
    });

    it('detects SLA-expired items', async () => {
      const longAgo = new Date(Date.now() - 999 * 60 * 60 * 1000); // ~999 hours ago
      docStore.add(makeDoc({ status: 'recebido', updatedAt: longAgo }));
      docStore.add(makeDoc({ status: 'recebido' })); // recent, within SLA

      const kpis = await dashboard.getOperationalKPIs();

      expect(kpis.itensVencidosSLA).toBe(1);
    });

    it('generates risk alerts for integration errors', async () => {
      docStore.add(makeDoc({ status: 'erro_integracao', protocoloUnico: 'AP-20240101-000001' }));

      const kpis = await dashboard.getOperationalKPIs();

      const integrationAlert = kpis.alertasRisco.find((a) => a.tipo === 'erro_integracao');
      expect(integrationAlert).toBeDefined();
      expect(integrationAlert!.protocoloUnico).toBe('AP-20240101-000001');
    });
  });

  // ── getManagementKPIs ───────────────────────────────────────────

  describe('getManagementKPIs', () => {
    it('returns empty forecasts when no docs exist', async () => {
      const kpis = await dashboard.getManagementKPIs();

      expect(kpis.previsaoPagamentos30d).toHaveLength(0);
      expect(kpis.tendenciaVolume).toHaveLength(0);
      expect(kpis.taxaAutomacao).toBe(0);
      expect(kpis.duplicatasEvitadas).toBe(0);
    });

    it('calculates 30-day payment forecast grouped by supplier', async () => {
      const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({ cnpjEmitente: '11111111000100', dataVencimento: in10Days, valorTotal: 500_00, status: 'aprovado' }));
      docStore.add(makeDoc({ cnpjEmitente: '11111111000100', dataVencimento: in10Days, valorTotal: 300_00, status: 'aprovado' }));
      docStore.add(makeDoc({ cnpjEmitente: '22222222000100', dataVencimento: in10Days, valorTotal: 200_00, status: 'aprovado' }));

      const kpis = await dashboard.getManagementKPIs();

      expect(kpis.previsaoPagamentos30d).toHaveLength(2);
      const supplier1 = kpis.previsaoPagamentos30d.find((f) => f.fornecedor === '11111111000100');
      expect(supplier1!.valorPrevisto).toBe(800_00);
    });

    it('calculates automation rate based on confidence', async () => {
      // Automated: all fields >= 85
      docStore.add(makeDoc({ status: 'registrado_erp', indiceConfiancaPorCampo: { cnpj: 95, valor: 90 } }));
      // Not automated: some field < 85
      docStore.add(makeDoc({ status: 'registrado_erp', indiceConfiancaPorCampo: { cnpj: 60, valor: 90 } }));

      const kpis = await dashboard.getManagementKPIs();

      expect(kpis.taxaAutomacao).toBe(50); // 1 out of 2
    });

    it('counts duplicates avoided', async () => {
      docStore.add(makeDoc({ status: 'rejeitado' }));
      docStore.add(makeDoc({ status: 'rejeitado' }));
      docStore.add(makeDoc({ status: 'aprovado' }));

      const kpis = await dashboard.getManagementKPIs();

      expect(kpis.duplicatasEvitadas).toBe(2);
    });

    it('applies filters to management KPIs', async () => {
      const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({ cnpjEmitente: '11111111000100', dataVencimento: in10Days, valorTotal: 500_00 }));
      docStore.add(makeDoc({ cnpjEmitente: '22222222000100', dataVencimento: in10Days, valorTotal: 300_00 }));

      const kpis = await dashboard.getManagementKPIs({ fornecedor: '11111111000100' });

      // Only supplier 11111111000100 should be in trends
      expect(kpis.tendenciaVolume.reduce((sum, t) => sum + t.valor, 0)).toBe(1);
    });
  });

  // ── getPaymentForecast ──────────────────────────────────────────

  describe('getPaymentForecast', () => {
    it('returns forecasts within the given period', async () => {
      const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({ cnpjEmitente: 'AAA', dataVencimento: in5Days, valorTotal: 100_00 }));
      docStore.add(makeDoc({ cnpjEmitente: 'BBB', dataVencimento: in20Days, valorTotal: 200_00 }));

      const forecast = await dashboard.getPaymentForecast(10); // 10 days

      expect(forecast).toHaveLength(1);
      expect(forecast[0].fornecedor).toBe('AAA');
    });

    it('excludes cancelled and rejected docs', async () => {
      const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({ dataVencimento: in5Days, status: 'cancelado' }));
      docStore.add(makeDoc({ dataVencimento: in5Days, status: 'rejeitado' }));

      const forecast = await dashboard.getPaymentForecast(10);

      expect(forecast).toHaveLength(0);
    });

    it('groups by supplier and sums values', async () => {
      const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({ cnpjEmitente: 'SAME', dataVencimento: in5Days, valorTotal: 100_00 }));
      docStore.add(makeDoc({ cnpjEmitente: 'SAME', dataVencimento: in5Days, valorTotal: 250_00 }));

      const forecast = await dashboard.getPaymentForecast(10);

      expect(forecast).toHaveLength(1);
      expect(forecast[0].valorPrevisto).toBe(350_00);
    });
  });

  // ── getAuditLog ─────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('delegates to audit service query', async () => {
      await auditService.log({ usuarioId: 'user1', tipoAcao: 'aprovacao', protocoloUnico: 'AP-001' });
      await auditService.log({ usuarioId: 'user2', tipoAcao: 'rejeicao', protocoloUnico: 'AP-002' });

      const result = await dashboard.getAuditLog({ page: 1, pageSize: 10 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await auditService.log({ usuarioId: 'user1', tipoAcao: 'aprovacao' });
      }

      const page1 = await dashboard.getAuditLog({ page: 1, pageSize: 2 });
      const page2 = await dashboard.getAuditLog({ page: 2, pageSize: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
    });

    it('filters by action type', async () => {
      await auditService.log({ usuarioId: 'user1', tipoAcao: 'aprovacao' });
      await auditService.log({ usuarioId: 'user1', tipoAcao: 'rejeicao' });

      const result = await dashboard.getAuditLog({ tipoAcao: 'aprovacao', page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0].tipoAcao).toBe('aprovacao');
    });
  });

  // ── exportData ──────────────────────────────────────────────────

  describe('exportData', () => {
    it('exports CSV with correct headers and rows', async () => {
      const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      docStore.add(makeDoc({
        protocoloUnico: 'AP-20240101-000001',
        cnpjEmitente: '12345678000199',
        numeroDocumento: 'NF-100',
        dataVencimento: in10Days,
        valorTotal: 500_00,
        status: 'aprovado',
        tipoDocumento: 'nota_fiscal',
      }));

      const buffer = await dashboard.exportData('csv', { periodoInicio: new Date() });
      const csv = buffer.toString('utf-8');
      const lines = csv.split('\n');

      expect(lines[0]).toBe('protocoloUnico,cnpjEmitente,numeroDocumento,dataVencimento,valorTotal,status,tipoDocumento');
      expect(lines).toHaveLength(2); // header + 1 row
      expect(lines[1]).toContain('AP-20240101-000001');
      expect(lines[1]).toContain('50000');
    });

    it('exports empty CSV when no docs match filters', async () => {
      const buffer = await dashboard.exportData('csv', {});
      const csv = buffer.toString('utf-8');
      const lines = csv.split('\n');

      expect(lines).toHaveLength(1); // header only
    });

    it('exports PDF mock', async () => {
      docStore.add(makeDoc({ protocoloUnico: 'AP-20240101-000001' }));

      const buffer = await dashboard.exportData('pdf', {});
      const content = buffer.toString('utf-8');

      expect(content).toContain('%PDF');
      expect(content).toContain('AP-20240101-000001');
    });

    it('handles CSV values with commas by escaping', async () => {
      docStore.add(makeDoc({
        protocoloUnico: 'AP-20240101-000001',
        numeroDocumento: 'NF,with,commas',
        dataVencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      }));

      const buffer = await dashboard.exportData('csv', { periodoInicio: new Date() });
      const csv = buffer.toString('utf-8');

      expect(csv).toContain('"NF,with,commas"');
    });
  });
});
