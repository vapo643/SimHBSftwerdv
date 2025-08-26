import { Entity } from './Entity';
import { DomainEvent } from './DomainEvent';

/**
 * Base Aggregate Root class for Domain-Driven Design
 * Aggregate roots are the entry points to aggregates
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents = [];
  }
}
