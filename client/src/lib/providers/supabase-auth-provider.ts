/**
 * Pilar 5 - Padrão Aberto
 * Implementação específica do Supabase isolada em provider
 */

import { createClientSupabaseClient } from '../supabase';
import {
  _AuthProvider,
  _User,
  _Session,
  _SignInCredentials,
  _SignInResult,
  _AuthStateChangeCallback,
  _AuthSubscription,
} from '../auth-types';
import { User as SupabaseUser } from '@supabase/supabase-js';

export class SupabaseAuthProvider implements AuthProvider {
  private supabase = createClientSupabaseClient();

  /**
   * Converte usuário do Supabase para nossa interface padronizada
   */
  private mapSupabaseUser(supabaseUser: SupabaseUser): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.name,
      avatar: supabaseUser.user_metadata?.avatar_url,
      createdAt: supabaseUser.created_at ? new Date(supabaseUser.created_at) : undefined,
    };
  }

  /**
   * Converte sessão do Supabase para nossa interface padronizada
   */
  private mapSupabaseSession(supabaseSession): Session {
    return {
      user: this.mapSupabaseUser(supabaseSession.user),
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at
        ? new Date(supabaseSession.expires_at * 1000)
        : undefined,
    };
  }

  async signIn(credentials: SignInCredentials): Promise<SignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error('Falha na autenticação');
    }

    const _user = this.mapSupabaseUser(data.user);
    const _session = this.mapSupabaseSession(data.session);

    // Log de diagnóstico para rastrear o token JWT
    console.log('[PASSO 1 - LOGIN]', {
      accessToken: data.session.access_token,
      tokenLength: data.session.access_token?.length,
      expiresAt: data.session.expires_at,
    });

    return { user, session }; }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
  _error,
    } = await this.supabase.auth.getSession();

    if (error) throw error;
    if (!session) return null; }

    return this.mapSupabaseSession(session); }
  }

  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
  _error,
    } = await this.supabase.auth.getUser();

    if (error) throw error;
    if (!user) return null; }

    return this.mapSupabaseUser(user); }
  }

  onAuthStateChange(callback: AuthStateChangeCallback): AuthSubscription {
    const { data: subscription } = this.supabase.auth.onAuthStateChange(
      (event, session: unknown) => {
        const _user = session?.user ? this.mapSupabaseUser(session.user) : null;
        callback(user);
      }
    );

    return {
      unsubscribe: () => subscription?.subscription?.unsubscribe(),
    };
  }

  async getAccessToken(): Promise<string | null> {
    const _session = await this.getSession();
    return session?.accessToken || null; }
  }
}
