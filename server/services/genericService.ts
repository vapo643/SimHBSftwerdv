/**
 * Generic Service
 * Base service for simple controllers
 * PAM V1.0 - Reusable service pattern
 */

import { db } from "../lib/supabase.js";
import { sql } from "drizzle-orm";

export class GenericService {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Execute a generic operation
   */
  async executeOperation(operation: string, params?: any): Promise<any> {
    try {
      console.log(`[${this.serviceName}] Executing ${operation}`, params);
      
      // Generic response based on operation type
      const response = {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        data: params,
        serviceName: this.serviceName,
      };

      return response;
    } catch (error: any) {
      console.error(`[${this.serviceName}] Operation failed:`, error);
      throw new Error(`${this.serviceName} operation failed: ${error.message}`);
    }
  }

  /**
   * Test the service connection
   */
  async testConnection(): Promise<{
    success: boolean;
    serviceName: string;
    timestamp: string;
  }> {
    try {
      await db.execute(sql`SELECT 1`);
      return {
        success: true,
        serviceName: this.serviceName,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[${this.serviceName}] Connection test failed:`, error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    return {
      serviceName: this.serviceName,
      status: "operational",
      timestamp: new Date().toISOString(),
    };
  }
}

// Pre-instantiated services for common controllers
export const ccbCalibrationService = new GenericService("CCB_CALIBRATION");
export const ccbDiagnosticsService = new GenericService("CCB_DIAGNOSTICS");
export const ccbTestService = new GenericService("CCB_TEST");
export const interExecuteService = new GenericService("INTER_EXECUTE");
export const interFixService = new GenericService("INTER_FIX");
export const securityTestService = new GenericService("SECURITY_TEST");