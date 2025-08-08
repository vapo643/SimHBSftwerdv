/**
 * ClickSign Integration Routes for Proposal Formalization
 * Handles the electronic signature workflow for attendants
 */

import express from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { clickSignServiceV3 } from "../services/clickSignServiceV3.js";
import { getBrasiliaTimestamp } from "../lib/timezone.js";
import fs from "fs/promises";
import path from "path";
import { createServerSupabaseAdminClient } from "../lib/supabase.js";

const router = express.Router();

/**
 * Test ClickSign API Token
 * GET /api/clicksign/test-token
 */
router.get("/clicksign/test-token", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user?.role;

    // Only ADMINISTRADOR can test tokens
    if (userRole !== "ADMINISTRADOR") {
      return res.status(403).json({
        message: "Apenas administradores podem testar tokens ClickSign",
      });
    }

    // Test token using PRODUCTION ClickSign API (legal signatures only)
    const testUrl = `https://app.clicksign.com/api/v3/envelopes?access_token=${process.env.CLICKSIGN_API_TOKEN}`;

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      res.json({
        success: true,
        status: "Token válido - API de PRODUÇÃO",
        environment: "production",
        envelopes_count: data.meta?.record_count || 0,
        message: "Assinaturas com validade jurídica",
      });
    } else {
      res.status(response.status).json({
        success: false,
        status: "Token inválido - API de PRODUÇÃO",
        environment: "production",
        error: data,
      });
    }
  } catch (error) {
    console.error("[CLICKSIGN] ❌ Error testing token:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno ao testar token",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Regenerate ClickSign signature link
 * POST /api/propostas/:id/clicksign/regenerar
 */
router.post(
  "/propostas/:id/clicksign/regenerar",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: propostaId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      console.log(
        `[CLICKSIGN] 🔄 Regenerating signature link - Proposta: ${propostaId}, User: ${userId}, Role: ${userRole}`
      );

      // Verificar se é ATENDENTE ou ADMINISTRADOR
      if (userRole !== "ATENDENTE" && userRole !== "ADMINISTRADOR") {
        return res.status(403).json({
          message: "Apenas atendentes e administradores podem regenerar links de assinatura",
        });
      }

      // Create Supabase client for storage operations
      const supabase = createServerSupabaseAdminClient();

      // Import database dependencies
      const { db } = await import("../lib/supabase");
      const { propostas } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Buscar dados da proposta
      const [proposta] = await db.select().from(propostas).where(eq(propostas.id, propostaId));

      if (!proposta) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      // Verificar se CCB foi gerado
      if (!proposta.ccbGerado) {
        return res.status(400).json({
          message: "CCB deve ser gerada antes de regenerar link de assinatura",
        });
      }

      // Cancelar envelope anterior se existir
      if (proposta.clicksignListKey) {
        try {
          console.log(`[CLICKSIGN] 🗑️ Cancelling previous envelope: ${proposta.clicksignListKey}`);
          await clickSignServiceV3.cancelEnvelope(proposta.clicksignListKey);
        } catch (error) {
          console.log(
            `[CLICKSIGN] ⚠️ Could not cancel previous envelope:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Parse client data from JSONB
      const clienteData = proposta.clienteData as any;
      if (!clienteData || !clienteData.nome || !clienteData.email || !clienteData.cpf) {
        return res.status(400).json({
          message:
            "Dados do cliente incompletos. Nome, email e CPF são obrigatórios para regenerar link.",
        });
      }

      // Generate or regenerate CCB if needed
      let pdfBase64: string;

      if (!proposta.caminhoCcbAssinado) {
        console.log(
          `[CLICKSIGN] 🔄 CCB path not found, generating new CCB for proposal: ${propostaId}`
        );

        // Generate new CCB using TEMPLATE SERVICE (pdf-lib)
        const { ccbGenerationService } = await import("../services/ccbGenerationService");
        const result = await ccbGenerationService.generateCCB(propostaId);
        if (!result.success) {
          throw new Error(`Erro ao gerar CCB: ${result.error}`);
        }
        const ccbPath = result.pdfPath!;

        // Update proposal with new CCB path
        await db
          .update(propostas)
          .set({ caminhoCcbAssinado: ccbPath })
          .where(eq(propostas.id, propostaId));

        // Read the newly generated CCB from Supabase Storage
        const { data: ccbData, error: downloadError } = await supabase.storage
          .from("documents")
          .download(ccbPath);

        if (downloadError || !ccbData) {
          throw new Error(`Erro ao baixar CCB: ${downloadError?.message || "Unknown error"}`);
        }

        const ccbBuffer = Buffer.from(await ccbData.arrayBuffer());
        pdfBase64 = ccbBuffer.toString("base64");

        console.log(`[CLICKSIGN] ✅ New CCB generated: ${ccbPath}`);
      } else {
        // Try to read existing CCB from Supabase Storage
        try {
          const { data: ccbData, error: downloadError } = await supabase.storage
            .from("documents")
            .download(proposta.caminhoCcbAssinado);

          if (downloadError || !ccbData) {
            throw new Error(`Erro ao baixar CCB: ${downloadError?.message || "File not found"}`);
          }

          const ccbBuffer = Buffer.from(await ccbData.arrayBuffer());
          pdfBase64 = ccbBuffer.toString("base64");

          console.log(
            `[CLICKSIGN] ✅ Using existing CCB from Supabase: ${proposta.caminhoCcbAssinado}`
          );
        } catch (fileError) {
          console.log(
            `[CLICKSIGN] ⚠️ Existing CCB file not found, generating new one: ${fileError instanceof Error ? fileError.message : "Unknown error"}`
          );

          // Generate new CCB using TEMPLATE SERVICE (pdf-lib)
          const { ccbGenerationService } = await import("../services/ccbGenerationService");
          const result = await ccbGenerationService.generateCCB(propostaId);
          if (!result.success) {
            throw new Error(`Erro ao gerar CCB: ${result.error}`);
          }
          const ccbPath = result.pdfPath!;

          // Update proposal with new CCB path
          await db
            .update(propostas)
            .set({ caminhoCcbAssinado: ccbPath })
            .where(eq(propostas.id, propostaId));

          // Read the newly generated CCB from Supabase Storage
          const { data: ccbData, error: downloadError } = await supabase.storage
            .from("documents")
            .download(ccbPath);

          if (downloadError || !ccbData) {
            throw new Error(
              `Erro ao baixar CCB regenerada: ${downloadError?.message || "Unknown error"}`
            );
          }

          const ccbBuffer = Buffer.from(await ccbData.arrayBuffer());
          pdfBase64 = ccbBuffer.toString("base64");

          console.log(`[CLICKSIGN] ✅ New CCB regenerated: ${ccbPath}`);
        }
      }

      // Gerar novo link usando o mesmo fluxo
      const result = await clickSignServiceV3.sendCCBForSignature(propostaId, pdfBase64, {
        name: clienteData.nome,
        email: clienteData.email,
        cpf: clienteData.cpf,
        phone: clienteData.telefone || "",
        birthday: clienteData.dataNascimento,
      });

      // Atualizar proposta no banco
      await db
        .update(propostas)
        .set({
          clicksignListKey: result.requestSignatureKey || "",
          clicksignDocumentKey: result.documentKey || "",
          clicksignSignerKey: result.signerId || "",
          clicksignSignUrl: result.signUrl || "",
          clicksignStatus: "pending",
          clicksignSentAt: new Date(),
          assinaturaEletronicaConcluida: false, // Reset status
        })
        .where(eq(propostas.id, propostaId));

      console.log(`[CLICKSIGN] ✅ New signature link generated for proposal: ${propostaId}`);

      res.json({
        success: true,
        signUrl: result.signUrl,
        envelopeId: result.documentKey, // Keep as envelopeId for frontend compatibility
        message: "Novo link de assinatura gerado com sucesso",
      });
    } catch (error) {
      console.error("[CLICKSIGN] ❌ Error regenerating signature link:", error);

      // Tratamento específico para erro de autenticação
      if (error instanceof Error && error.message.includes("401")) {
        return res.status(401).json({
          error: "Token do ClickSign inválido ou expirado",
          details:
            "O token de API do ClickSign precisa ser atualizado. Entre em contato com o administrador do sistema.",
          action: "UPDATE_CLICKSIGN_TOKEN",
        });
      }

      // Outros erros da API do ClickSign
      if (error instanceof Error && error.message.includes("API error")) {
        return res.status(400).json({
          error: "Erro na API do ClickSign",
          details: error.message,
          action: "CHECK_CLICKSIGN_SERVICE",
        });
      }

      // Erro genérico
      res.status(500).json({
        error: "Erro interno ao gerar novo link de assinatura",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Send proposal CCB to ClickSign for electronic signature
 * POST /api/propostas/:id/clicksign/enviar
 */
router.post(
  "/propostas/:id/clicksign/enviar",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: propostaId } = req.params;
      const { useBiometricAuth = false } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      console.log(
        `[CLICKSIGN] ${getBrasiliaTimestamp()} - Iniciando envio para ClickSign - Proposta: ${propostaId}, User: ${userId}, Role: ${userRole}`
      );
      console.log(`[CLICKSIGN] Biometria Facial: ${useBiometricAuth ? "ATIVADA" : "DESATIVADA"}`);

      // Verificar se é ATENDENTE ou ADMINISTRADOR
      if (userRole !== "ATENDENTE" && userRole !== "ADMINISTRADOR") {
        return res.status(403).json({
          message:
            "Apenas atendentes e administradores podem enviar contratos para assinatura eletrônica",
        });
      }

      // Import database dependencies
      const { db } = await import("../lib/supabase");
      const { propostas } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Buscar dados da proposta
      const [proposta] = await db.select().from(propostas).where(eq(propostas.id, propostaId));

      if (!proposta) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      console.log(
        `[CLICKSIGN] Proposta encontrada: ${proposta.id}, Status: ${proposta.status}, CCB Gerado: ${proposta.ccbGerado}`
      );

      // Verificar se CCB foi gerado
      if (!proposta.ccbGerado || !proposta.caminhoCcbAssinado) {
        return res.status(400).json({
          message: "CCB deve ser gerada antes de enviar para assinatura eletrônica",
        });
      }

      // Verificar se já foi enviado para ClickSign
      if (proposta.assinaturaEletronicaConcluida) {
        return res.status(400).json({
          message: "Este contrato já foi processado para assinatura eletrônica",
        });
      }

      // Parse client data from JSONB
      const clienteData = proposta.clienteData as any;
      if (!clienteData || !clienteData.nome || !clienteData.email || !clienteData.cpf) {
        return res.status(400).json({
          message: "Dados do cliente incompletos. Nome, email e CPF são obrigatórios.",
        });
      }

      console.log(
        `[CLICKSIGN] Cliente: ${clienteData.nome}, Email: ${clienteData.email}, CPF: ${clienteData.cpf}`
      );

      // Verificar se arquivo CCB existe
      const { createServerSupabaseAdminClient } = await import("../lib/supabase");
      const supabase = createServerSupabaseAdminClient();

      // Extrair caminho correto do CCB
      let ccbPath = proposta.caminhoCcbAssinado;
      const documentsIndex = ccbPath.indexOf("/documents/");
      if (documentsIndex !== -1) {
        ccbPath = ccbPath.substring(documentsIndex + "/documents/".length);
      }

      console.log(`[CLICKSIGN] Buscando CCB no caminho: ${ccbPath}`);

      // Baixar o CCB do Supabase Storage
      const { data: ccbFile, error: downloadError } = await supabase.storage
        .from("documents")
        .download(ccbPath);

      if (downloadError || !ccbFile) {
        console.error(`[CLICKSIGN] Erro ao baixar CCB:`, downloadError);
        return res.status(500).json({
          message: "Erro ao acessar arquivo CCB",
        });
      }

      // Convert file to base64 with Data URI format
      const arrayBuffer = await ccbFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Raw = buffer.toString("base64");
      const base64Content = `data:application/pdf;base64,${base64Raw}`;

      console.log(`[CLICKSIGN] CCB convertido para base64, tamanho: ${base64Content.length} chars`);

      // Preparar dados para ClickSign
      const envelopeData = {
        name: `Contrato CCB - Proposta ${propostaId}`,
        locale: "pt-BR",
        auto_close: false,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
        block_after_refusal: true,
      };

      const documentData = {
        content: base64Content,
        filename: `CCB-${propostaId}.pdf`,
      };

      const signerData = {
        name: clienteData.nome,
        email: clienteData.email,
        phone: clienteData.telefone || "",
        documentation: clienteData.cpf.replace(/\D/g, ""), // Remove formatação
        birthday: clienteData.dataNascimento || undefined,
        company: clienteData.nomeEmpresa || undefined,
      };

      console.log(`[CLICKSIGN] Enviando para ClickSign API...`);

      // Chamar ClickSign API
      const result = await clickSignServiceV3.sendCCBForSignature(propostaId, base64Content, {
        name: clienteData.nome,
        email: clienteData.email,
        phone: clienteData.telefone || "",
        cpf: clienteData.cpf,
        birthday: clienteData.dataNascimento,
        useBiometricAuth: useBiometricAuth,
      });

      console.log(`[CLICKSIGN] ✅ Sucesso! Documento criado: ${result.documentKey}`);

      // Atualizar proposta no banco
      await db
        .update(propostas)
        .set({
          clicksignListKey: result.requestSignatureKey || "", // Using request signature key
          clicksignDocumentKey: result.documentKey || "",
          clicksignSignerKey: result.signerId || "",
          clicksignSignUrl: result.signUrl || "",
          clicksignStatus: "pending",
          clicksignSentAt: new Date(),
        })
        .where(eq(propostas.id, propostaId));

      // Log de auditoria
      const { propostaLogs } = await import("../../shared/schema");
      await db.insert(propostaLogs).values({
        propostaId,
        autorId: userId || "",
        statusNovo: "clicksign_enviado",
        observacao: `Contrato enviado para ClickSign. Documento: ${result.documentKey}`,
      });

      console.log(`[CLICKSIGN] ✅ Proposta atualizada e log registrado`);

      res.json({
        message: "Contrato enviado para ClickSign com sucesso",
        envelopeId: result.documentKey, // Keep as envelopeId for frontend compatibility
        documentKey: result.documentKey || "",
        signerKey: result.signerId || "",
        signUrl: result.signUrl || "",
        status: "pending",
        createdAt: getBrasiliaTimestamp(),
      });
    } catch (error) {
      console.error(`[CLICKSIGN] ❌ Erro ao enviar para ClickSign:`, error);

      res.status(500).json({
        message: "Erro ao enviar contrato para ClickSign",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Get ClickSign status for a proposal
 * GET /api/propostas/:id/clicksign/status
 */
router.get(
  "/propostas/:id/clicksign/status",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: propostaId } = req.params;

      // Import database dependencies
      const { db } = await import("../lib/supabase");
      const { propostas } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Buscar dados da proposta
      const [proposta] = await db
        .select({
          id: propostas.id,
          clicksignListKey: propostas.clicksignListKey, // Using correct field name
          clicksignStatus: propostas.clicksignStatus,
          clicksignSignUrl: propostas.clicksignSignUrl,
          assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida,
        })
        .from(propostas)
        .where(eq(propostas.id, propostaId));

      if (!proposta) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      if (!proposta.clicksignListKey) {
        return res.json({
          status: "not_sent",
          message: "Contrato ainda não foi enviado para ClickSign",
        });
      }

      // Buscar status atualizado no ClickSign
      try {
        const envelopeStatus = await clickSignServiceV3.getEnvelopeStatus(
          proposta.clicksignListKey
        );

        res.json({
          envelopeId: proposta.clicksignListKey, // Frontend expects envelopeId
          status: envelopeStatus.status,
          signUrl: proposta.clicksignSignUrl,
          completed: proposta.assinaturaEletronicaConcluida,
          lastUpdated: getBrasiliaTimestamp(),
        });
      } catch (error) {
        // Se der erro na API do ClickSign, retorna dados do banco
        res.json({
          envelopeId: proposta.clicksignListKey, // Frontend expects envelopeId
          status: proposta.clicksignStatus || "unknown",
          signUrl: proposta.clicksignSignUrl,
          completed: proposta.assinaturaEletronicaConcluida,
          lastUpdated: getBrasiliaTimestamp(),
          note: "Status do banco de dados (ClickSign API indisponível)",
        });
      }
    } catch (error) {
      console.error(`[CLICKSIGN] Erro ao consultar status:`, error);
      res.status(500).json({
        message: "Erro ao consultar status do ClickSign",
      });
    }
  }
);

export default router;
