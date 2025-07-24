import { Request, Response, NextFunction } from 'express';
import { createServerSupabaseClient } from '../../client/src/lib/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Extrai a role do token JWT dos claims
 */
export async function extractRoleFromToken(authToken: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser(authToken);
    
    if (error || !data.user) {
      return null;
    }

    // Extrai a role dos app_metadata
    const role = data.user.app_metadata?.role || data.user.user_metadata?.role || 'ATENDENTE';
    return role;
  } catch (error) {
    console.error('Error extracting role from token:', error);
    return null;
  }
}

/**
 * Middleware de autenticação JWT que valida o token e extrai a role
 */
export async function jwtAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Development bypass removed for security compliance

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de acesso requerido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validar o token e extrair dados do usuário
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }

    // Extrair role dos metadata
    const role = await extractRoleFromToken(token);
    if (!role) {
      return res.status(401).json({ message: 'Perfil de usuário não encontrado' });
    }

    // Adicionar dados do usuário autenticado ao request
    req.user = {
      id: data.user.id,
      email: data.user.email || '',
      role: role
    };

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
}