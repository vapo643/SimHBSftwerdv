import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  jwtAuthMiddleware,
  AuthenticatedRequest,
  invalidateAllUserTokens,
} from "../../lib/jwt-auth-middleware.js";
import { requireAdmin } from "../../lib/role-guards.js";
import { securityLogger, SecurityEventType } from "../../lib/security-logger.js";
import { createUser } from "../../services/userService.js";

const router = Router();

// User Management Schema - imported from main routes for backward compatibility
import { UserDataSchema } from "../../routes.js";

// Helper function to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || "Unknown";
}

// GET all users
router.get("/", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Query Supabase profiles directly instead of local users table
    const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
    const supabase = createServerSupabaseAdminClient();

    // Get all auth users first
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error("Auth users error:", authError);
      return res.status(500).json({ message: "Erro ao buscar usuários de autenticação" });
    }

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (profileError) {
      console.error("Supabase profiles error:", profileError);
      return res.status(500).json({ message: "Erro ao buscar perfis de usuários" });
    }

    // Join auth users with profiles manually
    const users = profiles.map(profile => {
      const authUser = authUsers.users.find(user => user.id === profile.id);
      return {
        id: profile.id,
        name: profile.full_name,
        email: authUser?.email || "N/A",
        role: profile.role,
        lojaId: profile.loja_id,
      };
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST create new user
router.post("/", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("📝 [USER CREATE] Request body:", req.body);
    console.log("📝 [USER CREATE] User role:", req.user?.role);

    const validatedData = UserDataSchema.parse(req.body);
    const newUser = await createUser(validatedData);
    return res.status(201).json(newUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const flatErrors = error.flatten();
      console.error("❌ [USER CREATE] Validation error:", {
        fieldErrors: flatErrors.fieldErrors,
        formErrors: flatErrors.formErrors,
        issues: error.issues,
      });

      // Enhanced error message for password issues
      let errorMessage = "Dados de entrada inválidos";
      if (flatErrors.fieldErrors.password) {
        errorMessage = "Erro de validação de senha - Verifique os requisitos de segurança";
      } else if (flatErrors.fieldErrors.role) {
        errorMessage = "Perfil de usuário inválido";
      }

      return res.status(400).json({
        message: errorMessage,
        errors: flatErrors,
        suggestions: flatErrors.fieldErrors.password
          ? {
              password: [
                "Use pelo menos 8 caracteres",
                "Combine letras maiúsculas e minúsculas",
                "Inclua números e símbolos",
                "Evite senhas comuns como '12345678' ou 'password'",
              ],
            }
          : undefined,
      });
    }
    if (error.name === "ConflictError") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao criar usuário:", error.message);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// PUT deactivate user - ASVS 8.3.7: Deactivate User Account and Invalidate All Sessions
router.put("/:id/deactivate", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        message: "ID do usuário é obrigatório",
      });
    }

    // Prevent self-deactivation
    if (userId === req.user?.id) {
      return res.status(400).json({
        message: "Você não pode desativar sua própria conta",
      });
    }

    // Step 1: Get user info from profiles
    const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
    const supabaseAdmin = createServerSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      // Generic error message - OWASP ASVS V3.2.3
      return res.status(404).json({
        message: "Operação não permitida",
      });
    }

    // Step 2: Deactivate the account in auth.users
    const { error: deactivateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: false,
      ban_duration: "876000h", // 100 years effectively permanent ban
    });

    if (deactivateError) {
      console.error("User deactivation error:", deactivateError);
      return res.status(500).json({
        message: "Erro ao desativar usuário",
      });
    }

    // Step 3: Invalidate all user tokens
    invalidateAllUserTokens(userId);

    // Step 4: Log the deactivation
    securityLogger.logEvent({
      type: SecurityEventType.USER_DEACTIVATED,
      severity: "HIGH",
      userId,
      userEmail: req.user?.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      endpoint: req.originalUrl,
      success: true,
      details: {
        deactivatedUserRole: profile.role,
        deactivatedUserName: profile.full_name,
        message: "User account deactivated and all sessions invalidated",
      },
    });

    res.json({
      message: "Usuário desativado com sucesso. Todas as sessões foram invalidadas.",
      deactivatedUser: {
        id: userId,
        name: profile.full_name,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({ message: "Erro ao desativar usuário" });
  }
});

// PUT reactivate user
router.put("/:id/reactivate", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        message: "ID do usuário é obrigatório",
      });
    }

    const { createServerSupabaseAdminClient } = await import("../../lib/supabase.js");
    const supabaseAdmin = createServerSupabaseAdminClient();

    // Reactivate the account
    const { error: reactivateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      ban_duration: "none",
    });

    if (reactivateError) {
      console.error("User reactivation error:", reactivateError);
      return res.status(500).json({
        message: "Erro ao reativar usuário",
      });
    }

    securityLogger.logEvent({
      type: SecurityEventType.USER_REACTIVATED,
      severity: "HIGH",
      userId,
      userEmail: req.user?.email,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      endpoint: req.originalUrl,
      success: true,
      details: {
        message: "User account reactivated",
      },
    });

    res.json({
      message: "Usuário reativado com sucesso.",
    });
  } catch (error) {
    console.error("Reactivate user error:", error);
    res.status(500).json({ message: "Erro ao reativar usuário" });
  }
});

export default router;