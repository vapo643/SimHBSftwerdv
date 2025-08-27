import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/express';

export function roleGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const _userRole = req.user?.role;

    if (!userRole) {
      return res.*);
    }

    if (!allowedRoles.includes(userRole)) {
      return res.*);
    }

    next();
  };
}
