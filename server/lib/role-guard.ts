import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/express';

export function roleGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
    }

    next();
  };
}
