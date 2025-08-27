/**
 * Circuit Breaker Configuration
 * Pattern implementation to prevent cascading failures from external services
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, allows one request
 */

import CircuitBreaker from 'opossum';

/**
 * Default configuration for all circuit breakers
 * Conservative thresholds to avoid false positives
 */
const DEFAULT_BREAKER_OPTIONS: CircuitBreaker.Options = {
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'), // 10 seconds default
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50'), // 50% errors to open
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'), // 30 seconds to try again
  rollingCountTimeout: parseInt(process.env.CIRCUIT_BREAKER_ROLLING_WINDOW || '60000'), // 60 second window
  rollingCountBuckets: 10, // 10 buckets of 6 seconds each
  volumeThreshold: parseInt(process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD || '5'), // Minimum 5 requests before opening
  name: 'defaultBreaker',
};

/**
 * Inter Bank API Circuit Breaker Configuration
 * More aggressive timeout for financial operations
 */
export const INTER_BREAKER_OPTIONS: CircuitBreaker.Options = {
  ...DEFAULT_BREAKER_OPTIONS,
  timeout: parseInt(process.env.INTER_CIRCUIT_TIMEOUT || '8000'), // 8 seconds for Inter API
  name: 'interApiBreaker',
  errorThresholdPercentage: parseInt(process.env.INTER_ERROR_THRESHOLD || '40'), // More sensitive for banking
  volumeThreshold: parseInt(process.env.INTER_VOLUME_THRESHOLD || '3'), // Open after 3 failures
};

/**
 * ClickSign API Circuit Breaker Configuration
 * More lenient for document operations
 */
export const CLICKSIGN_BREAKER_OPTIONS: CircuitBreaker.Options = {
  ...DEFAULT_BREAKER_OPTIONS,
  timeout: parseInt(process.env.CLICKSIGN_CIRCUIT_TIMEOUT || '15000'), // 15 seconds for document upload
  name: 'clickSignApiBreaker',
  errorThresholdPercentage: parseInt(process.env.CLICKSIGN_ERROR_THRESHOLD || '60'), // Less sensitive
  volumeThreshold: parseInt(process.env.CLICKSIGN_VOLUME_THRESHOLD || '5'), // Standard threshold
};

/**
 * Create a circuit breaker with logging
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  asyncFunction: T,
  options: CircuitBreaker.Options
): CircuitBreaker<any[], any> {
  const breaker = new CircuitBreaker(asyncFunction, options);
  const name = options.name || 'UnnamedBreaker';

  // Event listeners for monitoring
  breaker.on('open', () => {
    console.log(`[CIRCUIT_BREAKER] 🔴 ${name} OPENED - Too many failures detected`);
    console.log(`[CIRCUIT_BREAKER] ⏰ Will attempt recovery in ${options.resetTimeout}ms`);
  });

  breaker.on('halfOpen', () => {
    console.log(`[CIRCUIT_BREAKER] 🟡 ${name} HALF-OPEN - Testing if service recovered`);
  });

  breaker.on('close', () => {
    console.log(
      `[CIRCUIT_BREAKER] 🟢 ${name} CLOSED - Service recovered, normal operation resumed`
    );
  });

  breaker.on('failure', (error) => {
    console.log(`[CIRCUIT_BREAKER] ❌ ${name} request failed:`, error.message || error);
  });

  breaker.on('success', () => {
    console.log(`[CIRCUIT_BREAKER] ✅ ${name} request succeeded`);
  });

  breaker.on('timeout', () => {
    console.log(`[CIRCUIT_BREAKER] ⏱️ ${name} request timed out after ${options.timeout}ms`);
  });

  breaker.on('reject', () => {
    console.log(`[CIRCUIT_BREAKER] 🚫 ${name} rejected request - circuit is OPEN`);
  });

  return breaker;
}

/**
 * Check if error is from circuit breaker being open
 */
export function isCircuitBreakerOpen(error: any): boolean {
  return (
    error &&
    (error.code === 'EOPENBREAKER' ||
      error.message?.includes('Breaker is open') ||
      error.message?.includes('Circuit breaker is OPEN'))
  );
}

/**
 * Format circuit breaker error for logging
 */
export function formatCircuitBreakerError(error: any, serviceName: string): string {
  if (isCircuitBreakerOpen(error)) {
    return `[CIRCUIT_BREAKER] Circuit for ${serviceName} is OPEN. Job failed immediately to protect the system.`;
  }
  return `[CIRCUIT_BREAKER] ${serviceName} error: ${error.message || error}`;
}

/**
 * Get circuit breaker stats for monitoring
 */
export function getCircuitBreakerStats(breaker: CircuitBreaker): {
  state: string;
  stats: CircuitBreaker.Stats;
  healthCheck: {
    requests: number;
    errorPercentage: number;
    isHealthy: boolean;
  };
} {
  const stats = breaker.stats;
  const totalRequests = stats.fires;
  const errorPercentage = totalRequests > 0 ? (stats.failures / totalRequests) * 100 : 0;

  return {
    state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
    stats,
    healthCheck: {
      requests: totalRequests,
      errorPercentage: Math.round(errorPercentage),
      isHealthy: !breaker.opened && errorPercentage < 50,
    },
  };
}

// Export CircuitBreaker type for TypeScript
export type { CircuitBreaker };
export default CircuitBreaker;
