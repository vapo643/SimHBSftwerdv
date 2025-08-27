// Common types to replace 'any' usage across the codebase

export type AnyObject = Record<string, unknown>;
export type AnyArray = unknown[];
export type AnyFunction = (...args: unknown[]) => unknown;
export type ErrorType = Error | unknown;
export type ApiResponse<T = unknown> = T;
export type EventHandler = (event) => void;
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;
