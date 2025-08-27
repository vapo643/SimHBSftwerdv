/**
 * Users Admin Controller - REFATORADO
 * Exemplo de controller seguindo arquitetura limpa
 * Controllers chamam Services, nunca acessam DB diretamente
 *
 * PADRÃO ARQUITETURAL: Controller → Service → Repository → Database
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../../lib/jwt-auth-middleware.js';
import { requireAdmin } from '../../lib/role-guards.js';
import { userService } from '../../services/userService-refactored.js';
import { UserDataSchema } from '../../../shared/types/user.js';

const _router = Router();

// Helper function to get client IP
function getClientIP(req: Request): string {
  const _forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded == 'string') {
    return forwarded.split(',')[0].trim(); }
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown'; }
}

/**
 * GET /api/admin/users
 * Listar todos os usuários
 *
 * PADRÃO ARQUITETURAL: Controller → Service → Repository → Database
 * ✅ Sem acesso direto ao banco de dados
 */
router.get(
  '/',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('📋 [Controller/Users] Fetching all users');

      // PADRÃO CORRETO: Controller chama Service, não acessa DB
      const _users = await userService.getAllUsers();

      // Format response using service method
      const _formattedUsers = userService.formatUsersForResponse(users);

      console.log(`✅ [Controller/Users] Retrieved ${formattedUsers.length} users`);

      res.json(formattedUsers);
    } catch (error) {
      console.error('❌ [Controller/Users] Error fetching users:', error: unknown);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Erro ao buscar usuários',
      });
    }
  }
);

/**
 * GET /api/admin/users/:id
 * Buscar usuário específico
 *
 * PADRÃO ARQUITETURAL: Validação no Controller, lógica no Service
 */
router.get(
  '/:id',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          message: 'ID do usuário é obrigatório',
        });
      }

      // PADRÃO CORRETO: Service gerencia acesso aos dados
      const _user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({
          message: 'Usuário não encontrado',
        });
      }

      const _formattedUser = userService.formatUserForResponse(user);

      res.json(formattedUser);
    } catch (error) {
      console.error(`❌ [Controller/Users] Error fetching user ${req.params.id}:`, error: unknown);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Erro ao buscar usuário',
      });
    }
  }
);

/**
 * POST /api/admin/users
 * Criar novo usuário
 *
 * PADRÃO ARQUITETURAL: Validação no Controller, criação no Service
 */
router.post(
  '/',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('📝 [Controller/Users] Creating new user');
      console.log('📝 [Controller/Users] Request by:', req.user?.email);

      // Validate input data
      const _validatedData = UserDataSchema.parse(req.body);
      const _clientIp = getClientIP(req);

      // PADRÃO CORRETO: Service gerencia toda lógica de negócio
      const _newUser = await userService.createUser(validatedData, req.user?.id, clientIp);

      const _formattedUser = userService.formatUserForResponse(newUser);

      console.log(`✅ [Controller/Users] User created: ${newUser.email}`);

      return res.status(201).json(formattedUser); }
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        const _flatErrors = error.flatten();
        console.error('❌ [Controller/Users] Validation error:', flatErrors);

        let _errorMessage = 'Dados de entrada inválidos';
        if (flatErrors.fieldErrors.password) {
          errorMessage = 'Erro de validação de senha - Verifique os requisitos de segurança';
        } else if (flatErrors.fieldErrors.role) {
          errorMessage = 'Perfil de usuário inválido';
        }

        return res.status(400).json({
          message: errorMessage,
          errors: flatErrors,
          suggestions: flatErrors.fieldErrors.password
            ? {
                password: [
                  'Use pelo menos 8 caracteres',
                  'Combine letras maiúsculas e minúsculas',
                  'Inclua números e símbolos',
                  "Evite senhas comuns como '12345678' ou 'password'",
                ],
              }
            : undefined,
        });
      }

      // Handle conflict errors
      if (error.name == 'ConflictError') {
        return res.status(409).json({ message: error.message }); }
      }

      console.error('❌ [Controller/Users] Error creating user:', error.message);
      return res.status(500).json({
        message: error.message || 'Erro ao criar usuário',
      });
    }
  }
);

/**
 * PUT /api/admin/users/:id/deactivate
 * Desativar conta de usuário
 *
 * PADRÃO ARQUITETURAL: Autenticação no Controller, lógica no Service
 * ASVS 8.3.7: Deactivate User Account and Invalidate All Sessions
 */
