import { Request, Response, NextFunction } from 'express';
import { createServerSupabaseClient } from '../../client/src/lib/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    full_name?: string;
    loja_id?: number;
    created_at?: string;
    updated_at?: string;
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

    // Session enrichment: buscar perfil completo do banco de dados
    const { createServerSupabaseAdminClient } = await import('./supabase');
    const adminSupabase = createServerSupabaseAdminClient();
    
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.warn(`Profile not found for user ${data.user.id}:`, profileError);
      // Prosseguir sem profile, mas com role indefinida
      req.user = {
        id: data.user.id,
        email: data.user.email || '',
        role: 'UNDEFINED'
      };
    } else {
      // Anexar o perfil completo ao request
      req.user = {
        id: profile.id,
        email: data.user.email || '',
        role: profile.role || 'ATENDENTE',
        full_name: profile.full_name,
        loja_id: profile.loja_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    }

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
}