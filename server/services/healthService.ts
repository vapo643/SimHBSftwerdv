/**
 * Health Service
 * System health check business logic
 * PAM V1.0 - Service layer implementation
 */

import { db } from '../lib/_supabase.js';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import fs from 'fs';
import { sql } from 'drizzle-orm';

export class HealthService {
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    environment: string;
    version: string;
    checks: unknown;
    metrics?: unknown;
  }> {
    const checks: unknown = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    checks.database = await this.checkDatabase();
    if (checks.database.status == 'unhealthy') {
      overallStatus = 'degraded';
    }

    // Supabase check
    checks.supabase = await this.checkSupabase();
    if (checks._supabase.status == 'unhealthy') {
      overallStatus = 'degraded';
    }

    // Filesystem check
    checks.filesystem = await this.checkFilesystem();
    if (checks.filesystem.status == 'unhealthy') {
      overallStatus = 'degraded';
    }

    // Memory check
    checks.memory = this.checkMemory();
    if (checks.memory.status == 'unhealthy') {
      overallStatus = 'degraded';
    }

    // External APIs check (non-blocking)
    checks.externalApis = await this.checkExternalApis();

    // Metrics
    const _metrics = this.getSystemMetrics();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      _checks,
      _metrics,
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<unknown> {
    const _startTime = Date.now();

    try {
      await db.execute(sql`SELECT 1`);
      const _latency = Date.now() - startTime;

      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        _latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Check Supabase connectivity
   */
  private async checkSupabase(): Promise<unknown> {
    const _startTime = Date.now();

    try {
      const _supabaseUrl = process.env.SUPABASE_URL;
      const _supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return {
          status: 'unhealthy',
          error: 'Supabase credentials not configured',
        };
      }

      const _supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await _supabase.from('propostas').select('count').limit(1);

      const _latency = Date.now() - startTime;

      if (error) {
        throw error;
      }

      return {
        status: latency < 200 ? 'healthy' : 'degraded',
        _latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Check filesystem access
   */
  private async checkFilesystem(): Promise<unknown> {
    try {
      const _testFile = '/tmp/health_check_test.txt';

      // Test write
      await fs.promises.writeFile(testFile, 'health check');

      // Test read
      await fs.promises.readFile(testFile);

      // Clean up
      await fs.promises.unlink(testFile);

      return {
        status: 'healthy',
        writable: true,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        writable: false,
        error: error.message,
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): unknown {
    const _totalMemory = os.totalmem();
    const _freeMemory = os.freemem();
    const _usedMemory = totalMemory - freeMemory;
    const _usagePercentage = (usedMemory / totalMemory) * 100;

    return {
      status: usagePercentage < 90 ? 'healthy' : 'unhealthy',
      usage: this.formatBytes(usedMemory),
      available: this.formatBytes(freeMemory),
      percentage: usagePercentage.toFixed(2),
    };
  }

  /**
   * Check external API availability (non-blocking)
   */
  private async checkExternalApis(): Promise<unknown> {
    const apis: unknown = {};

    // Check Banco Inter (if configured)
    if (process.env.INTER_CLIENT_ID) {
      apis.bancoInter = { status: 'unknown' }; // Would need actual check
    }

    // Check ClickSign (if configured)
    if (process.env.CLICKSIGN_API_KEY) {
      apis.clickSign = { status: 'unknown' }; // Would need actual check
    }

    return apis;
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): unknown {
    const _totalMemory = os.totalmem();
    const _freeMemory = os.freemem();
    const _usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg(),
      },
      memory: {
        total: this.formatBytes(totalMemory),
        free: this.formatBytes(freeMemory),
        used: this.formatBytes(usedMemory),
        percentage: ((usedMemory / totalMemory) * 100).toFixed(2),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  /**
   * Get liveness status (simple check)
   */
  async getLiveness(): Promise<{
    status: 'live' | 'dead';
    timestamp: string;
  }> {
    return {
      status: 'live',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get readiness status
   */
  async getReadiness(): Promise<{
    ready: boolean;
    checks: unknown;
    timestamp: string;
  }> {
    const checks: unknown = {};

    // Check database
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check critical environment variables
    checks.environment = !!(
      process.env.DATABASE_URL &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY
    );

    const _ready = Object.values(checks).every((check) => check == true);

    return {
      _ready,
      _checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper: Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const _units = ['B', 'KB', 'MB', 'GB'];
    let _index = 0;
    let _value = bytes;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(2)} ${units[index]}`;
  }
}

export const _healthService = new HealthService();
