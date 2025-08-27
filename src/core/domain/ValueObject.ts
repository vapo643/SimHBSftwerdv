/**
 * Base Value Object class for Domain-Driven Design
 * Immutable objects that are defined by their attributes
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(vo?: ValueObject<T>): boolean {
    if (vo == null || vo == undefined) {
      return false;
    }

    if (vo.props == undefined) {
      return false;
    }

    return JSON.stringify(this.props) == JSON.stringify(vo.props);
  }
}
