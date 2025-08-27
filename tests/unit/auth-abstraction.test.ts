/**
 * Pilar 5 - Padrão Aberto - Testes
 * Testes para verificar a camada de abstração de autenticação
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, getAuthService, resetAuthService } from '../../client/src/lib/auth';
import { AuthProvider, User, Session } from '../../client/src/lib/auth-types';

// Mock do provider para testes
class MockAuthProvider implements AuthProvider {
  async signIn(credentials: any) {
    return {
      user: { id: '1', email: credentials.email } as User,
      session: {
        user: { id: '1', email: credentials.email } as User,
        accessToken: 'mock-token',
      } as Session,
    };
  }

  async signOut() {}

  async getSession() {
    return {
      user: { id: '1', email: 'test@example.com' } as User,
      accessToken: 'mock-token',
    } as Session;
  }

  async getCurrentUser() {
    return { id: '1', email: 'test@example.com' } as User;
  }

  onAuthStateChange(callback: any) {
    return { unsubscribe: () => {} };
  }

  async getAccessToken() {
    return 'mock-token';
  }
}

describe('Pilar 5 - Padrão Aberto - Auth Abstraction', () => {
  beforeEach(() => {
    resetAuthService();
  });

  it('deve criar instância do AuthService com provider customizado', () => {
    const mockProvider = new MockAuthProvider();
    const authService = new AuthService(mockProvider);
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('deve fazer login usando o provider abstraído', async () => {
    const mockProvider = new MockAuthProvider();
    const authService = new AuthService(mockProvider);

    const result = await authService.signIn({
      email: 'test@example.com',
      password: 'password',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.session.accessToken).toBe('mock-token');
  });

  it('deve obter sessão atual usando o provider abstraído', async () => {
    const mockProvider = new MockAuthProvider();
    const authService = new AuthService(mockProvider);

    const session = await authService.getSession();

    expect(session).not.toBeNull();
    expect(session?.user.email).toBe('test@example.com');
    expect(session?.accessToken).toBe('mock-token');
  });

  it('deve criar singleton do serviço de autenticação', () => {
    const service1 = getAuthService();
    const service2 = getAuthService();

    expect(service1).toBe(service2);
  });

  it('deve reiniciar o singleton corretamente', () => {
    const service1 = getAuthService();
    resetAuthService();
    const service2 = getAuthService();

    expect(service1).not.toBe(service2);
  });
});
