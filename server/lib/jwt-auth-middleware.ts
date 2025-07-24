import { Request, Response, NextFunction } from 'express';
import { createServerSupabaseClient } from '../../client/src/lib/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string | null;
    full_name?: string | null;
    loja_id?: number | null;
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

    // Session enrichment: Query profiles table for complete user data
    const { createServerSupabaseAdminClient } = await import('./supabase');
    const supabaseAdmin = createServerSupabaseAdminClient();
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, loja_id')
      .eq('id', data.user.id)
      .single();

    // Adicionar dados do usuário autenticado ao request com enriched profile data
    req.user = {
      id: data.user.id,
      email: data.user.email || '',
      role: profile?.role || null,
      full_name: profile?.full_name || null,
      loja_id: profile?.loja_id || null
    };

    next();
  } catch (error) {
    console.error('JWT Auth middleware error:', error);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
}