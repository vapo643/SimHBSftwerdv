/**
 * Banco Inter API Routes
 * Handles collection (boleto/PIX) operations
 */

import express from "express";
import { interBankService } from "../services/interBankService.js";
import { storage } from "../storage.js";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware.js";
import { getBrasiliaTimestamp } from "../lib/timezone.js";
import { z } from "zod";
import { db } from "../lib/supabase.js";
import { interCollections, propostas, historicoObservacoesCobranca } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = express.Router();

// Validation schemas
const createCollectionSchema = z.object({
  proposalId: z.string(),
  valorTotal: z.number().min(2.5).max(99999999.99),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clienteData: z.object({
    nome: z.string().min(1),
    cpf: z.string().min(11),
    email: z.string().email(),
    telefone: z.string().optional(),
    endereco: z.string().min(1),
    numero: z.string().min(1),
    complemento: z.string().optional(),
    bairro: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
    cep: z.string().min(8),
  }),
});

const searchCollectionsSchema = z.object({
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  situacao: z
    .enum(["RECEBIDO", "A_RECEBER", "MARCADO_RECEBIDO", "ATRASADO", "CANCELADO", "EXPIRADO"])
    .optional(),
  pessoaPagadora: z.string().optional(),
  seuNumero: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * Test Inter Bank API connection
 * GET /api/inter/test
 */
router.get("/test", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Testing connection for user: ${req.user?.email}`);

    const isConnected = await interBankService.testConnection();

    res.json({
      success: isConnected,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Connection test failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test Inter Bank connection",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Batch update collection due dates - Prorrogar Vencimento
 * PATCH /api/inter/collections/batch-extend
 */
router.patch(
  "/collections/batch-extend",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Check user permissions
      if (req.user?.role !== "ADMINISTRADOR") {
        return res.status(403).json({
          error: "Apenas administradores podem modificar cobranças",
        });
      }

      const { codigosSolicitacao, novaDataVencimento } = req.body;

      // === AUDIT LOG 1: Entrada da Requisição ===
      console.log("🔍 [AUDIT-PRORROGAR] ====== INÍCIO DA PRORROGAÇÃO ======");
      console.log("🔍 [AUDIT-PRORROGAR] Dados recebidos do frontend:", {
        codigosSolicitacao,
        novaDataVencimento,
        quantidadeBoletos: Array.isArray(codigosSolicitacao) ? codigosSolicitacao.length : 0,
        timestamp: new Date().toISOString(),
        usuario: req.user?.email,
      });

      if (
        !codigosSolicitacao ||
        !Array.isArray(codigosSolicitacao) ||
        codigosSolicitacao.length === 0
      ) {
        return res.status(400).json({ error: "Selecione pelo menos um boleto" });
      }

      if (!novaDataVencimento) {
        return res.status(400).json({ error: "Nova data de vencimento é obrigatória" });
      }

      const results = [];
      const errors = [];
      const auditResults = [];

      // Process each selected boleto
      for (const codigoSolicitacao of codigosSolicitacao) {
        try {
          // === AUDIT LOG 2: Antes da modificação ===
          console.log(`🔍 [AUDIT-PRORROGAR] Processando boleto ${codigoSolicitacao}`);

          // Buscar dados atuais do boleto para comparação
          const [boletoAtual] = await db
            .select()
            .from(interCollections)
            .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
            .limit(1);

          console.log(`🔍 [AUDIT-PRORROGAR] Estado atual do boleto:`, {
            codigoSolicitacao,
            dataVencimentoAtual: boletoAtual?.dataVencimento,
            situacao: boletoAtual?.situacao,
            numeroParcela: boletoAtual?.numeroParcela,
          });

          // Update in Inter Bank API
          await interBankService.editarCobranca(codigoSolicitacao, {
            dataVencimento: novaDataVencimento,
          });

          // === AUDIT LOG 3: Verificação pós-API ===
          console.log(`🔍 [AUDIT-PRORROGAR] Verificando atualização na API do Inter...`);
          const cobrancaAtualizada = await interBankService.recuperarCobranca(codigoSolicitacao);

          const dataVencimentoVerificada = cobrancaAtualizada.cobranca?.dataVencimento;
          const atualizacaoConfirmada = dataVencimentoVerificada === novaDataVencimento;

          console.log(`🔍 [AUDIT-PRORROGAR] Resultado da verificação na API:`, {
            codigoSolicitacao,
            novaDataEnviada: novaDataVencimento,
            dataRetornadaAPI: dataVencimentoVerificada,
            atualizacaoConfirmada,
            statusAPI: cobrancaAtualizada.cobranca?.situacao,
          });

          // Update local database
          await db
            .update(interCollections)
            .set({
              dataVencimento: novaDataVencimento,
              updatedAt: new Date(getBrasiliaTimestamp()),
            })
            .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao));

          // === AUDIT LOG 4: Verificação do banco local ===
          const [boletoAposUpdate] = await db
            .select()
            .from(interCollections)
            .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
            .limit(1);

          console.log(`🔍 [AUDIT-PRORROGAR] Verificação do banco de dados local:`, {
            codigoSolicitacao,
            dataVencimentoAntes: boletoAtual?.dataVencimento,
            dataVencimentoDepois: boletoAposUpdate?.dataVencimento,
            atualizacaoBancoConfirmada: boletoAposUpdate?.dataVencimento === novaDataVencimento,
          });

          // Adicionar ao relatório de auditoria
          auditResults.push({
            codigoSolicitacao,
            parcela: boletoAtual?.numeroParcela,
            dataAnterior: boletoAtual?.dataVencimento,
            dataNova: novaDataVencimento,
            verificacaoAPI: {
              dataRetornada: dataVencimentoVerificada,
              confirmada: atualizacaoConfirmada,
            },
            verificacaoBanco: {
              dataGravada: boletoAposUpdate?.dataVencimento,
              confirmada: boletoAposUpdate?.dataVencimento === novaDataVencimento,
            },
            sucesso:
              atualizacaoConfirmada && boletoAposUpdate?.dataVencimento === novaDataVencimento,
          });

          results.push({ codigoSolicitacao, success: true });
        } catch (error) {
          console.error(`🔍 [AUDIT-PRORROGAR] ❌ Erro ao prorrogar ${codigoSolicitacao}:`, error);
          errors.push({
            codigoSolicitacao,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Save audit log
      const proposta = await db
        .select({ propostaId: interCollections.propostaId })
        .from(interCollections)
        .where(eq(interCollections.codigoSolicitacao, codigosSolicitacao[0]))
        .limit(1);

      if (proposta.length > 0) {
        await db.insert(historicoObservacoesCobranca).values({
          propostaId: proposta[0].propostaId,
          mensagem: `Vencimento prorrogado para ${novaDataVencimento} em ${results.length} boleto(s)`,
          criadoPor: req.user?.email || "Sistema",
          tipoAcao: "PRORROGACAO",
          dadosAcao: {
            codigosSolicitacao,
            novaDataVencimento,
            results,
            errors,
            auditoria: auditResults,
          },
        });
      }

      // === AUDIT LOG 5: Relatório Final ===
      console.log("🔍 [AUDIT-PRORROGAR] ====== RELATÓRIO FINAL ======");
      console.log("🔍 [AUDIT-PRORROGAR] Resumo:", {
        totalProcessados: codigosSolicitacao.length,
        sucessos: results.length,
        falhas: errors.length,
        taxaSucesso: `${((results.length / codigosSolicitacao.length) * 100).toFixed(1)}%`,
      });
      console.log(
        "🔍 [AUDIT-PRORROGAR] Detalhes da auditoria:",
        JSON.stringify(auditResults, null, 2)
      );
      console.log("🔍 [AUDIT-PRORROGAR] ====== FIM DA PRORROGAÇÃO ======");

      res.json({
        success: true,
        message: `${results.length} boleto(s) prorrogado(s) com sucesso`,
        results,
        errors,
        auditoria: auditResults,
      });
    } catch (error) {
      console.error("🔍 [AUDIT-PRORROGAR] ❌ Erro crítico:", error);
      res.status(500).json({
        error: "Falha ao prorrogar boletos",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Apply settlement discount - Desconto para Quitação
 * POST /api/inter/collections/settlement-discount
 */
router.post(
  "/collections/settlement-discount",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Check user permissions
      if (req.user?.role !== "ADMINISTRADOR") {
        return res.status(403).json({
          error: "Apenas administradores podem aplicar descontos de quitação",
        });
      }

      const { propostaId, desconto, novasParcelas } = req.body;

      // === AUDIT LOG 1: Entrada da Requisição ===
      console.log("🔍 [AUDIT-QUITACAO] ====== INÍCIO DA QUITAÇÃO COM DESCONTO ======");
      console.log("🔍 [AUDIT-QUITACAO] Dados recebidos do frontend:", {
        propostaId,
        desconto,
        quantidadeNovasParcelas: Array.isArray(novasParcelas) ? novasParcelas.length : 0,
        novasParcelas,
        timestamp: new Date().toISOString(),
        usuario: req.user?.email,
      });

      if (!propostaId || !desconto || !novasParcelas || !Array.isArray(novasParcelas)) {
        return res.status(400).json({ error: "Dados incompletos" });
      }

      // Start database transaction
      const result = await db.transaction(async tx => {
        // Step 1: Get proposal data
        const proposta = await tx
          .select()
          .from(propostas)
          .where(eq(propostas.id, propostaId))
          .limit(1);

        if (proposta.length === 0) {
          throw new Error("Proposta não encontrada");
        }

        // Step 2: Get all active boletos
        const boletosAtivos = await tx
          .select()
          .from(interCollections)
          .where(
            and(eq(interCollections.propostaId, propostaId), eq(interCollections.isActive, true))
          );

        // === AUDIT LOG 2: Valor Restante da Dívida ===
        const valorRestanteDivida = boletosAtivos.reduce((total, boleto) => {
          return total + parseFloat(boleto.valorNominal || "0");
        }, 0);

        console.log("🔍 [AUDIT-QUITACAO] Análise da dívida atual:", {
          quantidadeBoletosAtivos: boletosAtivos.length,
          valorRestanteDivida: valorRestanteDivida.toFixed(2),
          valorDesconto: desconto,
          percentualDesconto: `${((desconto / valorRestanteDivida) * 100).toFixed(1)}%`,
          novoValorTotal: (valorRestanteDivida - desconto).toFixed(2),
        });

        // Step 3: Cancel all active boletos
        const cancelResults = [];
        const auditCancelamentos = [];

        for (const boleto of boletosAtivos) {
          try {
            // === AUDIT LOG 3: Cancelamento de cada boleto antigo ===
            console.log(`🔍 [AUDIT-QUITACAO] Cancelando boleto antigo:`, {
              codigoSolicitacao: boleto.codigoSolicitacao,
              parcela: boleto.numeroParcela,
              valorOriginal: boleto.valorNominal,
              dataVencimentoOriginal: boleto.dataVencimento,
            });

            await interBankService.cancelarCobranca(boleto.codigoSolicitacao);

            // Mark as inactive with reason
            await tx
              .update(interCollections)
              .set({
                isActive: false,
                motivoCancelamento: `Substituído por quitação com desconto de R$ ${desconto}`,
                situacao: "CANCELADO",
                updatedAt: new Date(getBrasiliaTimestamp()),
              })
              .where(eq(interCollections.codigoSolicitacao, boleto.codigoSolicitacao));

            // Verificar cancelamento via API
            const statusCancelado = await interBankService.recuperarCobranca(
              boleto.codigoSolicitacao
            );

            auditCancelamentos.push({
              codigoSolicitacao: boleto.codigoSolicitacao,
              situacaoAntes: boleto.situacao,
              situacaoDepois: statusCancelado.cobranca?.situacao,
              cancelamentoConfirmado: statusCancelado.cobranca?.situacao === "CANCELADO",
            });

            console.log(`🔍 [AUDIT-QUITACAO] Verificação do cancelamento:`, {
              codigoSolicitacao: boleto.codigoSolicitacao,
              statusRetornadoAPI: statusCancelado.cobranca?.situacao,
              cancelamentoConfirmado: statusCancelado.cobranca?.situacao === "CANCELADO",
            });

            cancelResults.push({ codigoSolicitacao: boleto.codigoSolicitacao, success: true });
          } catch (error) {
            console.error(
              `🔍 [AUDIT-QUITACAO] ❌ Erro ao cancelar ${boleto.codigoSolicitacao}:`,
              error
            );
            cancelResults.push({
              codigoSolicitacao: boleto.codigoSolicitacao,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Step 4: Create new boletos
        const novosBoletosData = [];
        const auditNovosBoletosData = [];

        const clienteData = {
          nome: proposta[0].clienteNome || "",
          cpf: proposta[0].clienteCpf || "",
          email: proposta[0].clienteEmail || "",
          telefone: proposta[0].clienteTelefone || "",
          endereco: proposta[0].clienteEndereco || "",
          numero: proposta[0].clienteNumero || "",
          bairro: proposta[0].clienteBairro || "",
          cidade: proposta[0].clienteCidade || "",
          uf: proposta[0].clienteUf || "",
          cep: proposta[0].clienteCep || "",
        };

        for (let i = 0; i < novasParcelas.length; i++) {
          const parcela = novasParcelas[i];

          try {
            // === AUDIT LOG 4: Criação de cada novo boleto ===
            console.log(
              `🔍 [AUDIT-QUITACAO] Criando novo boleto ${i + 1}/${novasParcelas.length}:`,
              {
                parcela: i + 1,
                valor: parcela.valor,
                dataVencimento: parcela.dataVencimento,
              }
            );

            // Create boleto via Inter API
            const novoBoleto = await interBankService.criarCobrancaParaProposta({
              id: `${propostaId}-QUIT-${i + 1}`,
              valorTotal: parcela.valor,
              dataVencimento: parcela.dataVencimento,
              clienteData,
            });

            console.log(`🔍 [AUDIT-QUITACAO] Resposta da criação do boleto:`, {
              codigoSolicitacao: novoBoleto.codigoSolicitacao,
              sucesso: !!novoBoleto.codigoSolicitacao,
            });

            // Get full details and verify creation
            const detalhes = await interBankService.recuperarCobranca(novoBoleto.codigoSolicitacao);

            console.log(`🔍 [AUDIT-QUITACAO] Verificação do novo boleto na API:`, {
              codigoSolicitacao: novoBoleto.codigoSolicitacao,
              valorConfirmado: detalhes.cobranca?.valorNominal,
              dataVencimentoConfirmada: detalhes.cobranca?.dataVencimento,
              situacao: detalhes.cobranca?.situacao,
              criacaoConfirmada: true,
            });

            // Save to database
            await tx.insert(interCollections).values({
              propostaId: propostaId,
              codigoSolicitacao: novoBoleto.codigoSolicitacao,
              seuNumero: detalhes.cobranca.seuNumero,
              valorNominal: detalhes.cobranca.valorNominal.toString(),
              dataVencimento: parcela.dataVencimento,
              situacao: detalhes.cobranca.situacao,
              dataSituacao: detalhes.cobranca.dataSituacao,
              nossoNumero: detalhes.boleto?.nossoNumero,
              codigoBarras: detalhes.boleto?.codigoBarras,
              linhaDigitavel: detalhes.boleto?.linhaDigitavel,
              pixTxid: detalhes.pix?.txid,
              pixCopiaECola: detalhes.pix?.pixCopiaECola,
              dataEmissao: detalhes.cobranca.dataEmissao,
              origemRecebimento: "BOLETO",
              isActive: true,
              numeroParcela: i + 1,
              totalParcelas: novasParcelas.length,
            });

            novosBoletosData.push({
              codigoSolicitacao: novoBoleto.codigoSolicitacao,
              parcela: i + 1,
              valor: parcela.valor,
              vencimento: parcela.dataVencimento,
            });

            auditNovosBoletosData.push({
              codigoSolicitacao: novoBoleto.codigoSolicitacao,
              parcela: i + 1,
              valorEnviado: parcela.valor,
              valorConfirmadoAPI: detalhes.cobranca?.valorNominal,
              dataVencimentoEnviada: parcela.dataVencimento,
              dataVencimentoConfirmadaAPI: detalhes.cobranca?.dataVencimento,
              situacaoAPI: detalhes.cobranca?.situacao,
              criacaoConfirmada: true,
            });
          } catch (error) {
            console.error(`🔍 [AUDIT-QUITACAO] ❌ Erro ao criar boleto ${i + 1}:`, error);
            throw error; // Rollback transaction on error
          }
        }

        // === AUDIT LOG 5: Verificação do banco de dados ===
        const boletosAposOperacao = await tx
          .select()
          .from(interCollections)
          .where(eq(interCollections.propostaId, propostaId));

        const boletosInativos = boletosAposOperacao.filter(b => !b.isActive);
        const boletosNovosAtivos = boletosAposOperacao.filter(b => b.isActive);

        console.log("🔍 [AUDIT-QUITACAO] Verificação do banco de dados local:", {
          totalBoletosAntes: boletosAtivos.length,
          totalBoletosInativos: boletosInativos.length,
          totalBoletosNovosAtivos: boletosNovosAtivos.length,
          boletosInativosCorretos: boletosInativos.length === boletosAtivos.length,
          novosBoletosCorretos: boletosNovosAtivos.length === novasParcelas.length,
        });

        // Step 5: Save audit log
        await tx.insert(historicoObservacoesCobranca).values({
          propostaId: propostaId,
          mensagem: `Desconto de quitação de R$ ${desconto} aplicado. ${boletosAtivos.length} boletos antigos cancelados e substituídos por ${novasParcelas.length} nova(s) parcela(s).`,
          criadoPor: req.user?.email || "Sistema",
          tipoAcao: "DESCONTO_QUITACAO",
          dadosAcao: {
            desconto,
            boletosAntigos: cancelResults,
            novosBoletosData,
            novasParcelas,
            auditoria: {
              valorRestanteDivida,
              percentualDesconto: `${((desconto / valorRestanteDivida) * 100).toFixed(1)}%`,
              cancelamentos: auditCancelamentos,
              novosBoletos: auditNovosBoletosData,
            },
          },
        });

        return {
          boletosAntigos: cancelResults,
          novosBoletosData,
          message: `Quitação processada com sucesso. ${novosBoletosData.length} novo(s) boleto(s) criado(s).`,
          auditoria: {
            valorRestanteDivida,
            percentualDesconto: `${((desconto / valorRestanteDivida) * 100).toFixed(1)}%`,
            cancelamentos: auditCancelamentos,
            novosBoletos: auditNovosBoletosData,
          },
        };
      });

      // === AUDIT LOG 6: Relatório Final ===
      console.log("🔍 [AUDIT-QUITACAO] ====== RELATÓRIO FINAL ======");
      console.log("🔍 [AUDIT-QUITACAO] Resumo:", {
        valorDividaOriginal: result.auditoria.valorRestanteDivida,
        descontoAplicado: desconto,
        percentualDesconto: result.auditoria.percentualDesconto,
        boletosAntigosCancelados: result.boletosAntigos.length,
        novosBoletosData: result.novosBoletosData.length,
        sucesso: true,
      });
      console.log(
        "🔍 [AUDIT-QUITACAO] Detalhes da auditoria:",
        JSON.stringify(result.auditoria, null, 2)
      );
      console.log("🔍 [AUDIT-QUITACAO] ====== FIM DA QUITAÇÃO COM DESCONTO ======");

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[INTER] Failed to apply settlement discount:", error);
      res.status(500).json({
        error: "Falha ao aplicar desconto de quitação",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Debug endpoint to check Inter Bank credentials (temporary)
 * GET /api/inter/debug-credentials
 */
router.get("/debug-credentials", async (req, res) => {
  try {
    const credentials = {
      clientId: process.env.CLIENT_ID
        ? "✅ Present (" + process.env.CLIENT_ID.substring(0, 8) + "...)"
        : "❌ Missing",
      clientSecret: process.env.CLIENT_SECRET
        ? "✅ Present (" + process.env.CLIENT_SECRET.substring(0, 8) + "...)"
        : "❌ Missing",
      certificate: process.env.CERTIFICATE
        ? "✅ Present (" + process.env.CERTIFICATE.length + " chars)"
        : "❌ Missing",
      privateKey: process.env.PRIVATE_KEY
        ? "✅ Present (" + process.env.PRIVATE_KEY.length + " chars)"
        : "❌ Missing",
      contaCorrente: process.env.CONTA_CORRENTE
        ? "✅ Present (" + process.env.CONTA_CORRENTE + ")"
        : "❌ Missing",
      environment: process.env.CONTA_CORRENTE ? "production" : "sandbox",
      apiUrl: process.env.CONTA_CORRENTE
        ? "https://cdpj.partners.bancointer.com.br"
        : "https://cdpj-sandbox.partners.uatinter.co",
    };

    // Test connection
    const isConnected = await interBankService.testConnection();

    res.json({
      credentials,
      connectionTest: isConnected,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to check credentials",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Debug endpoint to check certificate format
 * GET /api/inter/debug-certificate-format
 */
/**
 * Test OAuth2 authentication directly
 * GET /api/inter/test-auth
 */
router.get("/test-auth", async (req, res) => {
  try {
    console.log("[INTER] Testing OAuth2 authentication...");

    // Get credentials directly from environment
    const config = {
      clientId: process.env.CLIENT_ID || "",
      clientSecret: process.env.CLIENT_SECRET || "",
      certificate: process.env.CERTIFICATE || "",
      privateKey: process.env.PRIVATE_KEY || "",
      contaCorrente: process.env.CONTA_CORRENTE || "",
    };

    // Log config status
    console.log("[INTER] Config status:");
    console.log(`  - Client ID: ${config.clientId ? "Present" : "Missing"}`);
    console.log(`  - Client Secret: ${config.clientSecret ? "Present" : "Missing"}`);
    console.log(`  - Certificate: ${config.certificate ? "Present" : "Missing"}`);
    console.log(`  - Private Key: ${config.privateKey ? "Present" : "Missing"}`);

    // Try to get token
    const token = await interBankService.testConnection();

    res.json({
      success: token,
      config: {
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasCertificate: !!config.certificate,
        hasPrivateKey: !!config.privateKey,
        hasContaCorrente: !!config.contaCorrente,
      },
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Auth test failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: getBrasiliaTimestamp(),
    });
  }
});

router.get("/debug-certificate-format", async (req, res) => {
  console.log("[INTER] 🔍 Debug certificate format endpoint called");
  try {
    const cert = process.env.CERTIFICATE || "";
    const key = process.env.PRIVATE_KEY || "";

    // Check certificate format
    const certInfo = {
      length: cert.length,
      first100Chars: cert.substring(0, 100),
      last50Chars: cert.substring(cert.length - 50),
      hasBeginCert: cert.includes("-----BEGIN CERTIFICATE-----"),
      hasEndCert: cert.includes("-----END CERTIFICATE-----"),
      hasBeginTag: cert.includes("-----BEGIN"),
      hasNewlines: cert.includes("\n"),
      isBase64: /^[A-Za-z0-9+/=]+$/.test(cert.replace(/\s/g, "")),
    };

    // Check key format
    const keyInfo = {
      length: key.length,
      first100Chars: key.substring(0, 100),
      last50Chars: key.substring(key.length - 50),
      hasBeginKey: key.includes("-----BEGIN") && key.includes("PRIVATE KEY"),
      hasEndKey: key.includes("-----END") && key.includes("PRIVATE KEY"),
      hasBeginTag: key.includes("-----BEGIN"),
      hasNewlines: key.includes("\n"),
      isBase64: /^[A-Za-z0-9+/=]+$/.test(key.replace(/\s/g, "")),
    };

    // Try to decode from base64 to see what's inside
    let decodedCertPreview = "";
    let decodedKeyPreview = "";

    try {
      if (certInfo.isBase64 && !certInfo.hasBeginTag) {
        const decoded = Buffer.from(cert, "base64").toString("utf-8");
        decodedCertPreview = decoded.substring(0, 200);
      }
    } catch (e) {
      decodedCertPreview = "Failed to decode certificate from base64";
    }

    try {
      if (keyInfo.isBase64 && !keyInfo.hasBeginTag) {
        const decoded = Buffer.from(key, "base64").toString("utf-8");
        decodedKeyPreview = decoded.substring(0, 200);
      }
    } catch (e) {
      decodedKeyPreview = "Failed to decode key from base64";
    }

    res.json({
      certificate: certInfo,
      privateKey: keyInfo,
      decodedCertPreview,
      decodedKeyPreview,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Debug certificate format error:", error);
    res.status(500).json({
      error: "Failed to check certificate format",
      details: (error as Error).message,
    });
  }
});

/**
 * Create collection (boleto/PIX) for a proposal
 * POST /api/inter/collections
 */
router.post("/collections", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createCollectionSchema.parse(req.body);

    console.log(`[INTER] Creating collection for proposal: ${validatedData.proposalId}`);

    // Verificar se já existe boleto ativo para esta proposta
    const existingCollections = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, validatedData.proposalId));

    // Filtrar apenas boletos ativos (não pagos, não cancelados)
    const activeCollections = existingCollections.filter(
      col => col.isActive === true && 
             (col.situacao === "NORMAL" || col.situacao === "EM_ABERTO" || !col.situacao)
    );

    if (activeCollections.length > 0) {
      console.log(
        `[INTER] 🚫 BLOQUEIO: Encontrados ${activeCollections.length} boletos ativos para proposta ${validatedData.proposalId}`
      );
      console.log(`[INTER] 🚫 Boletos ativos existentes:`, activeCollections.map(col => ({
        codigo: col.codigoSolicitacao,
        valor: col.valorNominal,
        situacao: col.situacao,
        isActive: col.isActive,
        numeroParcela: col.numeroParcela
      })));
      return res.status(409).json({
        success: false,
        error: "Boleto ativo encontrado",
        message:
          `Já existem ${activeCollections.length} boletos ativos (não pagos) para esta proposta. Aguarde o pagamento ou cancele os boletos anteriores.`,
        existingCollections: activeCollections.map(col => ({
          codigo: col.codigoSolicitacao,
          valor: col.valorNominal,
          vencimento: col.dataVencimento,
          situacao: col.situacao || "EM_ABERTO",
        })),
      });
    }

    // Buscar dados da proposta para obter o prazo (número de parcelas)
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, parseInt(validatedData.proposalId)))
      .limit(1);

    if (!proposta) {
      return res.status(404).json({
        success: false,
        error: "Proposta não encontrada",
      });
    }

    // Parse dos dados da proposta
    const condicoesData =
      typeof proposta.condicoesData === "string"
        ? JSON.parse(proposta.condicoesData)
        : proposta.condicoesData;

    const prazo = condicoesData?.prazo || 1;
    const valorParcela = validatedData.valorTotal / prazo;

    console.log(`[INTER] ✅ AUTORIZADO: Criando ${prazo} boletos de R$ ${valorParcela.toFixed(2)} cada para proposta ${validatedData.proposalId}`);
    console.log(`[INTER] 📊 Detalhes: prazo=${prazo}, valorTotal=${validatedData.valorTotal}, valorParcela=${valorParcela.toFixed(2)}`);

    const createdCollections = [];
    const errors = [];

    // Criar um boleto para cada parcela
    for (let i = 0; i < prazo; i++) {
      try {
        // Calcular data de vencimento para cada parcela (mensal)
        const dataVencimento = new Date(validatedData.dataVencimento);
        dataVencimento.setMonth(dataVencimento.getMonth() + i);

        console.log(
          `[INTER] Criando boleto ${i + 1}/${prazo} - Vencimento: ${dataVencimento.toISOString().split("T")[0]}`
        );

        // Create collection via Inter API
        const collectionResponse = await interBankService.criarCobrancaParaProposta({
          id: `${validatedData.proposalId}-${i + 1}`, // ID único para cada parcela
          valorTotal: valorParcela, // Usar valor da parcela
          dataVencimento: dataVencimento.toISOString().split("T")[0],
          clienteData: validatedData.clienteData,
        });

        // Fetch full collection details
        const collectionDetails = await interBankService.recuperarCobranca(
          collectionResponse.codigoSolicitacao
        );

        // Store collection data in database
        await db.insert(interCollections).values({
          propostaId: validatedData.proposalId,
          codigoSolicitacao: collectionResponse.codigoSolicitacao,
          seuNumero: collectionDetails.cobranca.seuNumero,
          valorNominal: collectionDetails.cobranca.valorNominal.toString(),
          dataVencimento: collectionDetails.cobranca.dataVencimento,
          situacao: collectionDetails.cobranca.situacao,
          dataSituacao: collectionDetails.cobranca.dataSituacao,
          nossoNumero: collectionDetails.boleto?.nossoNumero,
          codigoBarras: collectionDetails.boleto?.codigoBarras,
          linhaDigitavel: collectionDetails.boleto?.linhaDigitavel,
          pixTxid: collectionDetails.pix?.txid,
          pixCopiaECola: collectionDetails.pix?.pixCopiaECola,

          dataEmissao: collectionDetails.cobranca.dataEmissao,
          origemRecebimento: "BOLETO",
          isActive: true,
          numeroParcela: i + 1,
          totalParcelas: prazo,
        });

        createdCollections.push({
          codigoSolicitacao: collectionResponse.codigoSolicitacao,
          parcela: i + 1,
          valor: valorParcela,
          vencimento: dataVencimento.toISOString().split("T")[0],
        });

        console.log(
          `[INTER] ✅ Boleto ${i + 1}/${prazo} criado: ${collectionResponse.codigoSolicitacao}`
        );
      } catch (error) {
        console.error(`[INTER] ❌ Erro ao criar boleto ${i + 1}:`, error);
        errors.push({
          parcela: i + 1,
          erro: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    console.log(
      `[INTER] ✅ ${createdCollections.length} boletos criados com sucesso, ${errors.length} erros`
    );

    // 🔥 IMPORTANTE: Atualizar proposta marcando que boletos foram gerados
    if (createdCollections.length > 0) {
      console.log(`[INTER] 📌 Atualizando proposta ${validatedData.proposalId} - interBoletoGerado = true`);
      
      await db.update(propostas)
        .set({ 
          interBoletoGerado: true,
          interBoletoGeradoEm: new Date(getBrasiliaTimestamp())
        })
        .where(eq(propostas.id, parseInt(validatedData.proposalId)));
      
      // Criar log da operação
      await storage.createPropostaLog({
        propostaId: validatedData.proposalId, // String, não número
        autorId: req.user?.id || "sistema",
        statusAnterior: proposta.status,
        statusNovo: proposta.status, // Status não muda, apenas marca boleto gerado
        observacao: `✅ ${createdCollections.length} boletos gerados com sucesso pelo Banco Inter`,
      });
      
      console.log(`[INTER] ✅ Proposta atualizada - boletos fixados na timeline`);
    }

    res.json({
      success: true,
      totalCriados: createdCollections.length,
      totalErros: errors.length,
      boletos: createdCollections,
      erros: errors,
      proposalId: validatedData.proposalId,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to create collection:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    // Tratar erro específico do Inter sobre boleto duplicado
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("existe uma cobrança emitida há poucos minutos")) {
      return res.status(409).json({
        success: false,
        error: "Boleto duplicado",
        message:
          "Já existe um boleto ativo para esta proposta. Aguarde o pagamento ou cancelamento do boleto anterior antes de gerar um novo.",
        details: errorMessage,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create collection",
      details: errorMessage,
    });
  }
});

/**
 * Get collection details
 * GET /api/inter/collections/:codigoSolicitacao
 */
router.get(
  "/collections/:codigoSolicitacao",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;

      console.log(`[INTER] Getting collection details: ${codigoSolicitacao}`);

      const collectionDetails = await interBankService.recuperarCobranca(codigoSolicitacao);

      res.json({
        success: true,
        data: collectionDetails,
        timestamp: getBrasiliaTimestamp(),
      });
    } catch (error) {
      console.error("[INTER] Failed to get collection details:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get collection details",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Search collections with filters
 * GET /api/inter/collections
 */
router.get("/collections", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedQuery = searchCollectionsSchema.parse(req.query);

    console.log(
      `[INTER] Searching collections from ${validatedQuery.dataInicial} to ${validatedQuery.dataFinal}`
    );

    const searchResults = await interBankService.pesquisarCobrancas({
      dataInicial: validatedQuery.dataInicial,
      dataFinal: validatedQuery.dataFinal,
      situacao: validatedQuery.situacao,
      pessoaPagadora: validatedQuery.pessoaPagadora,
      seuNumero: validatedQuery.seuNumero,
      itensPorPagina: validatedQuery.limit ? parseInt(validatedQuery.limit) : 100,
      paginaAtual: validatedQuery.page ? parseInt(validatedQuery.page) : 0,
    });

    res.json({
      success: true,
      data: searchResults,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to search collections:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to search collections",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get collection PDF
 * GET /api/inter/collections/:codigoSolicitacao/pdf
 */
router.get(
  "/collections/:codigoSolicitacao/pdf",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;

      console.log(`[INTER] Getting PDF for collection: ${codigoSolicitacao}`);

      const pdfBuffer = await interBankService.obterPdfCobranca(codigoSolicitacao);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="boleto-${codigoSolicitacao}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[INTER] Failed to get PDF:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get collection PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Cancel collection
 * POST /api/inter/collections/:codigoSolicitacao/cancel
 */
router.post(
  "/collections/:codigoSolicitacao/cancel",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;
      const { motivoCancelamento } = req.body;

      if (!motivoCancelamento) {
        return res.status(400).json({
          success: false,
          error: "motivoCancelamento is required",
        });
      }

      console.log(`[INTER] Cancelling collection: ${codigoSolicitacao}`);

      await interBankService.cancelarCobranca(codigoSolicitacao, motivoCancelamento);

      res.json({
        success: true,
        message: "Collection cancelled successfully",
        timestamp: getBrasiliaTimestamp(),
      });
    } catch (error) {
      console.error("[INTER] Failed to cancel collection:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cancel collection",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get collections summary/metrics
 * GET /api/inter/summary
 */
/**
 * Get collections info for a proposal - Calculate remaining debt
 * GET /api/inter/collections/proposal/:propostaId
 */
router.get(
  "/collections/proposal/:propostaId",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;

      // Get proposal data
      const proposta = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, parseInt(propostaId)))
        .limit(1);

      if (proposta.length === 0) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }

      // Get all collections for this proposal
      const boletos = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, propostaId));

      // Calculate remaining debt
      const valorTotal = Number(proposta[0].valorTotalFinanciado) || 0;
      const valorPago = boletos
        .filter(b => b.situacao === "RECEBIDO" || b.situacao === "PAGO")
        .reduce((sum, b) => sum + Number(b.valorTotalRecebido || b.valorNominal), 0);

      const valorRestante = valorTotal - valorPago;

      // Get active boletos
      const boletosAtivos = boletos.filter(
        b => b.isActive && !["RECEBIDO", "PAGO", "CANCELADO"].includes(b.situacao || "")
      );

      res.json({
        valorTotal,
        valorPago,
        valorRestante,
        boletosAtivos: boletosAtivos.map(b => ({
          codigoSolicitacao: b.codigoSolicitacao,
          valor: Number(b.valorNominal),
          dataVencimento: b.dataVencimento,
          situacao: b.situacao,
          numeroParcela: b.numeroParcela,
        })),
        totalBoletosAtivos: boletosAtivos.length,
      });
    } catch (error) {
      console.error("[INTER] Failed to get proposal collections:", error);
      res.status(500).json({
        error: "Falha ao buscar informações de cobrança",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

router.get("/summary", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { dataInicial, dataFinal, filtrarDataPor } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({
        success: false,
        error: "dataInicial and dataFinal are required",
      });
    }

    console.log(`[INTER] Getting collections summary`);

    const summary = await interBankService.obterSumarioCobrancas({
      dataInicial: dataInicial as string,
      dataFinal: dataFinal as string,
      filtrarDataPor: filtrarDataPor as any,
    });

    res.json({
      success: true,
      data: summary,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to get summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get collections summary",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Configure webhook
 * PUT /api/inter/webhook
 */
router.put("/webhook", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { url, eventos } = req.body;

    if (!url || !eventos) {
      return res.status(400).json({
        success: false,
        error: "url and eventos are required",
      });
    }

    console.log(`[INTER] Configuring webhook: ${url}`);

    await interBankService.configurarWebhook({ url, eventos });

    res.json({
      success: true,
      message: "Webhook configured successfully",
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to configure webhook:", error);
    res.status(500).json({
      success: false,
      error: "Failed to configure webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get webhook configuration
 * GET /api/inter/webhook
 */
router.get("/webhook", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Getting webhook configuration`);

    const webhook = await interBankService.obterWebhook();

    res.json({
      success: true,
      data: webhook,
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to get webhook:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get webhook configuration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Delete webhook
 * DELETE /api/inter/webhook
 */
router.delete("/webhook", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`[INTER] Deleting webhook`);

    await interBankService.excluirWebhook();

    res.json({
      success: true,
      message: "Webhook deleted successfully",
      timestamp: getBrasiliaTimestamp(),
    });
  } catch (error) {
    console.error("[INTER] Failed to delete webhook:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Simulate payment (sandbox only)
 * POST /api/inter/collections/:codigoSolicitacao/pay
 */
router.post(
  "/collections/:codigoSolicitacao/pay",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;
      const { valorPago } = req.body;

      if (!valorPago) {
        return res.status(400).json({
          success: false,
          error: "valorPago is required",
        });
      }

      console.log(`[INTER] Simulating payment for collection: ${codigoSolicitacao}`);

      await interBankService.pagarCobrancaSandbox(codigoSolicitacao, valorPago);

      res.json({
        success: true,
        message: "Payment simulated successfully",
        timestamp: getBrasiliaTimestamp(),
      });
    } catch (error) {
      console.error("[INTER] Failed to simulate payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to simulate payment",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Test OAuth2 authentication with undici Agent
 * GET /api/inter/test-auth
 */
router.get("/test-auth", async (req, res) => {
  try {
    console.log("[INTER TEST] Testing OAuth2 authentication with undici Agent...");

    // Force a new token request by clearing cache
    // @ts-ignore - Accessing private property for testing
    interBankService.tokenCache = null;

    // Try to get access token
    // @ts-ignore - Accessing private method for testing
    const token = await interBankService.getAccessToken();

    console.log("[INTER TEST] ✅ Authentication successful!");

    res.json({
      success: true,
      message: "OAuth2 authentication successful with undici Agent!",
      tokenReceived: !!token,
      tokenLength: token ? token.length : 0,
    });
  } catch (error) {
    console.error("[INTER TEST] ❌ Authentication failed:", error);

    res.status(500).json({
      success: false,
      message: "OAuth2 authentication failed",
      error: (error as Error).message,
    });
  }
});

export { router as interRoutes };
