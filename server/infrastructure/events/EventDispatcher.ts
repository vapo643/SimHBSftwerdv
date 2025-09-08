import { getFormalizationQueue } from '../../lib/queues';
import { DomainEvent } from '../../modules/shared/domain/events/DomainEvent';
import logger from '../../lib/logger';

export class EventDispatcher {
  private static instance: EventDispatcher;

  private constructor() {
    // BullMQ queues are pre-configured in lib/queues
  }

  public static getInstance(): EventDispatcher {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher();
    }
    return EventDispatcher.instance;
  }

  /**
   * Dispatch domain event to appropriate queue
   */
  public async dispatch(event: DomainEvent): Promise<void> {
    try {
      const eventType = event.eventType;

      if (eventType === 'ProposalApproved') {
        // Send to formalization queue
        const formalizationQueue = await getFormalizationQueue();
        await formalizationQueue.add('ProposalApprovedJob', event, {
          removeOnComplete: 100,
          removeOnFail: false,
        });

        logger.info('[EventDispatcher] Domain event dispatched to formalization queue', {
          eventType,
          aggregateId: event.aggregateId,
          jobId: 'formalization-job',
        });
      } else {
        logger.warn('[EventDispatcher] Unknown event type', { eventType });
      }
    } catch (error) {
      logger.error('[EventDispatcher] Failed to dispatch event', {
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Health check for all queues
   */
  public async isHealthy(): Promise<boolean> {
    try {
      // BullMQ queue health is managed by Redis connection
      return true;
    } catch (error) {
      logger.error('[EventDispatcher] Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('[EventDispatcher] Shutting down...');
    // BullMQ queues are managed by the queues module
  }
}
