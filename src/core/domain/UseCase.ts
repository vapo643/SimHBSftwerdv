/**
 * Base Use Case interface
 * Represents an application use case
 */
export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}