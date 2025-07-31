import { pgTable, text, timestamp, jsonb, uuid, integer, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './index';

// Security logs table for real-time monitoring
export const securityLogs = pgTable('security_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_type: text('event_type').notNull(), // LOGIN_SUCCESS, LOGIN_FAILED, SQL_INJECTION_ATTEMPT, etc.
  user_id: uuid('user_id').references(() => users.id),
  description: text('description').notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  severity: text('severity', { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }).notNull(),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').notNull().defaultNow()
});

// Login attempts tracking for brute force detection
export const loginAttempts = pgTable('login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  ip_address: text('ip_address').notNull(),
  success: boolean('success').notNull(),
  failure_reason: text('failure_reason'),
  created_at: timestamp('created_at').notNull().defaultNow()
});

// API rate limiting tracking
export const rateLimitTracking = pgTable('rate_limit_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(), // IP + endpoint
  endpoint: text('endpoint').notNull(),
  count: integer('count').notNull().default(1),
  window_start: timestamp('window_start').notNull().defaultNow(),
  blocked: boolean('blocked').notNull().default(false)
});

// Security scan results
export const securityScans = pgTable('security_scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  scan_type: text('scan_type').notNull(), // OWASP_ASVS, WSTG, DEPENDENCY_CHECK
  status: text('status').notNull(), // RUNNING, COMPLETED, FAILED
  vulnerabilities_found: integer('vulnerabilities_found').default(0),
  critical_count: integer('critical_count').default(0),
  high_count: integer('high_count').default(0),
  medium_count: integer('medium_count').default(0),
  low_count: integer('low_count').default(0),
  report: jsonb('report'),
  started_at: timestamp('started_at').notNull().defaultNow(),
  completed_at: timestamp('completed_at')
});

// Schema exports
export const insertSecurityLogSchema = createInsertSchema(securityLogs);
export const insertLoginAttemptSchema = createInsertSchema(loginAttempts);
export const insertRateLimitSchema = createInsertSchema(rateLimitTracking);
export const insertSecurityScanSchema = createInsertSchema(securityScans);

// Type exports
export type SecurityLog = typeof securityLogs.$inferSelect;
export type InsertSecurityLog = z.infer<typeof insertSecurityLogSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type RateLimitEntry = typeof rateLimitTracking.$inferSelect;
export type SecurityScan = typeof securityScans.$inferSelect;