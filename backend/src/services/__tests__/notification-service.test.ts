import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotificationService,
  type INotificationService,
  type NotificationType,
} from '../notification-service';

describe('NotificationService', () => {
  let service: INotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  describe('notify()', () => {
    it('should create a notification with correct fields', async () => {
      const n = await service.notify('user-1', 'SLA excedido para AP-20240101-000001', 'sla_excedido');

      expect(n.id).toMatch(/^NOTIF-\d{6}$/);
      expect(n.userId).toBe('user-1');
      expect(n.message).toBe('SLA excedido para AP-20240101-000001');
      expect(n.type).toBe('sla_excedido');
      expect(n.read).toBe(false);
      expect(n.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for each notification', async () => {
      const n1 = await service.notify('user-1', 'msg1', 'sla_excedido');
      const n2 = await service.notify('user-1', 'msg2', 'escalacao');

      expect(n1.id).not.toBe(n2.id);
    });

    it('should support all notification types', async () => {
      const types: NotificationType[] = ['sla_excedido', 'escalacao', 'devolucao', 'erro_integracao'];

      for (const type of types) {
        const n = await service.notify('user-1', `test ${type}`, type);
        expect(n.type).toBe(type);
      }
    });
  });

  describe('getNotifications()', () => {
    it('should return empty array for user with no notifications', async () => {
      const result = await service.getNotifications('unknown-user');
      expect(result).toEqual([]);
    });

    it('should return only notifications for the specified user', async () => {
      await service.notify('user-1', 'msg for user-1', 'sla_excedido');
      await service.notify('user-2', 'msg for user-2', 'escalacao');
      await service.notify('user-1', 'another for user-1', 'devolucao');

      const user1Notifs = await service.getNotifications('user-1');
      const user2Notifs = await service.getNotifications('user-2');

      expect(user1Notifs).toHaveLength(2);
      expect(user2Notifs).toHaveLength(1);
      expect(user1Notifs.every((n) => n.userId === 'user-1')).toBe(true);
      expect(user2Notifs[0].userId).toBe('user-2');
    });

    it('should return notifications in insertion order', async () => {
      await service.notify('user-1', 'first', 'sla_excedido');
      await service.notify('user-1', 'second', 'escalacao');
      await service.notify('user-1', 'third', 'erro_integracao');

      const notifs = await service.getNotifications('user-1');

      expect(notifs[0].message).toBe('first');
      expect(notifs[1].message).toBe('second');
      expect(notifs[2].message).toBe('third');
    });
  });

  describe('SLA notification scenarios (Req 4.8, 5.4)', () => {
    it('should notify analyst when SLA is exceeded', async () => {
      const n = await service.notify(
        'analista-1',
        'SLA excedido: documento AP-20240101-000001 na etapa validacao',
        'sla_excedido',
      );

      expect(n.type).toBe('sla_excedido');
      expect(n.userId).toBe('analista-1');
    });

    it('should notify approver and manager on approval SLA escalation', async () => {
      const nAprovador = await service.notify(
        'aprovador-1',
        'Aprovação pendente excedeu SLA: AP-20240101-000001',
        'escalacao',
      );
      const nGestor = await service.notify(
        'gestor-1',
        'Escalação: aprovação pendente excedeu SLA para AP-20240101-000001',
        'escalacao',
      );

      expect(nAprovador.type).toBe('escalacao');
      expect(nGestor.type).toBe('escalacao');

      const aprovadorNotifs = await service.getNotifications('aprovador-1');
      const gestorNotifs = await service.getNotifications('gestor-1');

      expect(aprovadorNotifs).toHaveLength(1);
      expect(gestorNotifs).toHaveLength(1);
    });
  });
});
