import { Queue } from 'bullmq';
import { DomainEvent } from '../../modules/shared/domain/events/DomainEvent';
import logger from '../../lib/logger';
import { getRedisConnectionConfig } from '../../lib/redis-config';
import { dlqManager } from '../../lib/dead-letter-queue';

export class EventDispatcher {
  private static instance: EventDispatcher;
  private queues: Map<string, Queue> = new Map();
  private redisConnection: any;

  private constructor() {
    // Use centralized Redis configuration
    this.redisConnection = getRedisConnectionConfig();
  }

  public static getInstance(): EventDispatcher {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher();
    }
    return EventDispatcher.instance;
  }

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });
      
      // Note: DLQ handlers are set up on Workers, not Queues
      // Workers will register their own DLQ handlers
      
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

      logger.info('Event dispatched', {
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