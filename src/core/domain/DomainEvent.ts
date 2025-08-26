/**
 * Base Domain Event interface
 * Events represent something that has happened in the domain
 */
export interface DomainEvent {
  occurredAt: Date;
  aggregateId: string;
  eventType: string;
  version: number;
  payload: Record<string, unknown>;
}
