/**
 * Pilar 5 - Padrão Aberto - Servidor
 * Middleware de autenticação abstraído de implementações específicas
 */

import { Request, Response, NextFunction } from "express";
import { getServerAuthProvider } from "./auth-config";
import { ServerUser } from "./auth-types";

export interface AuthRequest extends Request {
  user?: ServerUser;
}

/**
 * Middleware de autenticação usando a camada de abstração
 * Desacoplado de provedores específicos (Supabase, Firebase, etc.)
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Development mode bypass para facilitar testes
    if (process.env.NODE_ENV === "development") {
      console.log("🔧 Development mode: Bypassing authentication");
      req.user = {
        id: "dev-user",
        email: "dev@example.com",
        name: "Usuário de Desenvolvimento",
      };
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Auth middleware: No token provided");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token === "undefined" || token === "null") {
      console.log("Auth middleware: Invalid token format");
      return res.status(401).json({ message: "Invalid token format" });
    }

    // Usa a camada de abstração em vez de chamar Supabase diretamente
    const authProvider = getServerAuthProvider();
    const validationResult = await authProvider.validateToken(token);

    if (!validationResult.valid) {
      console.log("Auth middleware: Token validation failed");
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = validationResult.user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
}

/**
 * Middleware alternativo que permite bypass em desenvolvimento
 * @deprecated Use authMiddleware() padrão que já inclui bypass de desenvolvimento
 */
export async function authMiddlewareWithBypass(req: AuthRequest, res: Response, next: NextFunction) {
  return authMiddleware(req, res, next);
}
