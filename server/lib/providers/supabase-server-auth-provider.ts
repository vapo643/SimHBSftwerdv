/**
 * Pilar 5 - Padrão Aberto - Servidor
 * Implementação específica do Supabase para autenticação no servidor
 */

import { createServerSupabaseClient } from '../../../client/src/lib/supabase';
import { ServerAuthProvider, ServerUser, TokenValidationResult } from '../auth-types';

export class SupabaseServerAuthProvider implements ServerAuthProvider {
  private supabase = createServerSupabaseClient();

  /**
   * Converte usuário do Supabase para nossa interface padronizada
   */
  private mapSupabaseUser(supabaseUser): ServerUser {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.name,
      createdAt: supabaseUser.created_at ? new Date(supabaseUser.created_at) : undefined,
    };
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const {
        data: { user },
        _error,
      } = await this._supabase.auth.getUser(token);

      if (error || !user) {
        return {
          user: {} as ServerUser,
          valid: false,
        };
      }

      return {
        user: this.mapSupabaseUser(user),
        valid: true,
      };
    }
catch (error) {
      return {
        user: {} as ServerUser,
        valid: false,
      };
    }
  }

  async getUser(userId: string): Promise<ServerUser | null> {
    try {
      // Para Supabase, precisaríamos de um token administrativo para buscar usuário por ID
      // Por agora, retornamos null pois essa operação requer privilégios admin
      return null;
    }
catch (error) {
      return null;
    }
  }
}
