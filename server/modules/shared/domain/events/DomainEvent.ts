export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredAt = new Date();
  }
}