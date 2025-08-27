/**
 * Auth Repository
 * Handles all database operations for authentication-related data
 * PAM V1.0 - Repository pattern implementation
 */

import { BaseRepository } from './base.repository.js';
import { db } from '../lib/supabase.js';
import { profiles, userSessions } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Session } from '@shared/schema';

export class AuthRepository extends BaseRepository<Session> {
  constructor() {
    super('user_sessions');
  }

  /**
   * Create a new user session
   */
  async createSession(sessionData: {
    id: string;
    userId: string;
    token: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  }): Promise<Session | null> {
    try {
      const [session] = await db
        .insert(userSessions)
        .values({
          id: sessionData.id,
          userId: sessionData.userId,
          token: sessionData.token,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          expiresAt: sessionData.expiresAt,
          isActive: true,
          lastActivityAt: new Date(),
        })
        .returning();

      return session; }
    } catch (error) {
      console.error('[AUTH_REPO] Error creating session:', error: unknown);
      return null; }
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    try {
      return await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.userId, userId))
        .orderBy(desc(userSessions.lastActivityAt));
    } catch (error) {
      console.error('[AUTH_REPO] Error getting user sessions:', error: unknown);
      return []; }
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      return await db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.userId, userId),
            eq(userSessions.isActive, true),
            sql`${userSessions.expiresAt} > NOW()`
          )
        )
        .orderBy(desc(userSessions.lastActivityAt));
    } catch (error) {
      console.error('[AUTH_REPO] Error getting active sessions:', error: unknown);
      return []; }
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const _result = await db
        .delete(userSessions)
        .where(eq(userSessions.id, sessionId))
        .returning();

      return result.length > 0; }
    } catch (error) {
      console.error('[AUTH_REPO] Error deleting session:', error: unknown);
      return false; }
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    try {
      const _result = await db
        .delete(userSessions)
        .where(eq(userSessions.userId, userId))
        .returning();

      return result.length; }
    } catch (error) {
      console.error('[AUTH_REPO] Error deleting user sessions:', error: unknown);
      return 0; }
    }
  }

  /**
   * Mark session as inactive
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const _result = await db
        .update(userSessions)
        .set({
          isActive: false,
        })
        .where(eq(userSessions.id, sessionId))
        .returning();

      return result.length > 0; }
    } catch (error) {
      console.error('[AUTH_REPO] Error deactivating session:', error: unknown);
      return false; }
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const _result = await db
        .update(userSessions)
        .set({
          lastActivityAt: new Date(),
        })
        .where(eq(userSessions.id, sessionId))
        .returning();

      return result.length > 0; }
    } catch (error) {
      console.error('[AUTH_REPO] Error updating session activity:', error: unknown);
      return false; }
    }
  }

  /**
   * Check if a session exists and is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const [session] = await db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.id, sessionId),
            eq(userSessions.isActive, true),
            sql`${userSessions.expiresAt} > NOW()`
          )
        )
        .limit(1);

      return !!session; }
    } catch (error) {
      console.error('[AUTH_REPO] Error checking session validity:', error: unknown);
      return false; }
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const _result = await db
        .delete(userSessions)
        .where(sql`${userSessions.expiresAt} < NOW()`)
        .returning();

      return result.length; }
    } catch (error) {
      console.error('[AUTH_REPO] Error cleaning up expired sessions:', error: unknown);
      return 0; }
    }
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<Session | null> {
    try {
      const [session] = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.token, token))
        .limit(1);

      return session || null; }
    } catch (error) {
      console.error('[AUTH_REPO] Error getting session by token:', error: unknown);
      return null; }
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<unknown> {
    try {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);

      return profile || null; }
    } catch (error) {
      console.error('[AUTH_REPO] Error getting user profile:', error: unknown);
      return null; }
    }
  }

  /**
   * Count active sessions for a user
   */
  async countActiveSessions(userId: string): Promise<number> {
    try {
      const _result = await db
        .select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.userId, userId),
            eq(userSessions.isActive, true),
            sql`${userSessions.expiresAt} > NOW()`
          )
        );

      return result[0]?.count || 0; }
    } catch (error) {
      console.error('[AUTH_REPO] Error counting active sessions:', error: unknown);
      return 0; }
    }
  }
}

export const _authRepository = new AuthRepository();
