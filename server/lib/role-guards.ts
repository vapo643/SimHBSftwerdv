import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './jwt-auth-middleware';

/**
 * Guard que requer permissões de ADMIN
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: 'Usuário não autenticado' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ 
      message: 'Acesso negado. Permissões de administrador requeridas.',
      requiredRole: 'ADMIN',
      userRole: req.user.role
    });
    return;
  }

  next();
}

/**
 * Guard que requer permissões de GERENTE ou ADMIN
 */
export function requireManagerOrAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: 'Usuário não autenticado' });
    return;
  }

  const allowedRoles = ['GERENTE', 'ADMIN'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ 
      message: 'Acesso negado. Permissões de gerente ou administrador requeridas.',
      requiredRoles: allowedRoles,
      userRole: req.user.role
    });
    return;
  }

  next();
}

/**
 * Guard que requer permissões de ATENDENTE, GERENTE ou ADMIN
 */
export function requireAnyRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: 'Usuário não autenticado' });
    return;
  }

  const allowedRoles = ['ATENDENTE', 'GERENTE', 'ADMIN'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ 
      message: 'Acesso negado. Usuário deve ter um perfil válido.',
      requiredRoles: allowedRoles,
      userRole: req.user.role
    });
    return;
  }

  next();
}

/**
 * Guard customizável que aceita uma lista de roles
 */
export function requireRoles(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        message: 'Acesso negado. Permissões insuficientes.',
        requiredRoles: roles,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
}