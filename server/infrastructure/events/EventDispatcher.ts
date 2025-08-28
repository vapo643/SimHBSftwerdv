import { createQueue, SupabaseQueue } from '../../lib/supabase-queues';
import { DomainEvent } from '../../modules/shared/domain/events/DomainEvent';
import logger from '../../lib/logger';

export class EventDispatcher {
  private static instance: EventDispatcher;
  private queues: Map<string, SupabaseQueue> = new Map();

  private constructor() {
    // No Redis configuration needed - using Supabase PostgreSQL queues
  }

  public static getInstance(): EventDispatcher {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher();
    }
    return EventDispatcher.instance;
  }

  private getQueue(queueName: string): SupabaseQueue {
    if (!this.queues.has(queueName)) {
      const queue = createQueue(queueName, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs for audit
          removeOnFail: false,   // Keep failed jobs for investigation
        },
      });
      
      // Note: DLQ functionality is built-in to Supabase Queue system
      
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }

  public async dispatch(event: DomainEvent): Promise<void> {
    try {
      const queueName = this.getQueueNameForEvent(event.eventType);
      const queue = this.getQueue(queueName);

      await queue.add(event.eventType, {
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt: event.occurredAt,
      });

      logger.info('Event dispatched to Supabase Queue', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        queue: queueName,
      });
    } catch (error) {
      logger.error('Failed to dispatch event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private getQueueNameForEvent(eventType: string): string {
    // Mapear eventos para filas específicas
    const eventQueueMap: Record<string, string> = {
      'ProposalApproved': 'formalization-queue',
      'ProposalCreated': 'proposal-queue',
      'PaymentAuthorized': 'payment-queue',
    };

    return eventQueueMap[eventType] || 'default-queue';
  }

  public async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}