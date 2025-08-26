import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../shared/types/express";

/**
 * Guard que requer permissões de ADMINISTRADOR
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  if (req.user.role !== "ADMINISTRADOR") {
    res.status(403).json({
      message: "Acesso negado. Permissões de administrador requeridas.",
      requiredRole: "ADMINISTRADOR",
      userRole: req.user.role,
    });
    return;
  }

  next();
}

/**
 * Guard que requer permissões de GERENTE ou ADMINISTRADOR
 */
export function requireManagerOrAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  const allowedRoles = ["GERENTE", "ADMINISTRADOR"];
  if (!req.user.role || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      message: "Acesso negado. Permissões de gerente ou administrador requeridas.",
      requiredRoles: allowedRoles,
      userRole: req.user.role,
    });
    return;
  }

  next();
}

/**
 * Guard que requer permissões de ATENDENTE, GERENTE ou ADMINISTRADOR
 */
export function requireAnyRole(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  const allowedRoles = ["ATENDENTE", "GERENTE", "ADMINISTRADOR"];
  if (!req.user.role || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      message: "Acesso negado. Usuário deve ter um perfil válido.",
      requiredRoles: allowedRoles,
      userRole: req.user.role,
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
      res.status(401).json({ message: "Usuário não autenticado" });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        message: "Acesso negado. Permissões insuficientes.",
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}
