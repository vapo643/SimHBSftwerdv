import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createServerSupabaseAdminClient } from './supabase';

// Extended Request interface with user data
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    lojaId?: number;
    parceiroId?: number;
  };
}

// JWT middleware to validate and enrich user session
export async function jwtAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
      sub: string;
      email: string;
    };

    // Fetch user profile from database to get role and additional info
    const supabase = createServerSupabaseAdminClient();
    const { data: userProfile, error } = await supabase
      .from('profiles')
      .select('id, role, loja_id')
      .eq('id', decoded.sub)
      .single();

    if (error || !userProfile) {
      return res.status(401).json({ message: 'Perfil de usuário não encontrado' });
    }

    // Enrich request with user data
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: userProfile.role || undefined,
      lojaId: userProfile.loja_id || undefined
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
    
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Role-based access control guards
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMINISTRADOR') {
    return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
  }
  next();
}

export function requireManagerOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !['ADMINISTRADOR', 'GERENTE'].includes(req.user.role || '')) {
    return res.status(403).json({ message: 'Acesso negado. Requer privilégios de gerente ou administrador.' });
  }
  next();
}