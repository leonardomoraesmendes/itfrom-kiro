import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService } from '../queue-service';
import type { QueueItem, SLAConfig, ProcessStage } from '@ap-automation/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

const defaultSlaConfigs: SLAConfig[] = [
  { etapa: 'intake', tempoMaximoMinutos: 60, percentualAlerta: 0.8 },
  { etapa: 'captura', tempoMaximoMinutos: 120, percentualAlerta: 0.8 },
  { etapa: 'validacao', tempoMaximoMinutos: 240, percentualAlerta: 0.8 },
  { etapa: 'aprovacao', tempoMaximoMinutos: 1440, percentualAlerta: 0.8 },
  { etapa: 'integracao_erp', tempoMaximoMinutos: 30, percentualAlerta: 0.8 },
];

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    protocoloUnico: 'AP-20240101-000001',
    fornecedor: 'Fornecedor A',
    valor: 100000,
    dataVencimento: new Date('2025-02-01'),
    etapaAtual: 'validacao',
    tempoDecorrido: 100,
    slaStatus: 'dentro_prazo',
    responsavel: 'analista-1',
    ...overrides,
  };
}

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService(defaultSlaConfigs);
  });

  // ─── getQueue ────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('should return only items assigned to the given analyst', async () => {
      service.addItem(makeItem({ protocoloUnico: 'AP-20240101-000001', responsavel: 'analista-1' }));
      service.addItem(makeItem({ protocoloUnico: 'AP-20240101-000002', responsavel: 'analista-2' }));
      service.addItem(makeItem({ protocoloUnico: 'AP-20240101-000003', responsavel: 'analista-1' }));

      const result = await service.getQueue('analista-1');
      expect(result.items).toHaveLength(2);
      expect(result.items.every((i) => i.responsavel === 'analista-1')).toBe(true);
    });

    it('should return empty result for analyst with no items', async () => {
      service.addItem(makeItem({ responsavel: 'analista-1' }));

      const result = await service.getQueue('analista-99');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should recalculate slaStatus for each item', async () => {
      // tempoDecorrido=100, SLA validacao=240 → ratio=0.416 → dentro_prazo
      service.addItem(makeItem({ tempoDecorrido: 100, etapaAtual: 'validacao' }));

      const result = await service.getQueue('analista-1');
      expect(result.items[0].slaStatus).toBe('dentro_prazo');
    });

    it('should sort by priority: vencido first, then alerta, then dentro_prazo', async () => {
      // dentro_prazo: ratio = 50/240 = 0.208
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        tempoDecorrido: 50,
        etapaAtual: 'validacao',
      }));
      // vencido: ratio = 300/240 = 1.25
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        tempoDecorrido: 300,
        etapaAtual: 'validacao',
      }));
      // alerta: ratio = 200/240 = 0.833
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000003',
        tempoDecorrido: 200,
        etapaAtual: 'validacao',
      }));

      const result = await service.getQueue('analista-1');
      expect(result.items[0].slaStatus).toBe('vencido');
      expect(result.items[1].slaStatus).toBe('alerta');
      expect(result.items[2].slaStatus).toBe('dentro_prazo');
    });

    it('should sort by closest dataVencimento within same SLA status', async () => {
      const closerDate = new Date('2025-01-15');
      const fartherDate = new Date('2025-02-15');

      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        tempoDecorrido: 50,
        dataVencimento: fartherDate,
      }));
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        tempoDecorrido: 50,
        dataVencimento: closerDate,
      }));

      const result = await service.getQueue('analista-1');
      expect(result.items[0].dataVencimento).toEqual(closerDate);
      expect(result.items[1].dataVencimento).toEqual(fartherDate);
    });

    it('should highlight items with exceptions', async () => {
      service.addItem(makeItem({
        excecao: { tipo: 'validacao_reprovada', motivo: 'CNPJ inválido' },
      }));

      const result = await service.getQueue('analista-1');
      expect(result.items[0].excecao).toBeDefined();
      expect(result.items[0].excecao!.tipo).toBe('validacao_reprovada');
      expect(result.items[0].excecao!.motivo).toBe('CNPJ inválido');
    });

    it('should preserve exception info for devolução and erro_integracao', async () => {
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        excecao: { tipo: 'devolucao', motivo: 'Dados incorretos' },
      }));
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        excecao: { tipo: 'erro_integracao', motivo: 'ERP timeout' },
      }));

      const result = await service.getQueue('analista-1');
      const tipos = result.items.map((i) => i.excecao?.tipo);
      expect(tipos).toContain('devolucao');
      expect(tipos).toContain('erro_integracao');
    });
  });

  // ─── Filters ─────────────────────────────────────────────────────

  describe('getQueue filters', () => {
    beforeEach(() => {
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        etapaAtual: 'validacao',
        fornecedor: 'Fornecedor A',
        valor: 50000,
        dataVencimento: new Date('2025-01-15'),
        tempoDecorrido: 50,
      }));
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        etapaAtual: 'aprovacao',
        fornecedor: 'Fornecedor B',
        valor: 200000,
        dataVencimento: new Date('2025-02-20'),
        tempoDecorrido: 1300,
      }));
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000003',
        etapaAtual: 'validacao',
        fornecedor: 'Fornecedor A',
        valor: 150000,
        dataVencimento: new Date('2025-03-10'),
        tempoDecorrido: 250,
      }));
    });

    it('should filter by etapa', async () => {
      const result = await service.getQueue('analista-1', { etapa: 'validacao' });
      expect(result.items).toHaveLength(2);
      expect(result.items.every((i) => i.etapaAtual === 'validacao')).toBe(true);
    });

    it('should filter by slaStatus', async () => {
      // item3: tempoDecorrido=250, SLA validacao=240 → ratio=1.04 → vencido
      const result = await service.getQueue('analista-1', { slaStatus: 'vencido' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].protocoloUnico).toBe('AP-20240101-000003');
    });

    it('should filter by fornecedor', async () => {
      const result = await service.getQueue('analista-1', { fornecedor: 'Fornecedor B' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].fornecedor).toBe('Fornecedor B');
    });

    it('should filter by faixa de valor', async () => {
      const result = await service.getQueue('analista-1', {
        faixaValorMin: 100000,
        faixaValorMax: 200000,
      });
      expect(result.items).toHaveLength(2);
    });

    it('should filter by período de vencimento', async () => {
      const result = await service.getQueue('analista-1', {
        periodoVencimentoInicio: new Date('2025-02-01'),
        periodoVencimentoFim: new Date('2025-03-01'),
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].protocoloUnico).toBe('AP-20240101-000002');
    });

    it('should apply multiple filters simultaneously', async () => {
      const result = await service.getQueue('analista-1', {
        etapa: 'validacao',
        fornecedor: 'Fornecedor A',
        faixaValorMin: 100000,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].protocoloUnico).toBe('AP-20240101-000003');
    });
  });

  // ─── SLA Status Calculation ──────────────────────────────────────

  describe('calculateSlaStatus', () => {
    it('should return dentro_prazo when ratio < 0.8', () => {
      // 100/240 = 0.416
      expect(service.calculateSlaStatus(100, 'validacao')).toBe('dentro_prazo');
    });

    it('should return alerta when ratio >= 0.8 and <= 1.0', () => {
      // 192/240 = 0.8 exactly
      expect(service.calculateSlaStatus(192, 'validacao')).toBe('alerta');
      // 240/240 = 1.0 exactly
      expect(service.calculateSlaStatus(240, 'validacao')).toBe('alerta');
    });

    it('should return vencido when ratio > 1.0', () => {
      // 241/240 = 1.004
      expect(service.calculateSlaStatus(241, 'validacao')).toBe('vencido');
      // 480/240 = 2.0
      expect(service.calculateSlaStatus(480, 'validacao')).toBe('vencido');
    });

    it('should return dentro_prazo when no SLA config exists for the stage', () => {
      expect(service.calculateSlaStatus(9999, 'concluido')).toBe('dentro_prazo');
    });

    it('should use the correct SLA config per stage', () => {
      // intake SLA = 60 min, 48/60 = 0.8 → alerta
      expect(service.calculateSlaStatus(48, 'intake')).toBe('alerta');
      // captura SLA = 120 min, 48/120 = 0.4 → dentro_prazo
      expect(service.calculateSlaStatus(48, 'captura')).toBe('dentro_prazo');
    });
  });

  // ─── reassignItem ────────────────────────────────────────────────

  describe('reassignItem', () => {
    it('should change the responsible analyst', async () => {
      service.addItem(makeItem({ responsavel: 'analista-1' }));

      await service.reassignItem('AP-20240101-000001', 'analista-2');

      const result = await service.getQueue('analista-2');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].responsavel).toBe('analista-2');

      const oldResult = await service.getQueue('analista-1');
      expect(oldResult.items).toHaveLength(0);
    });

    it('should throw when item not found', async () => {
      await expect(
        service.reassignItem('AP-NONEXISTENT', 'analista-2'),
      ).rejects.toThrow('Item não encontrado na fila');
    });
  });

  // ─── getQueueKPIs ────────────────────────────────────────────────

  describe('getQueueKPIs', () => {
    it('should return correct KPI totals', async () => {
      // dentro_prazo: 50/240 = 0.208
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        tempoDecorrido: 50,
        etapaAtual: 'validacao',
      }));
      // alerta: 200/240 = 0.833
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        tempoDecorrido: 200,
        etapaAtual: 'validacao',
      }));
      // vencido: 300/240 = 1.25
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000003',
        tempoDecorrido: 300,
        etapaAtual: 'validacao',
      }));
      // another vencido: 500/240 = 2.08
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000004',
        tempoDecorrido: 500,
        etapaAtual: 'validacao',
      }));

      const kpis = await service.getQueueKPIs('analista-1');
      expect(kpis.totalPendente).toBe(4);
      expect(kpis.totalAlerta).toBe(1);
      expect(kpis.totalVencidos).toBe(2);
    });

    it('should return zeros for analyst with no items', async () => {
      const kpis = await service.getQueueKPIs('analista-99');
      expect(kpis.totalPendente).toBe(0);
      expect(kpis.totalAlerta).toBe(0);
      expect(kpis.totalVencidos).toBe(0);
    });

    it('should only count items for the specified analyst', async () => {
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000001',
        responsavel: 'analista-1',
        tempoDecorrido: 300,
        etapaAtual: 'validacao',
      }));
      service.addItem(makeItem({
        protocoloUnico: 'AP-20240101-000002',
        responsavel: 'analista-2',
        tempoDecorrido: 300,
        etapaAtual: 'validacao',
      }));

      const kpis = await service.getQueueKPIs('analista-1');
      expect(kpis.totalPendente).toBe(1);
      expect(kpis.totalVencidos).toBe(1);
    });
  });
});