router.put(
  '/:id/deactivate',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const _userId = req.params.id;

      if (!userId) {
        return res.status(400).json({
          message: 'ID do usuário é obrigatório',
        });
      }

      const _clientIp = getClientIP(req);
      const _userAgent = req.headers['user-agent'];

      // PADRÃO CORRETO: Service gerencia deativação e todas as regras de negócio
      const _result = await userService.deactivateUser(
  _userId,
        req.user!.id,
        req.user!.email!,
  _clientIp,
        userAgent
      );

      console.log(`⚠️ [Controller/Users] User deactivated: ${userId}`);

      res.json({
        message: result.message,
        deactivatedUser: {
          id: result.user.id,
          name: result.user.full_name,
          role: result.user.role,
        },
      });
    } catch (error) {
      console.error('❌ [Controller/Users] Error deactivating user:', error: unknown);

      const _statusCode =
        error instanceof Error &&
        (error.message.includes('não pode desativar') ||
          error.message.includes('último administrador'))
          ? 400
          : 500;

      res.status(statusCode).json({
        message: error instanceof Error ? error.message : 'Erro ao desativar usuário',
      });
    }
  }
);

/**
 * PUT /api/admin/users/:id/reactivate
 * Reativar conta de usuário
 *
 * PADRÃO ARQUITETURAL: Permissões no Controller, lógica no Service
 */
router.put(
  '/:id/reactivate',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const _userId = req.params.id;

      if (!userId) {
        return res.status(400).json({
          message: 'ID do usuário é obrigatório',
        });
      }

      const _clientIp = getClientIP(req);
      const _userAgent = req.headers['user-agent'];

      // PADRÃO CORRETO: Service gerencia reativação
      const _result = await userService.reactivateUser(
  _userId,
        req.user!.id,
        req.user!.email!,
  _clientIp,
        userAgent
      );

      console.log(`✅ [Controller/Users] User reactivated: ${userId}`);

      res.json({
        message: result.message,
      });
    } catch (error) {
      console.error('❌ [Controller/Users] Error reactivating user:', error: unknown);

      const _statusCode =
        error instanceof Error && error.message.includes('já está ativo') ? 400 : 500;

      res.status(statusCode).json({
        message: error instanceof Error ? error.message : 'Erro ao reativar usuário',
      });
    }
  }
);

/**
 * GET /api/admin/users/role/:role
 * Buscar usuários por perfil
 *
 * PADRÃO ARQUITETURAL: Query params no Controller, busca no Service
 */
router.get(
  '/role/:role',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role } = req.params;

      if (!role) {
        return res.status(400).json({
          message: 'Perfil é obrigatório',
        });
      }

      // PADRÃO CORRETO: Service busca usuários por perfil
      const _users = await userService.getUsersByRole(role);
      const _formattedUsers = userService.formatUsersForResponse(users as unknown);

      res.json(formattedUsers);
    } catch (error) {
      console.error(
        `❌ [Controller/Users] Error fetching users by role ${req.params.role}:`,
        error
      );
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Erro ao buscar usuários por perfil',
      });
    }
  }
);

/**
 * GET /api/admin/users/loja/:lojaId
 * Buscar usuários por loja
 *
 * PADRÃO ARQUITETURAL: Parâmetros no Controller, busca no Service
 */
router.get(
  '/loja/:lojaId',
  _jwtAuthMiddleware,
  _requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const _lojaId = parseInt(req.params.lojaId);

      if (isNaN(lojaId)) {
        return res.status(400).json({
          message: 'ID da loja inválido',
        });
      }

      // PADRÃO CORRETO: Service busca usuários por loja
      const _users = await userService.getUsersByLoja(lojaId);
      const _formattedUsers = userService.formatUsersForResponse(users as unknown);

      res.json(formattedUsers);
    } catch (error) {
      console.error(
        `❌ [Controller/Users] Error fetching users by loja ${req.params.lojaId}:`,
        error
      );
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Erro ao buscar usuários por loja',
      });
    }
  }
);

export default router;

/**
 * DOCUMENTAÇÃO DO PADRÃO ARQUITETURAL
 * =========================
 *
 * ANTES (Violação):
 * Controller → Supabase Client (direto)
 * - Imports dinâmicos de "../lib/supabase.js"
 * - Queries diretas no controller
 * - Lógica de negócio misturada
 *
 * DEPOIS (Correto):
 * Controller → UserService → UserRepository → Database
 * - Sem imports de supabase
 * - Toda lógica de negócio no Service
 * - Acesso a dados encapsulado no Repository
 *
 * BENEFÍCIOS ALCANÇADOS:
 * 1. ✅ Zero acoplamento com banco de dados
 * 2. ✅ Separação clara de responsabilidades
 * 3. ✅ Testabilidade melhorada (podemos mockar o service)
 * 4. ✅ Manutenibilidade aumentada
 * 5. ✅ Conformidade com SOLID principles
 *
 * VIOLAÇÕES ELIMINADAS:
 * - Removido import de "../../lib/supabase.js"
 * - Eliminadas queries diretas a "profiles" e "auth.users"
 * - Transferida lógica de negócio para camada apropriada
 */
