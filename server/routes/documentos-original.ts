import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireAnyRole } from "../lib/role-guards";

const router = Router();

/**
 * GET /api/documentos/download
 * Download de documentos do storage (CCB, contratos, etc)
 */
router.get("/download", jwtAuthMiddleware, requireAnyRole, async (req: AuthenticatedRequest, res) => {
  try {
    const { path } = req.query;

    if (!path || typeof path !== "string") {
      return res.status(400).json({
        error: "Parâmetro 'path' é obrigatório",
      });
    }

    console.log(`[DOCUMENTOS] Baixando documento: ${path}`);

    // Usar admin client para gerar URL assinada
    const { createServerSupabaseAdminClient } = await import("../lib/supabase");
    const supabaseAdmin = createServerSupabaseAdminClient();

    const { data: signedUrl, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(path, 3600); // 1 hora de validade

    if (error) {
      console.error("❌ [DOCUMENTOS] Erro ao gerar URL assinada:", error);

      // Se arquivo não existe, retornar erro apropriado
      if ((error as any)?.status === 400 || error.message?.includes("Object not found")) {
        return res.status(404).json({
          error: "Documento não encontrado",
          details: `Arquivo '${path}' não existe no storage`,
        });
      }

      return res.status(500).json({
        error: "Erro ao acessar documento",
        details: error.message,
      });
    }

    console.log(`[DOCUMENTOS] ✅ URL assinada gerada para: ${path}`);

    // Verificar se é request para JSON ou redirect
    const acceptHeader = req.headers.accept || '';
    const isJsonRequest = acceptHeader.includes('application/json');

    if (isJsonRequest) {
      // Retornar URL como JSON para requisições com Authorization header
      return res.json({
        url: signedUrl.signedUrl,
        filename: `documento-${path.split('/').pop()}`,
        contentType: "application/pdf",
      });
    } else {
      // Redirecionar para URL assinada (legacy behavior)
      res.redirect(signedUrl.signedUrl);
    }
  } catch (error) {
    console.error("❌ [DOCUMENTOS] Erro interno:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
    });
  }
});

export default router;