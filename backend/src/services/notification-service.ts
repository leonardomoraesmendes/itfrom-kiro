/**
 * Notification Service — in-memory implementation.
 *
 * Stores notifications per user and provides retrieval.
 * Integration points:
 *  - WorkflowService.checkAndNotifySlaExceeded() calls notify() for approval SLA breaches
 *  - QueueService SLA checks call notify() for analyst SLA breaches
 */

export type NotificationType =
  | 'sla_excedido'
  | 'escalacao'
  | 'devolucao'
  | 'erro_integracao';

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  createdAt: Date;
  read: boolean;
}

export interface INotificationService {
  notify(userId: string, message: string, type: NotificationType): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
}

export class NotificationService implements INotificationService {
  private readonly store: Notification[] = [];
  private counter = 0;

  async notify(
    userId: string,
    message: string,
    type: NotificationType,
  ): Promise<Notification> {
    this.counter++;
    const notification: Notification = {
      id: `NOTIF-${String(this.counter).padStart(6, '0')}`,
      userId,
      message,
      type,
      createdAt: new Date(),
      read: false,
    };
    this.store.push(notification);
    return notification;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.store.filter((n) => n.userId === userId);
  }
}
