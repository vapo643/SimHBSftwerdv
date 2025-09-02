/**
 * User Repository
 * Encapsulates all database operations for users
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from './base.repository';
import { createServerSupabaseAdminClient } from '../lib/supabase';
import type { UserDataSchema } from '../../shared/types/user';
import type { z } from 'zod';

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  loja_id?: number | null;
  // REMOVED: loja_ids - using gerente_lojas junction table for GERENTE role
  // REMOVED: created_at and updated_at - don't exist in real table
}

export interface AuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  created_at?: string;
  updated_at?: string;
  banned_until?: string;
}

export interface UserWithAuth extends Profile {
  email: string;
  auth_status?: {
    email_confirmed: boolean;
    banned_until?: string;
  };
}

export class UserRepository extends BaseRepository<Profile> {
  private supabaseAdmin;

  constructor() {
    super('profiles');
    this.supabaseAdmin = createServerSupabaseAdminClient();
  }

  /**
   * Force refresh Supabase client to clear schema cache
   */
  private refreshSupabaseClient() {
    this.supabaseAdmin = createServerSupabaseAdminClient();
  }

  /**
   * Get all users with their auth status
   */
  async getAllUsersWithAuth(): Promise<UserWithAuth[]> {
    // Get all auth users first
    const { data: authUsers, error: authError } = await this.supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .order('full_name');

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    // Join auth users with profiles
    const users = profiles.map((profile) => {
      const authUser = authUsers.users.find((user) => user.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || 'N/A',
        auth_status: authUser
          ? {
              email_confirmed: !!authUser.email_confirmed_at,
              banned_until: (authUser as any).banned_until || null,
            }
          : undefined,
      };
    });

    return users as UserWithAuth[];
  }

  /**
   * Get a single user with auth status
   */
  async getUserWithAuth(userId: string): Promise<UserWithAuth | null> {
    // Get profile
    const { data: profile, error: profileError } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // Get auth user
    const { data: authUser, error: authError } =
      await this.supabaseAdmin.auth.admin.getUserById(userId);

    if (authError && authError.message !== 'User not found') {
      throw new Error(`Failed to fetch auth user: ${authError.message}`);
    }

    return {
      ...profile,
      email: authUser?.user?.email || 'N/A',
      auth_status: authUser?.user
        ? {
            email_confirmed: !!authUser.user.email_confirmed_at,
            banned_until: (authUser.user as any).banned_until || null,
          }
        : undefined,
    } as UserWithAuth;
  }

  /**
   * Create associations in gerente_lojas junction table
   */
  async createGerenteLojaAssociations(gerenteId: string, lojaIds: number[]): Promise<void> {
    if (!lojaIds || lojaIds.length === 0) {
      return;
    }

    const associations = lojaIds.map(lojaId => ({
      gerente_id: gerenteId,
      loja_id: lojaId,
    }));

    const { error } = await this.supabaseAdmin
      .from('gerente_lojas')
      .insert(associations);

    if (error) {
      throw new Error(`Failed to create gerente-loja associations: ${error.message}`);
    }
  }

  /**
   * Create a new user (profile + auth)
   */
  async createUser(userData: z.infer<typeof UserDataSchema>): Promise<UserWithAuth> {
    // CACHE FIX: Force refresh Supabase client to clear schema cache
    this.refreshSupabaseClient();
    
    // Step 1: Create auth user
    const { data: authData, error: authError } = await this.supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Auth user creation failed - no user returned');
    }

    try {
      // Step 2: Create profile (ALIGNED WITH REAL SCHEMA)
      const { data: profile, error: profileError } = await this.supabaseAdmin
        .from(this.tableName)
        .insert({
          id: authData.user.id,
          full_name: userData.fullName,
          role: userData.role,
          loja_id: userData.lojaId || null,
          // REMOVED: loja_ids - doesn't exist in schema, using gerente_lojas junction table
          // REMOVED: created_at - doesn't exist in real table
        })
        .select()
        .single();

      if (profileError) {
        // Rollback auth user creation if profile creation fails
        await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // Step 3: Create gerente-loja associations if user is GERENTE
      if (userData.role === 'GERENTE' && userData.lojaIds && userData.lojaIds.length > 0) {
        try {
          await this.createGerenteLojaAssociations(authData.user.id, userData.lojaIds);
        } catch (associationError) {
          // Rollback profile and auth user if association creation fails
          await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw associationError;
        }
      }

      return {
        ...profile,
        email: authData.user.email!,
        auth_status: {
          email_confirmed: true,
          banned_until: undefined,
        },
      } as UserWithAuth;
    } catch (error) {
      // Rollback auth user if profile creation failed
      await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<Profile>): Promise<Profile> {
    const { data: updated, error } = await this.supabaseAdmin
      .from(this.tableName)
      .update({
        ...data,
        // REMOVED: updated_at - doesn't exist in real table
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return updated as Profile;
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    // Ban user for effectively permanent duration
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: false,
      ban_duration: '876000h', // 100 years
    });

    if (error) {
      throw new Error(`Failed to deactivate user: ${error.message}`);
    }

    // Profile deactivated via auth ban
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: string): Promise<void> {
    // Remove ban
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      ban_duration: 'none',
    });

    if (error) {
      throw new Error(`Failed to reactivate user: ${error.message}`);
    }

    // Profile reactivated via auth unban
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const { data } = await this.supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    return !!data;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<Profile[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('role', role)

      .order('full_name');

    if (error) {
      throw new Error(`Failed to fetch users by role: ${error.message}`);
    }

    return data as Profile[];
  }

  /**
   * Get users by loja (supports both ATENDENTE and GERENTE)
   */
  async getUsersByLoja(lojaId: number): Promise<Profile[]> {
    // Get ATENDENTEs directly via loja_id
    const { data: atendentes, error: atendentesError } = await this.supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq('loja_id', lojaId)
      .order('full_name');

    if (atendentesError) {
      throw new Error(`Failed to fetch atendentes by loja: ${atendentesError.message}`);
    }

    // Get GERENTEs via gerente_lojas junction table
    const { data: gerentesData, error: gerentesError } = await this.supabaseAdmin
      .from('gerente_lojas')
      .select(`
        gerente_id,
        profiles!inner(
          id, full_name, role, loja_id
        )
      `)
      .eq('loja_id', lojaId);

    if (gerentesError) {
      throw new Error(`Failed to fetch gerentes by loja: ${gerentesError.message}`);
    }

    // Transform gerentes data to Profile format
    const gerentes = gerentesData?.map((item: any) => item.profiles) || [];

    // Combine both arrays and remove duplicates
    const allUsers = [...(atendentes || []), ...gerentes];
    const uniqueUsers = allUsers.filter((user, index, arr) => 
      arr.findIndex(u => u.id === user.id) === index
    );

    return uniqueUsers as Profile[];
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
