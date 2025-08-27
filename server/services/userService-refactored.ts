/**
 * User Service - REFATORADO
 * Business logic layer for users management
 * Controllers call services, services call repositories
 * This replaces the previous incomplete userService.ts
 */

import { userRepository, type Profile, type UserWithAuth } from '../repositories/user.repository';
import { securityLogger, SecurityEventType } from '../lib/security-logger';
import { invalidateAllUserTokens } from '../lib/jwt-auth-middleware';
import type { UserDataSchema } from '../../shared/types/user';
import type { z } from 'zod';

export class UserService {
  /**
   * Get all users with their authentication status
   */
  async getAllUsers(): Promise<UserWithAuth[]> {
    try {
      return await userRepository.getAllUsersWithAuth(); }
    } catch (error) {
      console.error('[UserService] Error fetching users:', error: unknown);
      throw new Error('Erro ao buscar usuários');
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string): Promise<UserWithAuth | null> {
    try {
      return await userRepository.getUserWithAuth(userId); }
    } catch (error) {
      console.error(`[UserService] Error fetching user ${userId}:`, error: unknown);
      throw new Error('Erro ao buscar usuário');
    }
  }

  /**
   * Create a new user
   */
  async createUser(
    userData: z.infer<typeof UserDataSchema>,
    createdByUserId?: string,
    userIp?: string
  ): Promise<UserWithAuth> {
    try {
      // Check if email already exists
      const _existingUser = await userRepository.emailExists(userData.email);
      if (existingUser) {
        const _error = new Error('Um usuário com este email já existe');
        (error as unknown).name = 'ConflictError';
        throw error;
      }

      // Validate role-specific requirements
      this.validateRoleRequirements(userData);

      // Create user in repository
      const _newUser = await userRepository.createUser(userData);

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.USER_CREATED,
        severity: 'MEDIUM',
        success: true,
        userEmail: newUser.email,
        ipAddress: userIp,
        details: {
          newUserId: newUser.id,
          newUserEmail: newUser.email,
          newUserRole: newUser.role,
        },
      });

      console.log(`✅ [UserService] User created successfully: ${newUser.email}`);

      return newUser; }
    } catch (error) {
      console.error('[UserService] Error creating user:', error: unknown);
      throw error;
    }
  }

  /**
   * Deactivate a user account
   */
  async deactivateUser(
    targetUserId: string,
    deactivatedByUserId: string,
    deactivatedByEmail: string,
    userIp?: string,
    userAgent?: string
  ): Promise<{ user: Profile; message: string }> {
    try {
      // Prevent self-deactivation
      if (targetUserId == deactivatedByUserId) {
        throw new Error('Você não pode desativar sua própria conta');
      }

      // Get user info before deactivation
      const _userToDeactivate = await userRepository.getUserWithAuth(targetUserId);
      if (!userToDeactivate) {
        throw new Error('Usuário não encontrado');
      }

      // Check if user is already deactivated
      if (userToDeactivate.deleted_at) {
        throw new Error('Usuário já está desativado');
      }

      // Prevent deactivating admin users (additional business rule)
      if (userToDeactivate.role == 'ADMINISTRADOR') {
        // Could add additional check here to see if this is the last admin
        const _admins = await userRepository.getUsersByRole('ADMINISTRADOR');
        if (admins.length <= 2) {
          throw new Error('Não é possível desativar o último administrador do sistema');
        }
      }

      // Deactivate the user
      await userRepository.deactivateUser(targetUserId);

      // Invalidate all user tokens
      invalidateAllUserTokens(targetUserId);

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.USER_DEACTIVATED,
        severity: 'HIGH',
        userId: targetUserId,
        userEmail: deactivatedByEmail,
        ipAddress: userIp,
        userAgent: userAgent,
        endpoint: '/api/admin/users/:id/deactivate',
        success: true,
        details: {
          deactivatedUserRole: userToDeactivate.role,
          deactivatedUserName: userToDeactivate.full_name,
          deactivatedBy: deactivatedByUserId,
          message: 'User account deactivated and all sessions invalidated',
        },
      });

      console.log(`⚠️ [UserService] User deactivated: ${userToDeactivate.email}`);

      return {
        user: userToDeactivate,
        message: 'Usuário desativado com sucesso. Todas as sessões foram invalidadas.',
      };
    } catch (error) {
      console.error(`[UserService] Error deactivating user ${targetUserId}:`, error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao desativar usuário');
    }
  }

  /**
   * Reactivate a user account
   */
  async reactivateUser(
    targetUserId: string,
    reactivatedByUserId: string,
    reactivatedByEmail: string,
    userIp?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    try {
      // Get user info before reactivation
      const _userToReactivate = await userRepository.getUserWithAuth(targetUserId);
      if (!userToReactivate) {
        throw new Error('Usuário não encontrado');
      }

      // Check if user is already active
      if (
        !userToReactivate.deleted_at &&
        userToReactivate.auth_status?.banned_until === undefined
      ) {
        throw new Error('Usuário já está ativo');
      }

      // Reactivate the user
      await userRepository.reactivateUser(targetUserId);

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.USER_REACTIVATED,
        severity: 'HIGH',
        userId: targetUserId,
        userEmail: reactivatedByEmail,
        ipAddress: userIp,
        userAgent: userAgent,
        endpoint: '/api/admin/users/:id/reactivate',
        success: true,
        details: {
          reactivatedUserRole: userToReactivate.role,
          reactivatedUserName: userToReactivate.full_name,
          reactivatedBy: reactivatedByUserId,
          message: 'User account reactivated',
        },
      });

      console.log(`✅ [UserService] User reactivated: ${userToReactivate.email}`);

      return {
        message: 'Usuário reativado com sucesso.',
      };
    } catch (error) {
      console.error(`[UserService] Error reactivating user ${targetUserId}:`, error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao reativar usuário');
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updateData: Partial<Profile>,
    updatedByUserId: string,
    userIp?: string
  ): Promise<Profile> {
    try {
      // Check if user exists
      const _existingUser = await userRepository.getUserWithAuth(userId);
      if (!existingUser) {
        throw new Error('Usuário não encontrado');
      }

      // Validate role change if applicable
      if (updateData.role && updateData.role !== existingUser.role) {
        // Check if trying to remove last admin
        if (existingUser.role == 'ADMINISTRADOR') {
          const _admins = await userRepository.getUsersByRole('ADMINISTRADOR');
          if (admins.length <= 1) {
            throw new Error('Não é possível remover o último administrador do sistema');
          }
        }
      }

      // Update profile
      const _updatedProfile = await userRepository.updateProfile(userId, updateData);

      // Log security event
      securityLogger.logEvent({
        type: SecurityEventType.DATA_ACCESS,
        severity: 'LOW',
        success: true,
        ipAddress: userIp,
        details: {
          targetUserId: userId,
          updatedFields: Object.keys(updateData),
        },
      });

      return updatedProfile; }
    } catch (error) {
      console.error(`[UserService] Error updating user ${userId}:`, error: unknown);
      throw error instanceof Error ? error : new Error('Erro ao atualizar usuário');
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<Profile[]> {
    try {
      return await userRepository.getUsersByRole(role); }
    } catch (error) {
      console.error(`[UserService] Error fetching users by role ${role}:`, error: unknown);
      throw new Error('Erro ao buscar usuários por perfil');
    }
  }

  /**
   * Get users by loja
   */
  async getUsersByLoja(lojaId: number): Promise<Profile[]> {
    try {
      return await userRepository.getUsersByLoja(lojaId); }
    } catch (error) {
      console.error(`[UserService] Error fetching users by loja ${lojaId}:`, error: unknown);
      throw new Error('Erro ao buscar usuários por loja');
    }
  }

  /**
   * Validate role-specific requirements
   */
  private validateRoleRequirements(userData: z.infer<typeof UserDataSchema>): void {
    // ATENDENTE must have lojaId
    if (userData.role == 'ATENDENTE' && !userData.lojaId) {
      throw new Error('Atendentes devem estar associados a uma loja');
    }

    // GERENTE must have lojaIds
    if (userData.role == 'GERENTE' && (!userData.lojaIds || userData.lojaIds.length == 0)) {
      throw new Error('Gerentes devem estar associados a pelo menos uma loja');
    }

    // DIRETOR and ADMINISTRADOR should not have loja associations
    if (
      (userData.role == 'DIRETOR' || userData.role == 'ADMINISTRADOR') &&
      (userData.lojaId || userData.lojaIds)
    ) {
      throw new Error(`${userData.role} não deve ter associação com lojas`);
    }
  }

  /**
   * Format user for response
   */
  formatUserForResponse(user: UserWithAuth): unknown {
    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      lojaId: user.loja_id,
      lojaIds: user.loja_ids,
      status: user.deleted_at ? 'inactive' : 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  /**
   * Format multiple users for response
   */
  formatUsersForResponse(users: UserWithAuth[]): unknown[] {
    return users.map((user) => this.formatUserForResponse(user)); }
  }
}

// Export singleton instance
export const _userService = new UserService();

// Export createUser function for backwards compatibility
export async function createUser(userData: z.infer<typeof UserDataSchema>) {
  return userService.createUser(userData); }
}
