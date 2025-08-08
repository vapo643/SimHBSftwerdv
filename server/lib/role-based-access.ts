import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./jwt-auth-middleware";

/**
 * Mapeamento de rotas por role segundo documento de permissões
 * ATENDENTE: Apenas Dashboard e criação de propostas
 * ANALISTA: Apenas Fila de Análise
 * FINANCEIRO: Apenas Fila de Pagamento
 * GERENTE/ADMIN: Acesso completo
 */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Dashboard - ATENDENTE, GERENTE, ADMIN
  "/api/propostas": ["ATENDENTE", "GERENTE", "ADMINISTRADOR"],
  "/api/propostas/new": ["ATENDENTE", "GERENTE", "ADMINISTRADOR"],

  // Fila de Análise - ANALISTA, ADMIN
  "/api/propostas?analysis=true": ["ANALISTA", "ADMINISTRADOR"],
  "/api/propostas/analise": ["ANALISTA", "ADMINISTRADOR"],

  // Fila de Formalização - ATENDENTE (apenas suas), GERENTE, ADMIN
  "/api/propostas/formalizacao": ["ATENDENTE", "GERENTE", "ADMINISTRADOR"],

  // Fila de Pagamento - FINANCEIRO, ADMIN
  "/api/propostas/pagamento": ["FINANCEIRO", "ADMINISTRADOR"],
  "/api/pagamentos": ["FINANCEIRO", "ADMINISTRADOR"],

  // Configurações Admin - GERENTE, ADMIN
  "/api/users": ["GERENTE", "ADMINISTRADOR"],
  "/api/parceiros": ["GERENTE", "ADMINISTRADOR"],
  "/api/lojas": ["GERENTE", "ADMINISTRADOR"],
  "/api/produtos": ["GERENTE", "ADMINISTRADOR"],
  "/api/tabelas-comerciais": ["GERENTE", "ADMINISTRADOR"],
};

/**
 * Middleware de segurança que bloqueia acesso por URL
 * Retorna 403 mesmo tentando acessar diretamente pela URL
 */
export function enforceRoutePermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  const userRole = req.user.role;
  const path = req.path;
  const method = req.method;

  // Buscar permissões para a rota
  let allowedRoles: string[] | undefined;

  // Verificar rota exata primeiro
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(route.split("?")[0])) {
      // Verificar query params se necessário
      if (route.includes("?")) {
        const queryParam = route.split("?")[1];
        const [key, value] = queryParam.split("=");
        if (req.query[key] === value) {
          allowedRoles = roles;
          break;
        }
      } else {
        allowedRoles = roles;
        break;
      }
    }
  }

  // Se não encontrou permissões específicas, verificar rotas genéricas
  if (!allowedRoles) {
    // Rotas públicas ou não mapeadas passam (serão validadas pelos guards específicos)
    return next();
  }

  // Verificar se o usuário tem permissão
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.warn(`🚫 [SECURITY] Acesso negado: ${userRole} tentou acessar ${path}`);
    res.status(403).json({
      message: "Acesso negado. Você não tem permissão para acessar esta funcionalidade.",
      requiredRoles: allowedRoles,
      userRole: userRole,
    });
    return;
  }

  next();
}

/**
 * Guard específico para fila de análise
 * Apenas ANALISTA e ADMINISTRADOR
 */
export function requireAnalyst(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  const allowedRoles = ["ANALISTA", "ADMINISTRADOR"];
  if (!req.user.role || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      message: "Acesso negado. Apenas analistas podem acessar a fila de análise.",
      requiredRoles: allowedRoles,
      userRole: req.user.role,
    });
    return;
  }

  next();
}

/**
 * Guard específico para fila de pagamento
 * Apenas FINANCEIRO e ADMINISTRADOR
 */
export function requireFinanceiro(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Usuário não autenticado" });
    return;
  }

  const allowedRoles = ["FINANCEIRO", "ADMINISTRADOR"];
  if (!req.user.role || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      message: "Acesso negado. Apenas o setor financeiro pode acessar a fila de pagamento.",
      requiredRoles: allowedRoles,
      userRole: req.user.role,
    });
    return;
  }

  next();
}

/**
 * Guard para ATENDENTE ver apenas suas propostas
 */
export function filterProposalsByRole(proposals: any[], user: any): any[] {
  if (!user || !user.role) return [];

  switch (user.role) {
    case "ATENDENTE":
      // ATENDENTE vê apenas suas próprias propostas
      return proposals.filter(p => p.userId === user.id);

    case "ANALISTA":
      // ANALISTA vê apenas propostas em análise
      return proposals.filter(p => ["aguardando_analise", "em_analise"].includes(p.status));

    case "FINANCEIRO":
      // FINANCEIRO vê apenas propostas aprovadas/pagamento
      return proposals.filter(p => ["aprovado", "pronto_pagamento", "pago"].includes(p.status));

    case "GERENTE":
      // GERENTE vê todas da sua loja (já filtrado por RLS)
      return proposals;

    case "ADMINISTRADOR":
      // ADMIN vê tudo
      return proposals;

    default:
      return [];
  }
}
