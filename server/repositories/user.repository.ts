/**
 * User Repository
 * Encapsulates all database operations for users
 * Following architectural boundary rules - controllers must not access DB directly
 */

import { BaseRepository } from "./base.repository";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import type { UserDataSchema } from "../../shared/types/user";
import type { z } from "zod";

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  loja_id?: number | null;
  loja_ids?: number[] | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
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
    super("profiles");
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
      .select("*")
      .is("deleted_at", null)
      .order("full_name");

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    // Join auth users with profiles
    const users = profiles.map(profile => {
      const authUser = authUsers.users.find(user => user.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || "N/A",
        auth_status: authUser ? {
          email_confirmed: !!authUser.email_confirmed_at,
          banned_until: authUser.banned_until
        } : undefined
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
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      if (profileError.code === "PGRST116") { // Not found
        return null;
      }
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // Get auth user
    const { data: authUser, error: authError } = await this.supabaseAdmin.auth.admin.getUserById(userId);

    if (authError && authError.message !== "User not found") {
      throw new Error(`Failed to fetch auth user: ${authError.message}`);
    }

    return {
      ...profile,
      email: authUser?.user?.email || "N/A",
      auth_status: authUser?.user ? {
        email_confirmed: !!authUser.user.email_confirmed_at,
        banned_until: authUser.user.banned_until
      } : undefined
    } as UserWithAuth;
  }

  /**
   * Create a new user (profile + auth)
   */
  async createUser(userData: z.infer<typeof UserDataSchema>): Promise<UserWithAuth> {
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
      throw new Error("Auth user creation failed - no user returned");
    }

    try {
      // Step 2: Create profile
      const { data: profile, error: profileError } = await this.supabaseAdmin
        .from(this.tableName)
        .insert({
          id: authData.user.id,
          full_name: userData.fullName,
          role: userData.role,
          loja_id: userData.lojaId || null,
          loja_ids: userData.lojaIds || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileError) {
        // Rollback auth user creation if profile creation fails
        await this.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      return {
        ...profile,
        email: authData.user.email!,
        auth_status: {
          email_confirmed: true,
          banned_until: undefined
        }
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
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
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
      ban_duration: "876000h", // 100 years
    });

    if (error) {
      throw new Error(`Failed to deactivate user: ${error.message}`);
    }

    // Also mark profile as deleted (soft delete)
    await this.updateProfile(userId, {
      deleted_at: new Date().toISOString()
    });
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: string): Promise<void> {
    // Remove ban
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      ban_duration: "none",
    });

    if (error) {
      throw new Error(`Failed to reactivate user: ${error.message}`);
    }

    // Remove soft delete from profile
    await this.updateProfile(userId, {
      deleted_at: null
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const { data } = await this.supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    return !!data;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<Profile[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select("*")
      .eq("role", role)
      .is("deleted_at", null)
      .order("full_name");

    if (error) {
      throw new Error(`Failed to fetch users by role: ${error.message}`);
    }

    return data as Profile[];
  }

  /**
   * Get users by loja
   */
  async getUsersByLoja(lojaId: number): Promise<Profile[]> {
    const { data, error } = await this.supabaseAdmin
      .from(this.tableName)
      .select("*")
      .or(`loja_id.eq.${lojaId},loja_ids.cs.{${lojaId}}`)
      .is("deleted_at", null)
      .order("full_name");

    if (error) {
      throw new Error(`Failed to fetch users by loja: ${error.message}`);
    }

    return data as Profile[];
  }
}

// Export singleton instance
export const userRepository = new UserRepository();