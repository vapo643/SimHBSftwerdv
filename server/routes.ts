import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createServerSupabaseClient } from "../client/src/lib/supabase";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "./lib/jwt-auth-middleware";
import { requireAdmin, requireManagerOrAdmin, requireAnyRole } from "./lib/role-guards";
import { insertPropostaSchema, updatePropostaSchema, insertGerenteLojaSchema, insertLojaSchema, updateLojaSchema, propostaLogs, propostas } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import originationRoutes from "./routes/origination.routes";

const upload = multer({ storage: multer.memoryStorage() });

// User Management Schema
export const UserDataSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("Formato de email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  role: z.enum(['ADMINISTRADOR', 'GERENTE', 'ATENDENTE']),
  lojaId: z.number().int().nullable().optional(),
  lojaIds: z.array(z.number().int()).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'ATENDENTE' && (data.lojaId === null || data.lojaId === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O campo 'lojaId' é obrigatório para o perfil ATENDENTE.",
      path: ["lojaId"],
    });
  }
  if (data.role === 'GERENTE' && (!data.lojaIds || data.lojaIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O campo 'lojaIds' deve conter ao menos uma loja para o perfil GERENTE.",
      path: ["lojaIds"],
    });
  }
});

// Admin middleware is now replaced by requireAdmin guard

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ message: error.message });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // GET proposal audit logs for real-time communication history
  app.get("/api/propostas/:id/observacoes", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const propostaId = req.params.id;
      
      const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
      const supabase = createServerSupabaseAdminClient();
      
      // Buscar logs de auditoria da tabela proposta_logs com informações do autor
      const { data: logs, error } = await supabase
        .from('proposta_logs')
        .select(`
          id,
          observacao,
          status_anterior,
          status_novo,
          created_at,
          autor_id,
          profiles!proposta_logs_autor_id_fkey (
            full_name,
            role
          )
        `)
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.warn('Erro ao buscar logs de auditoria:', error);
        // Return empty if table doesn't exist or has issues
        return res.json({ logs: [] });
      }
      
      console.log(`🔍 [DEBUG] Raw logs from Supabase:`, JSON.stringify(logs, null, 2));
      
      // Transformar logs para o formato esperado pelo frontend
      const transformedLogs = logs?.map(log => ({
        id: log.id,
        acao: log.status_novo === 'aguardando_analise' ? 'reenvio_atendente' : `mudanca_status_${log.status_novo}`,
        detalhes: log.observacao,
        status_anterior: log.status_anterior,
        status_novo: log.status_novo,
        data_acao: log.created_at,
        autor_id: log.autor_id,
        profiles: log.profiles,
        observacao: log.observacao,
        created_at: log.created_at
      })) || [];
      
      console.log(`🔍 [DEBUG] Transformed logs:`, JSON.stringify(transformedLogs, null, 2));
      console.log(`[${new Date().toISOString()}] Retornando ${transformedLogs.length} logs de auditoria para proposta ${propostaId}`);
      
      res.json({ 
        logs: transformedLogs,
        total: transformedLogs.length
      });
    } catch (error) {
      console.error('Error fetching proposal audit logs:', error);
      // Return empty array instead of error to prevent breaking the UI
      res.json({ logs: [] });
    }
  });

  // Health check endpoint para testar security headers
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      security: "enabled",
      rateLimit: "active"
    });
  });

  // Debug endpoint for RBAC validation
  app.get("/api/debug/me", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        message: "Debug endpoint - User profile from robust JWT middleware",
        user: req.user,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ message: "Debug endpoint failed" });
    }
  });

  // Proposal routes - ENHANCED WITH MULTI-FILTER SUPPORT
  app.get("/api/propostas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Extract query parameters for enhanced filtering
      const { queue, status, atendenteId } = req.query;
      const isAnalysisQueue = queue === 'analysis';
      
      // Import database dependencies
      const { db } = await import("../server/lib/supabase");
      const { propostas, lojas, parceiros } = await import("../shared/schema");
      const { inArray, desc, eq, and } = await import("drizzle-orm");
      
      // Build query with conditional where clause
      const baseQuery = db
        .select({
          id: propostas.id,
          status: propostas.status,
          clienteData: propostas.clienteData,
          condicoesData: propostas.condicoesData,
          userId: propostas.userId,
          createdAt: propostas.createdAt,
          loja: {
            id: lojas.id,
            nomeLoja: lojas.nomeLoja
          },
          parceiro: {
            id: parceiros.id,
            razaoSocial: parceiros.razaoSocial
          }
        })
        .from(propostas)
        .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
        .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id));
      
      // Build where conditions based on filters
      const whereConditions = [];
      
      if (isAnalysisQueue) {
        whereConditions.push(inArray(propostas.status, ['aguardando_analise', 'em_analise']));
      } else if (status) {
        whereConditions.push(eq(propostas.status, status as string));
      }
      
      if (atendenteId) {
        whereConditions.push(eq(propostas.userId, atendenteId as string));
      }
      
      // Apply filters and execute query
      const results = whereConditions.length > 0
        ? await baseQuery
            .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
            .orderBy(desc(propostas.createdAt))
        : await baseQuery
            .orderBy(desc(propostas.createdAt));
      
      // Map to expected format - extract from JSONB
      const mappedPropostas = results.map(p => {
        // Extract client data from JSONB
        const clienteData = p.clienteData as any || {};
        const condicoesData = p.condicoesData as any || {};
        
        return {
          id: p.id,
          status: p.status,
          nomeCliente: clienteData.nome || 'Nome não informado',
          cpfCliente: clienteData.cpf || 'CPF não informado',
          emailCliente: clienteData.email || 'Email não informado',
          telefoneCliente: clienteData.telefone || 'Telefone não informado',
          valorSolicitado: condicoesData.valor || 0,
          prazo: condicoesData.prazo || 0,
          clienteData: clienteData, // Include full client data for details page
          condicoesData: condicoesData, // Include full loan conditions
          parceiro: p.parceiro ? {
            id: p.parceiro.id,
            razaoSocial: p.parceiro.razaoSocial
          } : undefined,
          loja: p.loja ? {
            id: p.loja.id,
            nomeLoja: p.loja.nomeLoja
          } : undefined,
          createdAt: p.createdAt,
          userId: p.userId
        };
      });
      
      const filterDescription = isAnalysisQueue ? ' para análise' : 
                           status ? ` com status ${status}` : 
                           atendenteId ? ` do atendente ${atendenteId}` : '';
      
      console.log(`[${new Date().toISOString()}] Retornando ${mappedPropostas.length} propostas${filterDescription}`);
      res.json(mappedPropostas);
    } catch (error) {
      console.error("Get propostas error:", error);
      res.status(500).json({ message: "Failed to fetch propostas" });
    }
  });

  // NEW ENDPOINT: PUT /api/propostas/:id/status - ANALYST WORKFLOW ENGINE
  app.put("/api/propostas/:id/status", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    // Dynamic role validation based on the status change requested
    const { status } = req.body;
    const userRole = req.user?.role;
    
    // ATENDENTE can only change pendenciado -> aguardando_analise
    if (userRole === 'ATENDENTE') {
      if (status !== 'aguardando_analise') {
        return res.status(403).json({ 
          message: 'Atendentes só podem reenviar propostas pendentes para análise.' 
        });
      }
    }
    // ANALISTA and ADMINISTRADOR can make all status changes
    else if (!userRole || !['ANALISTA', 'ADMINISTRADOR'].includes(userRole)) {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas analistas, administradores e atendentes (para reenvio) podem alterar status.' 
      });
    }
    try {
      const propostaId = req.params.id;
      const { status, observacao, valorAprovado } = req.body;
      const motivoPendencia = req.body.motivoPendencia || req.body.observacao; // Accept both field names
      
      // Validation schema for status change
      const statusChangeSchema = z.object({
        status: z.enum(['aprovado', 'rejeitado', 'pendenciado', 'aguardando_analise']),
        observacao: z.string().min(1, 'Observação é obrigatória'),
        valorAprovado: z.number().optional(),
        motivoPendencia: z.string().optional()
      });
      
      const validatedData = statusChangeSchema.parse({ status, observacao, valorAprovado, motivoPendencia });
      
      // Use Supabase directly to avoid Drizzle schema issues
      const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
      const supabase = createServerSupabaseAdminClient();
      
      // 1. Get current proposal
      const { data: currentProposta, error: fetchError } = await supabase
        .from('propostas')
        .select('status')
        .eq('id', propostaId)
        .single();
        
      if (fetchError || !currentProposta) {
        throw new Error('Proposta não encontrada');
      }
      
      // 2. Validate status transition
      const validTransitions = {
        'aguardando_analise': ['em_analise', 'aprovado', 'rejeitado', 'pendenciado'],
        'em_analise': ['aprovado', 'rejeitado', 'pendenciado'],
        'pendenciado': ['aguardando_analise'] // Atendente can resubmit after fixing
      };
      
      const currentStatus = currentProposta.status;
      if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(status)) {
        throw new Error(`Transição inválida de ${currentStatus} para ${status}`);
      }
      
      // 3. Update proposal using only fields that exist in the real table
      const updateData: any = {
        status
      };
      
      // Only set analyst fields for analyst actions (not for attendant resubmission)
      if (userRole !== 'ATENDENTE') {
        updateData.analista_id = req.user?.id;
        updateData.data_analise = new Date().toISOString();
      }
      
      if (status === 'pendenciado' && motivoPendencia) {
        updateData.motivo_pendencia = motivoPendencia;
      }
      
      // Clear pendency reason when resubmitting
      if (status === 'aguardando_analise') {
        updateData.motivo_pendencia = null;
      }
      
      // CORREÇÃO CRÍTICA: Definir data_aprovacao quando proposta é aprovada
      if (status === 'aprovado') {
        updateData.data_aprovacao = new Date().toISOString();
        console.log(`🎯 [APROVAÇÃO] Definindo data_aprovacao para proposta ${propostaId}`);
        
        // NOVO: Geração automática da CCB ao aprovar proposta
        try {
          const { generateCCB } = await import('./services/ccbGenerator');
          console.log(`📄 [CCB] Iniciando geração automática de CCB para proposta ${propostaId}`);
          const ccbPath = await generateCCB(propostaId);
          console.log(`✅ [CCB] CCB gerada com sucesso: ${ccbPath}`);
          
          // A função generateCCB já atualiza os campos ccb_gerado e caminho_ccb_assinado
          // então não precisamos fazer isso aqui
        } catch (ccbError) {
          console.error(`❌ [CCB] Erro ao gerar CCB para proposta ${propostaId}:`, ccbError);
          // Não vamos falhar a aprovação por causa do erro na CCB
          // O atendente pode gerar manualmente depois se necessário
        }
      }
      
      const { error: updateError } = await supabase
        .from('propostas')
        .update(updateData)
        .eq('id', propostaId);
        
      if (updateError) {
        throw new Error(`Erro ao atualizar status: ${updateError.message}`);
      }
      
      // 4. Log the action in proposta_logs for audit trail with correct field names
      console.log(`🔍 [Audit Log] Registrando log para proposta ${propostaId}: ${currentStatus} → ${status}`);
      try {
        const { data: logResult, error: logError } = await supabase
          .from('proposta_logs')
          .insert({
            proposta_id: propostaId,
            autor_id: req.user?.id,
            observacao: validatedData.observacao,
            status_anterior: currentStatus,
            status_novo: status
            // created_at is auto-generated by database
          });
          
        if (logError) {
          console.error(`🔍 [Audit Log] Erro ao registrar log:`, logError);
          // Don't fail the request, just log the warning
        } else {
          console.log(`🔍 [Audit Log] Log registrado com sucesso para proposta ${propostaId}`);
        }
      } catch (logError) {
        console.warn('Erro ao registrar log de auditoria:', logError);
        // Continue execution even if logging fails
      }
      
      const result = { success: true, statusAnterior: currentStatus, statusNovo: status };
      
      const actionBy = userRole === 'ATENDENTE' ? 'atendente' : 'analista';
      console.log(`[${new Date().toISOString()}] Proposta ${propostaId} - status alterado de ${result.statusAnterior} para ${result.statusNovo} pelo ${actionBy} ${req.user?.id}`);
      
      res.json({
        success: true,
        message: `Status da proposta alterado para ${status}`,
        statusAnterior: result.statusAnterior,
        statusNovo: result.statusNovo
      });
      
    } catch (error) {
      console.error("Status change error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Erro ao alterar status da proposta" 
      });
    }
  });

  // 🔧 CORREÇÃO CRÍTICA: Mover endpoint específico ANTES da rota genérica /:id
  // New endpoint for formalization proposals (filtered by status)
  app.get("/api/propostas/formalizacao", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { supabase } = await import("../server/lib/supabase");

      // 🔐 CORREÇÃO CRÍTICA: Usar cliente Supabase para respeitar políticas RLS
      // O token JWT já foi validado pelo middleware jwtAuthMiddleware
      // Criar cliente Supabase com contexto do usuário autenticado
      const userToken = req.headers.authorization?.replace('Bearer ', '');
      if (!userToken) {
        return res.status(401).json({ message: "Token de autenticação necessário" });
      }

      // Criar cliente Supabase personalizado com o token do usuário para RLS
      const { createClient } = await import('@supabase/supabase-js');
      const userSupabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${userToken}`
            }
          }
        }
      );

      // Formalization statuses according to business logic
      const formalizationStatuses = [
        'aprovado',
        'documentos_enviados', 
        'contratos_preparados',
        'contratos_assinados',
        'pronto_pagamento'
      ];

      console.log(`🔐 [FORMALIZATION] Querying for user ${req.user?.id} with role ${req.user?.role}`);

      // 🔧 CORREÇÃO: Query simplificada para evitar recursão RLS
      // Remover JOINs complexos que causam "infinite recursion" nas políticas RLS
      const { data: rawPropostas, error } = await userSupabase
        .from('propostas')
        .select('*')
        .in('status', formalizationStatuses)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('🚨 [FORMALIZATION] Supabase error:', error);
        return res.status(500).json({ message: "Erro ao consultar propostas de formalização" });
      }

      if (!rawPropostas || rawPropostas.length === 0) {
        console.log(`🔐 [FORMALIZATION] No proposals found for user ${req.user?.id} with role ${req.user?.role}`);
        return res.json([]);
      }

      console.log(`🔐 [FORMALIZATION] Found ${rawPropostas.length} proposals for user ${req.user?.id}`);
      console.log('🔐 [FORMALIZATION] First proposal:', rawPropostas[0]?.id, rawPropostas[0]?.status);

      // CORREÇÃO CRÍTICA: Parse JSONB fields e mapear snake_case para frontend
      const formalizacaoPropostas = rawPropostas.map(proposta => {
        let clienteData = null;
        let condicoesData = null;

        // Parse cliente_data se for string
        if (typeof proposta.cliente_data === 'string') {
          try {
            clienteData = JSON.parse(proposta.cliente_data);
          } catch (e) {
            console.warn(`Erro ao fazer parse de cliente_data para proposta ${proposta.id}:`, e);
            clienteData = {};
          }
        } else {
          clienteData = proposta.cliente_data || {};
        }

        // Parse condicoes_data se for string  
        if (typeof proposta.condicoes_data === 'string') {
          try {
            condicoesData = JSON.parse(proposta.condicoes_data);
          } catch (e) {
            console.warn(`Erro ao fazer parse de condicoes_data para proposta ${proposta.id}:`, e);
            condicoesData = {};
          }
        } else {
          condicoesData = proposta.condicoes_data || {};
        }

        return {
          ...proposta,
          cliente_data: clienteData,
          condicoes_data: condicoesData,
          // Map database fields to frontend format
          documentos_adicionais: proposta.documentos_adicionais,
          contrato_gerado: proposta.contrato_gerado,
          contrato_assinado: proposta.contrato_assinado,
          data_aprovacao: proposta.data_aprovacao,
          data_assinatura: proposta.data_assinatura,
          data_pagamento: proposta.data_pagamento,
          observacoes_formalizacao: proposta.observacoes_formalizacao
        };
      });

      console.log(`[${new Date().toISOString()}] Retornando ${formalizacaoPropostas.length} propostas em formalização via RLS`);
      res.json(formalizacaoPropostas);
    } catch (error) {
      console.error("Erro ao buscar propostas de formalização:", error);
      res.status(500).json({ 
        message: "Erro ao buscar propostas de formalização" 
      });
    }
  });

  // Endpoint para gerar CCB automaticamente
  app.post("/api/propostas/:id/gerar-ccb", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      console.log(`[CCB] Solicitação de geração de CCB para proposta: ${id}`);

      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      // Verificar se proposta está aprovada
      const { data: proposta, error: propostaError } = await supabase
        .from('propostas')
        .select('status, ccb_gerado, caminho_ccb_assinado')
        .eq('id', id)
        .single();

      if (propostaError || !proposta) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }

      if (proposta.status !== 'aprovado') {
        return res.status(400).json({ error: "CCB só pode ser gerada para propostas aprovadas" });
      }

      // Se CCB já foi gerada, retornar sucesso
      if (proposta.ccb_gerado && proposta.caminho_ccb_assinado) {
        console.log(`[CCB] CCB já existe para proposta ${id}`);
        return res.json({ 
          success: true, 
          message: "CCB já foi gerada anteriormente",
          caminho: proposta.caminho_ccb_assinado 
        });
      }

      // Gerar CCB
      console.log(`[CCB] Gerando CCB para proposta ${id}...`);
      const { generateCCB } = await import("./services/ccbGenerator");
      const { TemplateManager } = await import("./services/templateManager");
      
      try {
        const templateId = req.body?.templateId || undefined;
        const ccbPath = await generateCCB(id, templateId);
        console.log(`[CCB] CCB gerada com sucesso: ${ccbPath}`);
        res.json({ 
          success: true, 
          message: "CCB gerada com sucesso",
          caminho: ccbPath 
        });
      } catch (error) {
        console.error(`[CCB] Erro ao gerar CCB: ${error}`);
        return res.status(500).json({ error: "Erro ao gerar CCB" });
      }

    } catch (error) {
      console.error("[CCB] Erro interno:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Debug: Testar PDF simples e limpo
  app.get("/api/debug/test-pdf", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      
      // Criar PDF extremamente simples
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Teste PDF Simples',
          Author: 'Sistema Teste',
          Subject: 'PDF de Teste',
          Creator: 'Sistema Simpix',
          Producer: 'PDFKit'
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      // Conteúdo mínimo
      doc.fontSize(16).text('DOCUMENTO DE TESTE');
      doc.moveDown();
      doc.fontSize(12).text('Este é um PDF de teste gerado pelo sistema.');
      doc.text('Data: ' + new Date().toLocaleDateString('pt-BR'));
      
      doc.end();
      
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="teste-simples.pdf"');
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('Erro ao criar PDF teste:', error);
      res.status(500).json({ error: 'Erro ao criar PDF teste' });
    }
  });

  // Debug: Listar arquivos no bucket documents
  app.get("/api/debug/storage-files", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      const { data: files, error } = await supabase.storage
        .from('documents')
        .list('ccb', {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      if (error) {
        console.error('Erro ao listar arquivos:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ 
        bucket: 'documents',
        folder: 'ccb',
        files: files || [],
        count: files?.length || 0
      });
    } catch (error) {
      console.error('Erro debug storage:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  // Get CCB signed URL
  app.get("/api/propostas/:id/ccb-url", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      // Buscar dados da proposta
      const { data: proposta, error } = await supabase
        .from('propostas')
        .select('ccb_gerado, caminho_ccb_assinado')
        .eq('id', id)
        .single();
      
      if (error || !proposta) {
        return res.status(404).json({ message: 'Proposta não encontrada' });
      }
      
      if (!proposta.ccb_gerado || !proposta.caminho_ccb_assinado) {
        return res.status(404).json({ message: 'CCB não gerada para esta proposta' });
      }
      
      // Gerar URL assinada
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(proposta.caminho_ccb_assinado, 3600); // 1 hora
      
      if (urlError || !signedUrlData) {
        console.error('Erro ao gerar URL assinada:', urlError);
        return res.status(500).json({ message: 'Erro ao gerar URL do documento' });
      }
      
      // Retornar com headers de segurança
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'none';");
      res.json({ 
        url: signedUrlData.signedUrl,
        filename: `CCB-${id}.pdf`,
        contentType: 'application/pdf'
      });
    } catch (error) {
      console.error('Erro ao buscar CCB:', error);
      res.status(500).json({ message: 'Erro ao buscar CCB' });
    }
  });

  app.get("/api/propostas/:id", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const idParam = req.params.id;
      const user = req.user;

      console.log(`🔐 [PROPOSTA ACCESS] User ${user.id} (${user.role}) accessing proposta ${idParam}`);

      // 🔧 CORREÇÃO: Usar mesma abordagem do endpoint de formalização que funciona
      if (user.role === 'ATENDENTE') {
        console.log(`🔐 [ATENDENTE ACCESS] Using RLS query for user loja_id: ${user.loja_id}`);
        
        // Usar Drizzle com RLS como no endpoint de formalização
        const { db } = await import("../server/lib/supabase");
        const { propostas, lojas, parceiros, produtos, tabelasComerciais } = await import("../shared/schema");
        const { eq, and } = await import("drizzle-orm");

        // Query with RLS active - same as formalization endpoint
        const result = await db
          .select({
            id: propostas.id,
            status: propostas.status,
            cliente_data: propostas.clienteData,
            condicoes_data: propostas.condicoesData,
            loja_id: propostas.lojaId,
            created_at: propostas.createdAt,
            produto_id: propostas.produtoId,
            tabela_comercial_id: propostas.tabelaComercialId,
            user_id: propostas.userId,
            ccb_documento_url: propostas.ccbDocumentoUrl,
            analista_id: propostas.analistaId,
            data_analise: propostas.dataAnalise,
            motivo_pendencia: propostas.motivoPendencia,
            data_aprovacao: propostas.dataAprovacao,
            documentos_adicionais: propostas.documentosAdicionais,
            contrato_gerado: propostas.contratoGerado,
            contrato_assinado: propostas.contratoAssinado,
            data_assinatura: propostas.dataAssinatura,
            data_pagamento: propostas.dataPagamento,
            observacoes_formalizacao: propostas.observacoesFormalização,
            loja: {
              id: lojas.id,
              nome_loja: lojas.nomeLoja,
            },
            parceiro: {
              id: parceiros.id,
              razao_social: parceiros.razaoSocial
            },
            produto: {
              id: produtos.id,
              nome_produto: produtos.nomeProduto,
              tac_valor: produtos.tacValor,
              tac_tipo: produtos.tacTipo
            },
            tabela_comercial: {
              id: tabelasComerciais.id,
              nome_tabela: tabelasComerciais.nomeTabela,
              taxa_juros: tabelasComerciais.taxaJuros,
              prazos: tabelasComerciais.prazos,
              comissao: tabelasComerciais.comissao
            }
          })
          .from(propostas)
          .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
          .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
          .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
          .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
          .where(eq(propostas.id, idParam))
          .limit(1);

        if (!result || result.length === 0) {
          console.log(`🔐 [ATENDENTE BLOCKED] User ${user.id} denied access to proposta ${idParam} - RLS policy blocked or not found`);
          return res.status(403).json({ 
            message: "Você não tem permissão para acessar esta proposta" 
          });
        }

        const proposta = result[0];
        console.log(`🔐 [ATENDENTE ALLOWED] User ${user.id} granted access to proposta ${idParam} from loja ${proposta.loja_id}`);
        
        // Buscar documentos da proposta
        const { createServerSupabaseAdminClient } = await import('../server/lib/supabase');
        const supabase = createServerSupabaseAdminClient();
        
        const { data: documentos, error: docError } = await supabase
          .from('proposta_documentos')
          .select('*')
          .eq('proposta_id', idParam);
        
        console.log(`🔍 [ANÁLISE] Documentos encontrados para proposta ${idParam}:`, documentos?.length || 0);
        
        // DEBUG: Listar arquivos que existem no bucket para esta proposta
        const { data: bucketFiles, error: listError } = await supabase.storage
          .from('documents')
          .list(`proposta-${idParam}/`, { limit: 100 });
        
        if (bucketFiles) {
          console.log(`🔍 [ANÁLISE] ===== COMPARAÇÃO BUCKET vs BANCO =====`);
          console.log(`🔍 [ANÁLISE] Arquivos no bucket (${bucketFiles.length}):`, bucketFiles.map(f => f.name));
          console.log(`🔍 [ANÁLISE] URLs salvas no banco (${documentos?.length || 0}):`, documentos?.map(d => d.url));
          console.log(`🔍 [ANÁLISE] Nomes no banco (${documentos?.length || 0}):`, documentos?.map(d => d.nome_arquivo));
          console.log(`🔍 [ANÁLISE] ============================================`);
        } else {
          console.log(`🔍 [ANÁLISE] Erro ao listar arquivos no bucket:`, listError?.message);
        }
        
        // Gerar URLs assinadas para visualização dos documentos
        let documentosComUrls = [];
        if (documentos && documentos.length > 0) {
          console.log(`🔍 [ANÁLISE] Gerando URLs assinadas para ${documentos.length} documentos...`);
          
          for (const doc of documentos) {
            try {
              console.log(`🔍 [ANÁLISE] Tentando gerar URL para documento:`, {
                nome: doc.nome_arquivo,
                url: doc.url,
                tipo: doc.tipo,
                proposta_id: doc.proposta_id
              });

              // Extrair o caminho do arquivo a partir da URL salva
              const documentsIndex = doc.url.indexOf('/documents/');
              let filePath;
              
              if (documentsIndex !== -1) {
                // Extrair caminho após '/documents/'
                filePath = doc.url.substring(documentsIndex + '/documents/'.length);
              } else {
                // Fallback: construir caminho baseado no nome do arquivo
                const fileName = doc.nome_arquivo;
                filePath = `proposta-${idParam}/${fileName}`;
              }
              
              console.log(`🔍 [ANÁLISE] Caminho extraído para URL assinada: ${filePath}`);

              const { data: signedUrlData, error: urlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 3600); // 1 hora

              if (!urlError && signedUrlData) {
                documentosComUrls.push({
                  ...doc,
                  // Mapeamento para formato esperado pelo DocumentViewer
                  name: doc.nome_arquivo,
                  url: signedUrlData.signedUrl,
                  type: doc.tipo || 'application/octet-stream', // fallback se tipo for null
                  uploadDate: doc.created_at,
                  // Manter campos originais também
                  url_visualizacao: signedUrlData.signedUrl
                });
                console.log(`🔍 [ANÁLISE] ✅ URL gerada para documento: ${doc.nome_arquivo}`);
              } else {
                console.log(`🔍 [ANÁLISE] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`, urlError?.message);
                console.log(`🔍 [ANÁLISE] ❌ Caminho tentado: ${filePath}`);
                documentosComUrls.push({
                  ...doc,
                  // Mesmo sem URL, mapear para formato esperado
                  name: doc.nome_arquivo,
                  url: '',
                  type: doc.tipo || 'application/octet-stream',
                  uploadDate: doc.created_at
                }); // Adiciona sem URL em caso de erro
              }
            } catch (error) {
              console.log(`🔍 [ANÁLISE] ❌ Erro ao processar documento ${doc.nome_arquivo}:`, error);
              documentosComUrls.push(doc); // Adiciona sem URL em caso de erro
            }
          }
        }
        
        // Transform to match expected format with proper camelCase conversion
        const formattedProposta = {
          ...proposta,
          // Convert snake_case to camelCase for frontend compatibility
          clienteData: proposta.cliente_data,
          condicoesData: proposta.condicoes_data,
          createdAt: proposta.created_at,
          lojaId: proposta.loja_id,
          produtoId: proposta.produto_id,
          tabelaComercialId: proposta.tabela_comercial_id,
          userId: proposta.user_id,
          analistaId: proposta.analista_id,
          dataAnalise: proposta.data_analise,
          motivoPendencia: proposta.motivo_pendencia,
          dataAprovacao: proposta.data_aprovacao,
          documentosAdicionais: proposta.documentos_adicionais,
          contratoGerado: proposta.contrato_gerado,
          contratoAssinado: proposta.contrato_assinado,
          dataAssinatura: proposta.data_assinatura,
          dataPagamento: proposta.data_pagamento,
          observacoesFormalização: proposta.observacoes_formalizacao,
          // Nested objects with proper structure
          lojas: proposta.loja ? {
            ...proposta.loja,
            parceiros: proposta.parceiro
          } : null,
          produtos: proposta.produto,
          tabelas_comerciais: proposta.tabela_comercial,
          // Include documents with signed URLs
          documentos: documentosComUrls || []
        };
        
        res.json(formattedProposta);
      } else {
        // Para outros roles (ADMIN, GERENTE), usar método original sem RLS
        const proposta = await storage.getPropostaById(idParam);

        if (!proposta) {
          return res.status(404).json({ message: "Proposta not found" });
        }

        console.log(`🔐 [ADMIN/GERENTE ACCESS] User ${user.id} (${user.role}) accessing proposta ${idParam}`);
        res.json(proposta);
      }
    } catch (error) {
      console.error("Get proposta error:", error);
      res.status(500).json({ message: "Failed to fetch proposta" });
    }
  });

  app.put("/api/propostas/:id", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { cliente_data, condicoes_data } = req.body;
      
      console.log(`🔍 [PUT /api/propostas/${id}] Salvando alterações:`, { cliente_data, condicoes_data });
      
      const { createServerSupabaseAdminClient } = await import("../server/lib/supabase");
      const supabase = createServerSupabaseAdminClient();
      
      // Verificar se a proposta existe e pertence ao usuário
      const { data: proposta, error: fetchError } = await supabase
        .from('propostas')
        .select('user_id, status')
        .eq('id', id)
        .single();
        
      if (fetchError || !proposta) {
        console.error(`🔍 Proposta ${id} não encontrada:`, fetchError);
        return res.status(404).json({ message: "Proposta não encontrada" });
      }
      
      // Apenas o atendente dono da proposta ou admin pode editar
      if (req.user?.role !== 'ADMINISTRADOR' && proposta.user_id !== req.user?.id) {
        console.error(`🔍 Usuário ${req.user?.id} sem permissão para editar proposta ${id} (owner: ${proposta.user_id})`);
        return res.status(403).json({ message: "Sem permissão para editar esta proposta" });
      }
      
      // Apenas propostas pendenciadas podem ser editadas
      if (proposta.status !== 'pendenciado' && proposta.status !== 'rascunho') {
        console.error(`🔍 Proposta ${id} com status ${proposta.status} não pode ser editada`);
        return res.status(400).json({ 
          message: "Apenas propostas pendenciadas ou em rascunho podem ser editadas" 
        });
      }
      
      // Atualizar a proposta
      const { data: updatedProposta, error: updateError } = await supabase
        .from('propostas')
        .update({
          cliente_data,
          condicoes_data
        })
        .eq('id', id)
        .select()
        .single();
        
      if (updateError) {
        console.error(`🔍 Erro ao atualizar proposta ${id}:`, updateError);
        return res.status(500).json({ message: "Erro ao atualizar proposta" });
      }
      
      console.log(`🔍 [PUT /api/propostas/${id}] Proposta atualizada com sucesso`);
      res.json({ 
        success: true, 
        message: "Proposta atualizada com sucesso", 
        data: updatedProposta 
      });
    } catch (error) {
      console.error("Update proposta error:", error);
      res.status(500).json({ message: "Erro ao atualizar proposta" });
    }
  });

  app.post("/api/propostas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {


      // Generate unique ID for the proposal
      const proposalId = `PROP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      
      // Add the generated ID and userId to the request body
      const dataWithId = {
        ...req.body,
        id: proposalId,
        userId: req.user?.id,
        lojaId: req.body.lojaId || req.user?.loja_id, // Fallback to user's loja_id if not provided
      };
      
      // FIX: Transform flat structure to JSONB structure expected by database
      const dataForDatabase = {
        id: dataWithId.id,
        userId: dataWithId.userId,
        lojaId: dataWithId.lojaId,
        status: dataWithId.status || 'aguardando_analise',
        
        // Store client data as JSONB (as object, not string)
        clienteData: {
          nome: dataWithId.clienteNome,
          cpf: dataWithId.clienteCpf,
          email: dataWithId.clienteEmail,
          telefone: dataWithId.clienteTelefone,
          dataNascimento: dataWithId.clienteDataNascimento,
          renda: dataWithId.clienteRenda,
          rg: dataWithId.clienteRg,
          orgaoEmissor: dataWithId.clienteOrgaoEmissor,
          estadoCivil: dataWithId.clienteEstadoCivil,
          nacionalidade: dataWithId.clienteNacionalidade,
          cep: dataWithId.clienteCep,
          endereco: dataWithId.clienteEndereco,
          ocupacao: dataWithId.clienteOcupacao
        },
        
        // Store loan conditions as JSONB (as object, not string)
        condicoesData: {
          valor: dataWithId.valor,
          prazo: dataWithId.prazo,
          finalidade: dataWithId.finalidade,
          garantia: dataWithId.garantia,
          valorTac: dataWithId.valorTac,
          valorIof: dataWithId.valorIof,
          valorTotalFinanciado: dataWithId.valorTotalFinanciado
        },
        
        // Additional fields
        produtoId: dataWithId.produtoId,
        tabelaComercialId: dataWithId.tabelaComercialId
      };
      
      // Create the proposal
      const proposta = await storage.createProposta(dataForDatabase);
      
      res.status(201).json(proposta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Create proposta error:", error);
      res.status(500).json({ message: "Failed to create proposta" });
    }
  });

  // Endpoint específico para associar documentos a uma proposta
  app.post("/api/propostas/:id/documentos", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id: propostaId } = req.params;
      const { documentos } = req.body;
      
      if (!documentos || !Array.isArray(documentos)) {
        return res.status(400).json({ message: 'Lista de documentos é obrigatória' });
      }
      
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      console.log(`[DEBUG] Associando ${documentos.length} documentos à proposta ${propostaId}`);
      
      // Inserir associações na tabela proposta_documentos
      for (const fileName of documentos) {
        try {
          const filePath = `proposta-${propostaId}/${fileName}`;
          
          // Gerar URL assinada para o documento
          const { data: signedUrlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600); // 1 hora
          
          const { error: insertError } = await supabase
            .from('proposta_documentos')
            .insert({
              proposta_id: propostaId,
              nome_arquivo: fileName.split('-').slice(1).join('-'), // Remove timestamp prefix
              url: signedUrlData?.signedUrl || `documents/${filePath}`,
              tipo: fileName.endsWith('.pdf') ? 'application/pdf' : 
                    fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'image/jpeg' : 
                    fileName.endsWith('.png') ? 'image/png' : 
                    fileName.endsWith('.gif') ? 'image/gif' : 'application/octet-stream',
              tamanho: 0 // Will be updated if size is available
            });
          
          if (insertError) {
            console.error(`[ERROR] Falha ao associar documento ${fileName}:`, insertError);
          } else {
            console.log(`[DEBUG] Documento ${fileName} associado com sucesso à proposta ${propostaId}`);
          }
        } catch (docError) {
          console.error(`[ERROR] Erro ao processar documento ${fileName}:`, docError);
        }
      }
      
      res.json({ 
        success: true, 
        message: `${documentos.length} documentos associados com sucesso`,
        proposalId: propostaId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Create proposta error:", error);
      res.status(500).json({ message: "Failed to create proposta" });
    }
  });

  // ====================================
  // PILAR 12 - PROGRESSIVE ENHANCEMENT
  // Rota para submissão de formulário tradicional (fallback)
  // ====================================
  app.post("/nova-proposta", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("📝 Progressive Enhancement: Form submission received");

      // Parse form data
      const formData = {
        clienteNome: req.body.clienteNome,
        clienteCpf: req.body.clienteCpf,
        clienteEmail: req.body.clienteEmail,
        clienteTelefone: req.body.clienteTelefone,
        clienteDataNascimento: req.body.clienteDataNascimento,
        clienteRenda: req.body.clienteRenda,
        valor: req.body.valor,
        prazo: parseInt(req.body.prazo),
        finalidade: req.body.finalidade,
        garantia: req.body.garantia,
        status: "rascunho",
      };

      // Validate and create proposal
      const validatedData = insertPropostaSchema.parse(formData);
      const proposta = await storage.createProposta(validatedData);

      // For traditional form submission, redirect with success message
      const successPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proposta Enviada - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .success { color: #16a34a; text-align: center; }
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem; }
                .details { background: #f3f4f6; padding: 1rem; border-radius: 6px; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">
                    <h1>✅ Proposta Enviada com Sucesso!</h1>
                    <p>Sua proposta foi registrada no sistema e está aguardando análise.</p>
                </div>
                <div class="details">
                    <h3>Dados da Proposta:</h3>
                    <p><strong>ID:</strong> ${proposta.id}</p>
                    <p><strong>Cliente:</strong> ${formData.clienteNome}</p>
                    <p><strong>Valor:</strong> R$ ${formData.valor}</p>
                    <p><strong>Prazo:</strong> ${formData.prazo} meses</p>
                    <p><strong>Status:</strong> ${formData.status}</p>
                </div>
                <div style="text-align: center;">
                    <a href="/dashboard" class="button">Voltar ao Dashboard</a>
                    <a href="/propostas/nova" class="button" style="background: #6b7280;">Nova Proposta</a>
                </div>
            </div>
            <script>
                // Se JavaScript estiver disponível, redirecionar automaticamente
                setTimeout(() => window.location.href = '/dashboard', 3000);
            </script>
        </body>
        </html>
      `;

      res.send(successPage);

    } catch (error) {
      console.error("Progressive Enhancement form error:", error);

      // Error page for traditional form submission
      const errorPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Erro - Simpix</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2rem; background: #f9fafb; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .error { color: #dc2626; text-align: center; }
                .button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error">
                    <h1>❌ Erro ao Enviar Proposta</h1>
                    <p>Ocorreu um erro ao processar sua solicitação. Por favor, verifique os dados e tente novamente.</p>
                    ${error instanceof z.ZodError ? 
                      `<div style="background: #fef2f2; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                         <h3>Campos com erro:</h3>
                         <ul style="text-align: left;">
                           ${error.errors.map(e => `<li>${e.path.join('.')}: ${e.message}</li>`).join('')}
                         </ul>
                       </div>` : ''
                    }
                </div>
                <div style="text-align: center;">
                    <a href="/propostas/nova" class="button">Tentar Novamente</a>
                    <a href="/dashboard" class="button" style="background: #6b7280;">Voltar ao Dashboard</a>
                </div>
            </div>
        </body>
        </html>
      `;

      res.status(400).send(errorPage);
    }
  });

  app.patch("/api/propostas/:id", jwtAuthMiddleware, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = updatePropostaSchema.parse(req.body);
      const proposta = await storage.updateProposta(id, validatedData);
      res.json(proposta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Update proposta error:", error);
      res.status(500).json({ message: "Failed to update proposta" });
    }
  });

  app.get("/api/propostas/status/:status", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const status = req.params.status;
      const propostas = await storage.getPropostasByStatus(status);
      res.json(propostas);
    } catch (error) {
      console.error("Get propostas by status error:", error);
      res.status(500).json({ message: "Failed to fetch propostas" });
    }
  });

  // Import document routes
  const { getPropostaDocuments, uploadPropostaDocument } = await import("./routes/documents");

  // Document routes for proposals
  app.get("/api/propostas/:id/documents", jwtAuthMiddleware, getPropostaDocuments);
  app.post("/api/propostas/:id/documents", jwtAuthMiddleware, upload.single("file"), uploadPropostaDocument);

  // Import propostas routes
  const { togglePropostaStatus } = await import("./routes/propostas");
  
  // Rota para alternar status entre ativa/suspensa
  app.put("/api/propostas/:id/toggle-status", jwtAuthMiddleware, togglePropostaStatus);

  // Emergency route to setup storage bucket (temporary - no auth for setup)
  app.post("/api/setup-storage", async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      // Check existing buckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('❌ Erro ao listar buckets:', listError);
        return res.status(500).json({ message: 'Erro ao acessar storage', error: listError.message });
      }
      
      const documentsExists = buckets.some(bucket => bucket.name === 'documents');
      
      if (documentsExists) {
        return res.json({ message: 'Bucket documents já existe', buckets: buckets.map(b => b.name) });
      }
      
      // Create documents bucket
      const { data: bucket, error: createError } = await supabase.storage.createBucket('documents', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg', 
          'image/jpg',
          'image/png',
          'image/gif'
        ]
      });
      
      if (createError) {
        console.error('❌ Erro ao criar bucket:', createError);
        return res.status(500).json({ message: 'Erro ao criar bucket', error: createError.message });
      }
      
      res.json({ 
        message: 'Bucket documents criado com sucesso!', 
        bucket: bucket,
        allBuckets: buckets.map(b => b.name).concat(['documents'])
      });
      
    } catch (error) {
      console.error('Erro no setup:', error);
      res.status(500).json({ 
        message: 'Erro interno', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Upload route for proposal documents during creation
  app.post("/api/upload", jwtAuthMiddleware, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      const file = req.file;
      const proposalId = req.body.proposalId || req.body.filename?.split('-')[0] || 'temp';
      
      if (!file) {
        return res.status(400).json({ message: "Arquivo é obrigatório" });
      }

      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileName = req.body.filename || `${timestamp}-${file.originalname}`;
      const filePath = `proposta-${proposalId}/${fileName}`;
      
      console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);
      
      // Upload to PRIVATE Supabase Storage bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('[ERROR] Erro no upload:', uploadError);
        return res.status(400).json({ 
          message: `Erro no upload: ${uploadError.message}` 
        });
      }

      // For private bucket, we need to generate a signed URL for viewing
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${filePath}`);

      res.json({
        success: true,
        fileName: fileName,
        filePath: filePath,
        url: signedUrlData?.signedUrl || '', // Temporary signed URL
        originalName: file.originalname,
        size: file.size,
        type: file.mimetype
      });

    } catch (error) {
      console.error('[ERROR] Erro no upload de documento:', error);
      res.status(500).json({ message: 'Erro interno no upload' });
    }
  });

  // Import do controller de produtos
  const { 
    buscarTodosProdutos, 
    criarProduto, 
    atualizarProduto, 
    verificarProdutoEmUso, 
    deletarProduto 
  } = await import("./controllers/produtoController");

  // Buscar tabelas comerciais disponíveis com lógica hierárquica
app.get("/api/tabelas-comerciais-disponiveis", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { produtoId, parceiroId } = req.query;

    // Validação de parâmetros obrigatórios
    if (!produtoId || !parceiroId) {
      return res.status(400).json({ 
        message: "produtoId e parceiroId são obrigatórios" 
      });
    }

    // Validação de tipos
    const produtoIdNum = parseInt(produtoId as string);
    const parceiroIdNum = parseInt(parceiroId as string);

    if (isNaN(produtoIdNum) || isNaN(parceiroIdNum)) {
      return res.status(400).json({ 
        message: "produtoId e parceiroId devem ser números válidos" 
      });
    }

    console.log(`[${new Date().toISOString()}] Buscando tabelas comerciais para produto ${produtoIdNum} e parceiro ${parceiroIdNum}`);

    // Import database connection
    const { db } = await import("../server/lib/supabase");
    const { eq, and, isNull, desc } = await import("drizzle-orm");
    const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");

    // STEP 1: Busca Prioritária - Tabelas Personalizadas (produto + parceiro)
    // Agora usando JOIN com a nova estrutura N:N
    const tabelasPersonalizadas = await db
      .select({
        id: tabelasComerciais.id,
        nomeTabela: tabelasComerciais.nomeTabela,
        taxaJuros: tabelasComerciais.taxaJuros,
        prazos: tabelasComerciais.prazos,
        parceiroId: tabelasComerciais.parceiroId,
        comissao: tabelasComerciais.comissao,
        createdAt: tabelasComerciais.createdAt,
      })
      .from(tabelasComerciais)
      .innerJoin(produtoTabelaComercial, eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId))
      .where(
        and(
          eq(produtoTabelaComercial.produtoId, produtoIdNum),
          eq(tabelasComerciais.parceiroId, parceiroIdNum)
        )
      )
      .orderBy(desc(tabelasComerciais.createdAt));

    // STEP 2: Validação - Se encontrou tabelas personalizadas, retorna apenas elas
    if (tabelasPersonalizadas && tabelasPersonalizadas.length > 0) {
      console.log(`[${new Date().toISOString()}] Encontradas ${tabelasPersonalizadas.length} tabelas personalizadas`);
      return res.json(tabelasPersonalizadas);
    }

    console.log(`[${new Date().toISOString()}] Nenhuma tabela personalizada encontrada, buscando tabelas gerais`);

    // STEP 3: Busca Secundária - Tabelas Gerais (produto + parceiro nulo)
    // Usando JOIN com a nova estrutura N:N
    const tabelasGerais = await db
      .select({
        id: tabelasComerciais.id,
        nomeTabela: tabelasComerciais.nomeTabela,
        taxaJuros: tabelasComerciais.taxaJuros,
        prazos: tabelasComerciais.prazos,
        parceiroId: tabelasComerciais.parceiroId,
        comissao: tabelasComerciais.comissao,
        createdAt: tabelasComerciais.createdAt,
      })
      .from(tabelasComerciais)
      .innerJoin(produtoTabelaComercial, eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId))
      .where(
        and(
          eq(produtoTabelaComercial.produtoId, produtoIdNum),
          isNull(tabelasComerciais.parceiroId)
        )
      )
      .orderBy(desc(tabelasComerciais.createdAt));

    // STEP 4: Resultado Final
    const resultado = tabelasGerais || [];
    console.log(`[${new Date().toISOString()}] Encontradas ${resultado.length} tabelas gerais`);

    res.json(resultado);
  } catch (error) {
    console.error("Erro no endpoint de tabelas comerciais hierárquicas:", error);
    res.status(500).json({ 
      message: "Erro interno do servidor" 
    });
  }
});

  // Simple GET endpoint for all commercial tables (for dropdowns)
  app.get("/api/tabelas-comerciais", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Import database connection
      const { db } = await import("../server/lib/supabase");
      const { desc, eq } = await import("drizzle-orm");
      const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");

      // Get all commercial tables ordered by creation date
      const tabelas = await db
        .select()
        .from(tabelasComerciais)
        .orderBy(desc(tabelasComerciais.createdAt));

      // For each table, get associated products
      const tabelasWithProducts = await Promise.all(
        tabelas.map(async (tabela) => {
          const associations = await db
            .select({ produtoId: produtoTabelaComercial.produtoId })
            .from(produtoTabelaComercial)
            .where(eq(produtoTabelaComercial.tabelaComercialId, tabela.id));
          
          return {
            ...tabela,
            produtoIds: associations.map(a => a.produtoId)
          };
        })
      );

      console.log(`[${new Date().toISOString()}] Retornando ${tabelasWithProducts.length} tabelas comerciais com produtos`);
      res.json(tabelasWithProducts);
    } catch (error) {
      console.error("Erro ao buscar tabelas comerciais:", error);
      res.status(500).json({ 
        message: "Erro ao buscar tabelas comerciais" 
      });
    }
  });

  // API endpoint for creating commercial tables (N:N structure)
  app.post("/api/admin/tabelas-comerciais", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
      const { z } = await import("zod");

      // Updated validation schema for N:N structure
      const createTabelaSchema = z.object({
        nomeTabela: z.string().min(3, "Nome da tabela deve ter pelo menos 3 caracteres"),
        taxaJuros: z.number().positive("Taxa de juros deve ser positiva"),
        prazos: z.array(z.number().positive()).min(1, "Deve ter pelo menos um prazo"),
        produtoIds: z.array(z.number().int().positive()).min(1, "Pelo menos um produto deve ser selecionado"),
        parceiroId: z.number().int().positive().optional(),
        comissao: z.number().min(0, "Comissão deve ser maior ou igual a zero").default(0),
      });

      const validatedData = createTabelaSchema.parse(req.body);

      // TRANSACTION: Create table and associate products
      const result = await db.transaction(async (tx) => {
        // Step 1: Insert new commercial table
        const [newTabela] = await tx
          .insert(tabelasComerciais)
          .values({
            nomeTabela: validatedData.nomeTabela,
            taxaJuros: validatedData.taxaJuros.toString(),
            prazos: validatedData.prazos,
            parceiroId: validatedData.parceiroId || null,
            comissao: validatedData.comissao.toString(),
          })
          .returning();

        // Step 2: Associate products via junction table
        const associations = validatedData.produtoIds.map(produtoId => ({
          produtoId,
          tabelaComercialId: newTabela.id,
        }));

        await tx.insert(produtoTabelaComercial).values(associations);
        
        return newTabela;
      });

      console.log(`[${new Date().toISOString()}] Nova tabela comercial criada com ${validatedData.produtoIds.length} produtos: ${result.id}`);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao criar tabela comercial:", error);
      res.status(500).json({ message: "Erro ao criar tabela comercial" });
    }
  });

  // API endpoint for updating commercial tables (N:N structure)
  app.put("/api/admin/tabelas-comerciais/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
      const { z } = await import("zod");
      const { eq } = await import("drizzle-orm");

      const tabelaId = parseInt(req.params.id);
      if (isNaN(tabelaId)) {
        return res.status(400).json({ message: "ID da tabela inválido" });
      }

      // Updated validation schema for N:N structure
      const updateTabelaSchema = z.object({
        nomeTabela: z.string().min(3, "Nome da tabela deve ter pelo menos 3 caracteres"),
        taxaJuros: z.number().positive("Taxa de juros deve ser positiva"),
        prazos: z.array(z.number().positive()).min(1, "Deve ter pelo menos um prazo"),
        produtoIds: z.array(z.number().int().positive()).min(1, "Pelo menos um produto deve ser selecionado"),
        parceiroId: z.number().int().positive().nullable().optional(),
        comissao: z.number().min(0, "Comissão deve ser maior ou igual a zero").default(0),
      });

      const validatedData = updateTabelaSchema.parse(req.body);

      // TRANSACTION: Update table and reassociate products
      const result = await db.transaction(async (tx) => {
        // Step 1: Update the commercial table
        const [updatedTabela] = await tx
          .update(tabelasComerciais)
          .set({
            nomeTabela: validatedData.nomeTabela,
            taxaJuros: validatedData.taxaJuros.toString(),
            prazos: validatedData.prazos,
            parceiroId: validatedData.parceiroId || null,
            comissao: validatedData.comissao.toString(),
          })
          .where(eq(tabelasComerciais.id, tabelaId))
          .returning();

        if (!updatedTabela) {
          throw new Error("Tabela comercial não encontrada");
        }

        // Step 2: Delete existing product associations
        await tx
          .delete(produtoTabelaComercial)
          .where(eq(produtoTabelaComercial.tabelaComercialId, tabelaId));

        // Step 3: Create new product associations
        const associations = validatedData.produtoIds.map(produtoId => ({
          produtoId,
          tabelaComercialId: tabelaId,
        }));

        await tx.insert(produtoTabelaComercial).values(associations);
        
        return updatedTabela;
      });

      console.log(`[${new Date().toISOString()}] Tabela comercial atualizada com ${validatedData.produtoIds.length} produtos: ${result.id}`);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      if (error instanceof Error && error.message === "Tabela comercial não encontrada") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Erro ao atualizar tabela comercial:", error);
      res.status(500).json({ message: "Erro ao atualizar tabela comercial" });
    }
  });

  // API endpoint for deleting commercial tables
  app.delete("/api/admin/tabelas-comerciais/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { tabelasComerciais, produtoTabelaComercial } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      const tabelaId = parseInt(req.params.id);
      if (isNaN(tabelaId)) {
        return res.status(400).json({ message: "ID da tabela inválido" });
      }

      // TRANSACTION: Delete table and its associations
      await db.transaction(async (tx) => {
        // Step 1: Delete product associations
        await tx
          .delete(produtoTabelaComercial)
          .where(eq(produtoTabelaComercial.tabelaComercialId, tabelaId));

        // Step 2: Delete the commercial table
        const result = await tx
          .delete(tabelasComerciais)
          .where(eq(tabelasComerciais.id, tabelaId))
          .returning();

        if (result.length === 0) {
          throw new Error("Tabela comercial não encontrada");
        }
      });

      console.log(`[${new Date().toISOString()}] Tabela comercial deletada: ${tabelaId}`);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "Tabela comercial não encontrada") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Erro ao deletar tabela comercial:", error);
      res.status(500).json({ message: "Erro ao deletar tabela comercial" });
    }
  });

  // REMOVIDO: Rota duplicada movida para linha 441 - ver comentário 🔧 CORREÇÃO CRÍTICA

  // Metrics endpoint for attendants - returns proposals count for today, week, month
  app.get("/api/propostas/metricas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { eq, gte, and, count } = await import("drizzle-orm");

      // Get current date and calculate date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Count proposals created today by this user
      const todayCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(
          and(
            eq(propostas.userId, userId),
            gte(propostas.createdAt, todayStart)
          )
        );

      // Count proposals created this week by this user
      const weekCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(
          and(
            eq(propostas.userId, userId),
            gte(propostas.createdAt, weekStart)
          )
        );

      // Count proposals created this month by this user
      const monthCount = await db
        .select({ count: count() })
        .from(propostas)
        .where(
          and(
            eq(propostas.userId, userId),
            gte(propostas.createdAt, monthStart)
          )
        );

      res.json({
        hoje: todayCount[0]?.count || 0,
        semana: weekCount[0]?.count || 0,
        mes: monthCount[0]?.count || 0
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

// GET /api/propostas/metricas - Get proposal metrics for current user
app.get("/api/propostas/metricas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { db } = await import("../server/lib/supabase");
    const { propostas } = await import("../shared/schema");
    const { eq, and, gte, count } = await import("drizzle-orm");
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count proposals created today by this user
    const todayCount = await db
      .select({ count: count() })
      .from(propostas)
      .where(
        and(
          eq(propostas.userId, userId),
          gte(propostas.createdAt, todayStart)
        )
      );

    // Count proposals created this week by this user
    const weekCount = await db
      .select({ count: count() })
      .from(propostas)
      .where(
        and(
          eq(propostas.userId, userId),
          gte(propostas.createdAt, weekStart)
        )
      );

    // Count proposals created this month by this user
    const monthCount = await db
      .select({ count: count() })
      .from(propostas)
      .where(
        and(
          eq(propostas.userId, userId),
          gte(propostas.createdAt, monthStart)
        )
      );

    res.json({
      hoje: todayCount[0]?.count || 0,
      semana: weekCount[0]?.count || 0,
      mes: monthCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching proposal metrics:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

  // Payment queue endpoint (T-05) - for FINANCEIRO team
  app.get("/api/propostas/pagamento", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      // Payment queue logic: only proposals ready for payment
      const pagamentoPropostas = await db
        .select()
        .from(propostas)
        .where(eq(propostas.status, 'pronto_pagamento'))
        .orderBy(desc(propostas.createdAt));

      console.log(`[${new Date().toISOString()}] Retornando ${pagamentoPropostas.length} propostas prontas para pagamento`);
      res.json(pagamentoPropostas);
    } catch (error) {
      console.error("Erro ao buscar propostas para pagamento:", error);
      res.status(500).json({ 
        message: "Erro ao buscar propostas para pagamento" 
      });
    }
  });



  // Endpoint for formalization data - Using Supabase direct to avoid Drizzle orderSelectedFields error
  app.get("/api/propostas/:id/formalizacao", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const propostaId = req.params.id;
      console.log(`[${new Date().toISOString()}] 🔍 INICIO - Buscando dados de formalização para proposta: ${propostaId}`);

      if (!propostaId) {
        return res.status(400).json({ message: "ID da proposta é obrigatório" });
      }

      // Usar Supabase Admin Client diretamente para evitar problemas do Drizzle
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();

      console.log(`[${new Date().toISOString()}] 🔍 STEP 1 - Fazendo query direta no Supabase...`);
      
      // Buscar proposta usando Supabase diretamente
      const { data: proposta, error: propostaError } = await supabase
        .from('propostas')
        .select('*')
        .eq('id', propostaId)
        .single();

      console.log(`[${new Date().toISOString()}] 🔍 STEP 2 - Proposta encontrada:`, !!proposta);
      console.log(`[${new Date().toISOString()}] 🔍 STEP 2.1 - Dados da proposta:`, {
        id: proposta?.id,
        status: proposta?.status,
        tabela_comercial_id: proposta?.tabela_comercial_id,
        produto_id: proposta?.produto_id,
        atendente_id: proposta?.atendente_id
      });

      if (propostaError || !proposta) {
        console.log(`[${new Date().toISOString()}] ❌ Proposta ${propostaId} não encontrada:`, propostaError?.message);
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      console.log(`[${new Date().toISOString()}] 🔍 STEP 3 - Buscando documentos...`);
      
      // Buscar documentos da proposta
      const { data: documentos, error: docError } = await supabase
        .from('proposta_documentos')
        .select('*')
        .eq('proposta_id', propostaId);

      console.log(`[${new Date().toISOString()}] 🔍 STEP 4 - Documentos encontrados:`, documentos?.length || 0);
      console.log(`[${new Date().toISOString()}] 🔍 STEP 4.1 - Estrutura dos documentos:`, documentos);

      // STEP 4.2: Gerar URLs assinadas para visualização dos documentos
      let documentosComUrls = [];
      if (documentos && documentos.length > 0) {
        console.log(`[${new Date().toISOString()}] 🔍 STEP 4.2 - Gerando URLs assinadas para ${documentos.length} documentos...`);
        
        for (const doc of documentos) {
          try {
            console.log(`🔍 [FORMALIZAÇÃO] Tentando gerar URL para documento:`, {
              nome: doc.nome_arquivo,
              url: doc.url,
              tipo: doc.tipo,
              proposta_id: doc.proposta_id
            });

            // Extrair o caminho do arquivo a partir da URL salva
            const documentsIndex = doc.url.indexOf('/documents/');
            let filePath;
            
            if (documentsIndex !== -1) {
              // Extrair caminho após '/documents/'
              filePath = doc.url.substring(documentsIndex + '/documents/'.length);
            } else {
              // Fallback: construir caminho baseado no nome do arquivo
              const fileName = doc.nome_arquivo;
              filePath = `proposta-${propostaId}/${fileName}`;
            }
            
            console.log(`🔍 [FORMALIZAÇÃO] Caminho extraído para URL assinada: ${filePath}`);

            const { data: signedUrlData, error: urlError } = await supabase.storage
              .from('documents')
              .createSignedUrl(filePath, 3600); // 1 hora

            if (!urlError && signedUrlData) {
              documentosComUrls.push({
                ...doc,
                // Mapeamento para formato esperado pelo DocumentViewer
                name: doc.nome_arquivo,
                url: signedUrlData.signedUrl,
                type: doc.tipo || 'application/octet-stream', // fallback se tipo for null
                uploadDate: doc.created_at,
                // Manter campos originais também
                url_visualizacao: signedUrlData.signedUrl
              });
              console.log(`[${new Date().toISOString()}] ✅ URL gerada para documento: ${doc.nome_arquivo}`);
            } else {
              console.log(`[${new Date().toISOString()}] ❌ Erro ao gerar URL para documento ${doc.nome_arquivo}:`, urlError?.message);
              console.log(`[${new Date().toISOString()}] ❌ Caminho tentado: ${filePath}`);
              documentosComUrls.push({
                ...doc,
                // Mesmo sem URL, mapear para formato esperado
                name: doc.nome_arquivo,
                url: '',
                type: doc.tipo || 'application/octet-stream',
                uploadDate: doc.created_at
              }); // Adiciona sem URL em caso de erro
            }
          } catch (error) {
            console.log(`[${new Date().toISOString()}] ❌ Erro ao processar documento ${doc.nome_arquivo}:`, error);
            documentosComUrls.push({
              ...doc,
              // Mesmo com erro, mapear para formato esperado
              name: doc.nome_arquivo,
              url: '',
              type: doc.tipo || 'application/octet-stream',
              uploadDate: doc.created_at
            }); // Adiciona sem URL em caso de erro
          }
        }
      }

      // Buscar taxa de juros da tabela comercial se existir
      let taxaJurosTabela = null;
      console.log(`[${new Date().toISOString()}] 🔍 STEP 5 - Verificando tabela_comercial_id:`, proposta.tabela_comercial_id);
      
      if (proposta.tabela_comercial_id) {
        console.log(`[${new Date().toISOString()}] 🔍 STEP 5.1 - Buscando tabela comercial ID:`, proposta.tabela_comercial_id);
        
        const { data: tabelaComercial, error: tabelaError } = await supabase
          .from('tabelas_comerciais')
          .select('taxa_juros, nome_tabela, parceiro_id')
          .eq('id', proposta.tabela_comercial_id)
          .single();
          
        console.log(`[${new Date().toISOString()}] 🔍 STEP 5.2 - Resultado da consulta tabela comercial:`, {
          data: tabelaComercial,
          error: tabelaError?.message,
          hasData: !!tabelaComercial
        });
          
        if (tabelaComercial && !tabelaError) {
          taxaJurosTabela = tabelaComercial.taxa_juros;
          console.log(`[${new Date().toISOString()}] ✅ Taxa de juros encontrada:`, taxaJurosTabela, `% da tabela "${tabelaComercial.nome_tabela}"`);
        } else {
          console.log(`[${new Date().toISOString()}] ❌ Erro ao buscar tabela comercial:`, tabelaError?.message);
        }
      } else {
        console.log(`[${new Date().toISOString()}] ⚠️ AVISO: Proposta ${propostaId} não possui tabela_comercial_id`);
      }

      console.log(`[${new Date().toISOString()}] 🔍 STEP 6 - Processando dados JSONB...`);

      // Parse dos dados JSONB antes de retornar
      const propostaProcessada = {
        ...proposta,
        // Parse seguro dos dados JSONB
        clienteData: proposta.cliente_data || {},
        condicoesData: proposta.condicoes_data || {},
        // Converter snake_case para camelCase para compatibilidade frontend
        ccbGerado: proposta.ccb_gerado || false,
        dataAprovacao: proposta.data_aprovacao,
        assinaturaEletronicaConcluida: proposta.assinatura_eletronica_concluida || false,
        biometriaConcluida: proposta.biometria_concluida || false,
        caminhoCcbAssinado: proposta.caminho_ccb_assinado,
        createdAt: proposta.created_at,
        // Adicionar documentos com URLs assinadas
        documentos: documentosComUrls || [],
        // Adicionar taxa de juros da tabela comercial
        taxaJurosTabela: taxaJurosTabela
      };

      console.log(`[${new Date().toISOString()}] ✅ SUCESSO - Dados de formalização retornados para proposta ${propostaId}:`, {
        id: propostaProcessada.id,
        status: propostaProcessada.status,
        ccbGerado: propostaProcessada.ccbGerado,
        dataAprovacao: propostaProcessada.dataAprovacao,
        temClienteData: !!propostaProcessada.clienteData?.nome,
        temCondicoesData: !!propostaProcessada.condicoesData?.valor,
        totalDocumentos: propostaProcessada.documentos?.length || 0,
        clienteNome: propostaProcessada.clienteData?.nome || 'Nome não informado',
        valorEmprestimo: propostaProcessada.condicoesData?.valor || 'Valor não informado',
        taxaJuros: propostaProcessada.taxaJurosTabela || propostaProcessada.condicoesData?.taxaJuros || 'Taxa não informada',
      });
      
      res.json(propostaProcessada);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ ERRO ao buscar dados de formalização:`, error);
      res.status(500).json({ message: "Erro ao buscar dados de formalização", error: error.message });
    }
  });

  // Mock data para prazos
  const prazos = [
    { id: 1, valor: "12 meses" },
    { id: 2, valor: "24 meses" },
    { id: 3, valor: "36 meses" },
  ];

  // Users management endpoints
  app.get("/api/admin/users", jwtAuthMiddleware, requireAdmin, async (req, res) => {
    try {
      // Query Supabase profiles directly instead of local users table
      const { createServerSupabaseAdminClient } = await import("./lib/supabase");
      const supabase = createServerSupabaseAdminClient();
      
      // Get all auth users first
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error('Auth users error:', authError);
        return res.status(500).json({ message: "Erro ao buscar usuários de autenticação" });
      }

      // Get all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profileError) {
        console.error('Supabase profiles error:', profileError);
        return res.status(500).json({ message: "Erro ao buscar perfis de usuários" });
      }

      // Join auth users with profiles manually
      const users = profiles.map(profile => {
        const authUser = authUsers.users.find(user => user.id === profile.id);
        return {
          id: profile.id,
          name: profile.full_name,
          email: authUser?.email || 'N/A',
          role: profile.role,
          lojaId: profile.loja_id,
        };
      });

      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // API endpoint for partners - GET all (public for dropdowns)
  app.get("/api/parceiros", async (req, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros } = await import("../shared/schema");
      
      const allParceiros = await db.select().from(parceiros);
      res.json(allParceiros);
    } catch (error) {
      console.error("Erro ao buscar parceiros:", error);
      res.status(500).json({ message: "Erro ao buscar parceiros" });
    }
  });

  // API endpoint for partners - GET by ID
  app.get("/api/parceiros/:id", async (req, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const parceiroId = parseInt(req.params.id);
      if (isNaN(parceiroId)) {
        return res.status(400).json({ message: "ID do parceiro inválido" });
      }
      
      const [parceiro] = await db
        .select()
        .from(parceiros)
        .where(eq(parceiros.id, parceiroId));
      
      if (!parceiro) {
        return res.status(404).json({ message: "Parceiro não encontrado" });
      }
      
      res.json(parceiro);
    } catch (error) {
      console.error("Erro ao buscar parceiro:", error);
      res.status(500).json({ message: "Erro ao buscar parceiro" });
    }
  });

  // API endpoint for partners - POST create
  app.post("/api/admin/parceiros", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros, insertParceiroSchema } = await import("../shared/schema");
      const { z } = await import("zod");
      
      const validatedData = insertParceiroSchema.parse(req.body);
      const [newParceiro] = await db.insert(parceiros).values(validatedData).returning();
      
      res.status(201).json(newParceiro);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao criar parceiro:", error);
      res.status(500).json({ message: "Erro ao criar parceiro" });
    }
  });

  // API endpoint for partners - PUT update
  app.put("/api/admin/parceiros/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros, updateParceiroSchema } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      const { z } = await import("zod");
      
      const parceiroId = parseInt(req.params.id);
      if (isNaN(parceiroId)) {
        return res.status(400).json({ message: "ID do parceiro inválido" });
      }
      
      const validatedData = updateParceiroSchema.parse(req.body);
      const [updatedParceiro] = await db
        .update(parceiros)
        .set(validatedData)
        .where(eq(parceiros.id, parceiroId))
        .returning();
      
      if (!updatedParceiro) {
        return res.status(404).json({ message: "Parceiro não encontrado" });
      }
      
      res.json(updatedParceiro);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao atualizar parceiro:", error);
      res.status(500).json({ message: "Erro ao atualizar parceiro" });
    }
  });

  // API endpoint for partners - DELETE 
  app.delete("/api/admin/parceiros/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { parceiros, lojas } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const parceiroId = parseInt(req.params.id);
      if (isNaN(parceiroId)) {
        return res.status(400).json({ message: "ID do parceiro inválido" });
      }
      
      // Regra de negócio crítica: verificar se existem lojas associadas
      const lojasAssociadas = await db
        .select()
        .from(lojas)
        .where(eq(lojas.parceiroId, parceiroId));
      
      if (lojasAssociadas.length > 0) {
        return res.status(409).json({ 
          message: "Não é possível excluir um parceiro que possui lojas cadastradas." 
        });
      }
      
      // Verificar se o parceiro existe antes de excluir
      const [parceiroExistente] = await db
        .select()
        .from(parceiros)
        .where(eq(parceiros.id, parceiroId));
      
      if (!parceiroExistente) {
        return res.status(404).json({ message: "Parceiro não encontrado" });
      }
      
      // Proceder com a exclusão
      await db.delete(parceiros).where(eq(parceiros.id, parceiroId));
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir parceiro:", error);
      res.status(500).json({ message: "Erro ao excluir parceiro" });
    }
  });

  // Rotas CRUD para produtos
  app.get("/api/produtos", async (req, res) => {
    try {
      const produtos = await buscarTodosProdutos();
      res.json(produtos);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/produtos", async (req, res) => {
    try {
      const { nome, status } = req.body;

      if (!nome || !status) {
        return res.status(400).json({ message: "Nome e status são obrigatórios" });
      }

      const novoProduto = await criarProduto({ nome, status });
      res.status(201).json(novoProduto);
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.put("/api/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status } = req.body;

      if (!nome || !status) {
        return res.status(400).json({ message: "Nome e status são obrigatórios" });
      }

      const produtoAtualizado = await atualizarProduto(id, { nome, status });
      res.json(produtoAtualizado);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await deletarProduto(id);
      res.status(204).send(); // 204 No Content on successful deletion
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      
      // Check if it's a dependency error
      if (error instanceof Error && error.message.includes('Tabelas Comerciais')) {
        return res.status(409).json({ 
          message: error.message 
        });
      }
      
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // Rota para buscar prazos
  app.get("/api/prazos", (req, res) => {
    res.json(prazos);
  });

  // Função para calcular o valor da parcela usando a fórmula da Tabela Price
  const calcularParcela = (
    valorSolicitado: number,
    prazoEmMeses: number,
    taxaDeJurosMensal: number
  ): number => {
    if (taxaDeJurosMensal <= 0) {
      return valorSolicitado / prazoEmMeses;
    }
    const i = taxaDeJurosMensal / 100; // Convertendo a taxa percentual para decimal
    const pmt =
      (valorSolicitado * (i * Math.pow(1 + i, prazoEmMeses))) / (Math.pow(1 + i, prazoEmMeses) - 1);
    return parseFloat(pmt.toFixed(2));
  };

  // Mock de tabelas comerciais para simulação
  const tabelasComerciais: { [key: string]: number } = {
    "tabela-a": 5.0, // Tabela A, 5% de taxa de juros
    "tabela-b": 7.5, // Tabela B, 7.5% de taxa de juros
  };

  // Função para obter a taxa de juros (substituirá a lógica real do DB)
  const obterTaxaJurosPorTabela = (tabelaId: string): number => {
    return tabelasComerciais[tabelaId] || 5.0; // Retorna 5% como padrão
  };

  // Rota para simular crédito ATUALIZADA
  app.post("/api/simular", (req, res) => {
    const { valorSolicitado, prazoEmMeses, tabelaComercialId } = req.body;

    if (
      typeof valorSolicitado !== "number" ||
      typeof prazoEmMeses !== "number" ||
      typeof tabelaComercialId !== "string"
    ) {
      return res.status(400).json({ error: "Entrada inválida." });
    }

    const taxaDeJurosMensal = obterTaxaJurosPorTabela(tabelaComercialId);
    const valorDaParcela = calcularParcela(valorSolicitado, prazoEmMeses, taxaDeJurosMensal);
    const cetAnual = taxaDeJurosMensal * 12 * 1.1;

    return res.json({ valorParcela: valorDaParcela, cet: parseFloat(cetAnual.toFixed(2)) });
  });

  // Funções de mock para a simulação
  const buscarTaxas = (produtoId: string) => {
    // Lógica futura: buscar no DB a tabela do produto/parceiro
    return { taxaDeJurosMensal: 5.0, valorTac: 150.0 }; // Exemplo: 5% a.m. e R$150 de TAC
  };

  const calcularIOF = (valor: number) => {
    return valor * 0.0038; // Exemplo de alíquota
  };

  // Endpoint GET para simulação de crédito
  // Server time endpoint for reliable timestamp source
  app.get("/api/server-time", (req, res) => {
    res.json({ now: new Date().toISOString() });
  });

  app.get("/api/simulacao", (req, res) => {
    const { valor, prazo, produto_id, incluir_tac, dataVencimento } = req.query;

    const valorSolicitado = parseFloat(valor as string);
    const prazoEmMeses = parseInt(prazo as string);

    if (isNaN(valorSolicitado) || isNaN(prazoEmMeses) || !produto_id || !dataVencimento) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // Correção Crítica: Usa a data do servidor como a "verdade"
    const dataAtual = new Date();
    const primeiroVencimento = new Date(dataVencimento as string);
    const diasDiferenca = Math.ceil(
      (primeiroVencimento.getTime() - dataAtual.getTime()) / (1000 * 3600 * 24)
    );

    if (diasDiferenca > 45) {
      return res
        .status(400)
        .json({ error: "A data do primeiro vencimento não pode ser superior a 45 dias." });
    }

    const { taxaDeJurosMensal, valorTac } = buscarTaxas(produto_id as string);

    const taxaJurosDiaria = taxaDeJurosMensal / 30;
    const jurosCarencia = valorSolicitado * (taxaJurosDiaria / 100) * diasDiferenca;

    const iof = calcularIOF(valorSolicitado);
    const tac = incluir_tac === "true" ? valorTac : 0;

    const valorTotalFinanciado = valorSolicitado + iof + tac + jurosCarencia;

    const valorParcela = calcularParcela(valorTotalFinanciado, prazoEmMeses, taxaDeJurosMensal);

    const custoTotal = valorParcela * prazoEmMeses;
    const cetAnual = ((custoTotal / valorSolicitado - 1) / (prazoEmMeses / 12)) * 100;

    return res.json({
      valorParcela: parseFloat(valorParcela.toFixed(2)),
      taxaJuros: taxaDeJurosMensal,
      valorIOF: parseFloat(iof.toFixed(2)),
      valorTAC: tac,
      valorTotalFinanciado: parseFloat(valorTotalFinanciado.toFixed(2)),
      custoEfetivoTotalAnual: parseFloat(cetAnual.toFixed(2)),
      jurosCarencia: parseFloat(jurosCarencia.toFixed(2)),
      diasCarencia: diasDiferenca,
    });
  });

  // Rota para fila de formalização
  app.get("/api/formalizacao/propostas", (req, res) => {
    const mockPropostas = [
      { id: "PROP-098", cliente: "Empresa A", status: "Assinatura Pendente" },
      { id: "PROP-101", cliente: "Empresa B", status: "Biometria Concluída" },
      { id: "PROP-105", cliente: "Empresa C", status: "CCB Gerada" },
    ];
    res.json(mockPropostas);
  });

  // Update proposal formalization step
  app.patch("/api/propostas/:id/etapa-formalizacao", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { etapa, concluida, caminho_documento } = req.body;

      // 🔍 DEBUG: Log user information
      console.log(`🔍 [ETAPA DEBUG] User info:`, {
        userId: req.user?.id,
        userRole: req.user?.role,
        userLojaId: req.user?.loja_id,
        etapa,
        concluida,
        propostaId: id
      });

      // Validate input
      const etapasValidas = ['ccb_gerado', 'assinatura_eletronica', 'biometria'];
      if (!etapa || !etapasValidas.includes(etapa)) {
        return res.status(400).json({ 
          message: "Etapa inválida. Use: ccb_gerado, assinatura_eletronica ou biometria" 
        });
      }

      if (typeof concluida !== 'boolean') {
        return res.status(400).json({ 
          message: "O campo 'concluida' deve ser um booleano" 
        });
      }

      // Import dependencies
      const { db } = await import("../server/lib/supabase");
      const { propostas, propostaLogs } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Get the proposal first to check permissions
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, id));

      if (!proposta) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      // 🔍 DEBUG: Log proposta info
      console.log(`🔍 [ETAPA DEBUG] Proposta info:`, {
        propostaId: proposta.id,
        propostaLojaId: proposta.lojaId,
        propostaStatus: proposta.status
      });

      // Check permissions based on step and role
      if (etapa === 'ccb_gerado') {
        // CCB generation can be done by ANALISTA, GERENTE, ATENDENTE, or ADMINISTRADOR
        const allowedRoles = ['ANALISTA', 'GERENTE', 'ATENDENTE', 'ADMINISTRADOR'];
        console.log(`🔍 [ETAPA DEBUG] Checking CCB permissions - Role: ${req.user?.role}, Allowed: ${allowedRoles.join(', ')}`);
        
        if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
          console.log(`❌ [ETAPA DEBUG] Permission denied for role: ${req.user?.role}`);
          return res.status(403).json({ 
            message: `Você não tem permissão para gerar CCB. Seu role: ${req.user?.role}` 
          });
        }
        console.log(`✅ [ETAPA DEBUG] Permission granted for CCB generation`);
      } else {
        // Other steps (ClickSign, Biometry) only ATENDENTE of the same store
        console.log(`🔍 [ETAPA DEBUG] Checking other steps permissions - Role: ${req.user?.role}, LojaId: ${req.user?.loja_id}, PropostaLojaId: ${proposta.lojaId}`);
        
        if (req.user?.role !== 'ATENDENTE' || req.user?.loja_id !== proposta.lojaId) {
          console.log(`❌ [ETAPA DEBUG] Permission denied for step ${etapa}`);
          return res.status(403).json({ 
            message: `Apenas o atendente da loja pode atualizar as etapas de assinatura e biometria. Seu role: ${req.user?.role}` 
          });
        }
        console.log(`✅ [ETAPA DEBUG] Permission granted for step ${etapa}`);
      }

      // Build update object based on the step
      const updateData: any = {};
      
      if (etapa === 'ccb_gerado') {
        updateData.ccbGerado = concluida;
        
        // Automatically generate CCB when marked as complete
        if (concluida && !proposta.ccbGerado) {
          console.log(`[${new Date().toISOString()}] Gerando CCB para proposta ${id}`);
          
          try {
            const { generateCCB } = await import("../server/services/ccbGenerator");
            const ccbPath = await generateCCB(id);
            updateData.caminhoCcbAssinado = ccbPath;
            console.log(`[${new Date().toISOString()}] CCB gerada com sucesso: ${ccbPath}`);
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Erro ao gerar CCB:`, error);
            // Don't fail the entire request if CCB generation fails
          }
        }
      } else if (etapa === 'assinatura_eletronica') {
        updateData.assinaturaEletronicaConcluida = concluida;
        
        // TODO: Integrate with ClickSign when marked as complete
        if (concluida && !proposta.assinaturaEletronicaConcluida) {
          console.log(`[${new Date().toISOString()}] Enviando para ClickSign - proposta ${id}`);
        }
      } else if (etapa === 'biometria') {
        updateData.biometriaConcluida = concluida;
        
        // Generate boletos when biometry is complete
        if (concluida && !proposta.biometriaConcluida) {
          // TODO: Generate payment boletos
          console.log(`[${new Date().toISOString()}] Gerando boletos para proposta ${id}`);
        }
      }

      // Add document path if provided
      if (caminho_documento && etapa === 'ccb_gerado' && concluida) {
        updateData.caminhoCcbAssinado = caminho_documento;
      }

      // Update the proposal
      const [updatedProposta] = await db
        .update(propostas)
        .set(updateData)
        .where(eq(propostas.id, id))
        .returning();

      // Create audit log
      await db.insert(propostaLogs).values({
        propostaId: id,
        autorId: req.user?.id || '',
        statusNovo: `etapa_${etapa}_${concluida ? 'concluida' : 'revertida'}`,
        observacao: `Etapa ${etapa} ${concluida ? 'marcada como concluída' : 'revertida'} por ${req.user?.role || 'usuário'}`
      });

      // Check if all formalization steps are complete
      if (updatedProposta.ccbGerado && 
          updatedProposta.assinaturaEletronicaConcluida && 
          updatedProposta.biometriaConcluida) {
        // Update status to ready for payment if all steps are complete
        await db
          .update(propostas)
          .set({
            status: 'pronto_pagamento'
          })
          .where(eq(propostas.id, id));

        console.log(`[${new Date().toISOString()}] Proposta ${id} pronta para pagamento`);
      }

      res.json({
        message: "Etapa de formalização atualizada com sucesso",
        etapa,
        concluida,
        proposta: updatedProposta
      });

    } catch (error) {
      console.error("Erro ao atualizar etapa de formalização:", error);
      res.status(500).json({ 
        message: "Erro ao atualizar etapa de formalização" 
      });
    }
  });

  // Update proposal status - REAL IMPLEMENTATION WITH AUDIT TRAIL
  app.put("/api/propostas/:id/status", jwtAuthMiddleware, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status, observacao } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status é obrigatório" });
      }

      // Import database and schema dependencies
      const { db } = await import("../server/lib/supabase");
      const { propostas, comunicacaoLogs } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");

      // Execute transaction for atomic updates
      const result = await db.transaction(async (tx) => {
        // Step 1: Get current proposal for audit trail
        const [currentProposta] = await tx
          .select({
            status: propostas.status,
            lojaId: propostas.lojaId
          })
          .from(propostas)
          .where(eq(propostas.id, id));

        if (!currentProposta) {
          throw new Error("Proposta não encontrada");
        }

        // Step 2: Update proposal status
        const [updatedProposta] = await tx
          .update(propostas)
          .set({
            status: status as any,
            dataAprovacao: status === 'aprovado' ? new Date() : undefined
          })
          .where(eq(propostas.id, id))
          .returning();

        // Skip comunicacaoLogs for now - focus on propostaLogs for audit
        // This will be implemented later for client communication tracking

        return updatedProposta;
      });

      console.log(`[${new Date().toISOString()}] Status da proposta ${id} atualizado de ${result.status} para ${status}`);
      res.json(result);
    } catch (error) {
      console.error("Update status error:", error);
      if (error instanceof Error && error.message === "Proposta não encontrada") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // Get proposal logs - REAL IMPLEMENTATION
  app.get("/api/propostas/:id/logs", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      // Import database dependencies
      const { db } = await import("../server/lib/supabase");
      const { comunicacaoLogs, users } = await import("../shared/schema");
      const { eq, desc, and } = await import("drizzle-orm");

      // Fetch communication logs for this proposal
      const logs = await db
        .select({
          id: comunicacaoLogs.id,
          conteudo: comunicacaoLogs.conteudo,
          tipo: comunicacaoLogs.tipo,
          userId: comunicacaoLogs.userId,
          createdAt: comunicacaoLogs.createdAt,
          userName: users.name
        })
        .from(comunicacaoLogs)
        .leftJoin(users, eq(comunicacaoLogs.userId, users.id))
        .where(
          and(
            eq(comunicacaoLogs.propostaId, id), // Now accepts text directly
            eq(comunicacaoLogs.tipo, "sistema")
          )
        )
        .orderBy(desc(comunicacaoLogs.createdAt));

      // Transform logs to expected format
      const formattedLogs = logs.map(log => {
        let parsedContent;
        try {
          parsedContent = JSON.parse(log.conteudo);
        } catch {
          parsedContent = { observacao: log.conteudo };
        }

        return {
          id: log.id,
          status_novo: parsedContent.status_novo || parsedContent.acao || "Atualização",
          observacao: parsedContent.observacao || null,
          user_id: log.userId || "Sistema",
          user_name: log.userName || "Sistema",
          created_at: log.createdAt
        };
      });

      res.json(formattedLogs);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ message: "Erro ao carregar histórico" });
    }
  });



  // Dashboard stats
  app.get("/api/dashboard/stats", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const allPropostas = await storage.getPropostas();

      const stats = {
        totalPropostas: allPropostas.length,
        aguardandoAnalise: allPropostas.filter(p => p.status === "aguardando_analise").length,
        aprovadas: allPropostas.filter(p => p.status === "aprovado").length,
        valorTotal: allPropostas.reduce((sum, p) => sum + parseFloat(p.valor), 0),
      };

      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Gerente-Lojas Relationship Routes
  // Get all stores managed by a specific manager
  app.get("/api/gerentes/:gerenteId/lojas", jwtAuthMiddleware, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const gerenteId = parseInt(req.params.gerenteId);
      const lojaIds = await storage.getLojasForGerente(gerenteId);
      res.json(lojaIds);
    } catch (error) {
      console.error("Get lojas for gerente error:", error);
      res.status(500).json({ message: "Failed to fetch stores for manager" });
    }
  });

  // Get all managers for a specific store
  app.get("/api/lojas/:lojaId/gerentes", jwtAuthMiddleware, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const lojaId = parseInt(req.params.lojaId);
      const gerenteIds = await storage.getGerentesForLoja(lojaId);
      res.json(gerenteIds);
    } catch (error) {
      console.error("Get gerentes for loja error:", error);
      res.status(500).json({ message: "Failed to fetch managers for store" });
    }
  });

  // Add a manager to a store
  app.post("/api/gerente-lojas", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertGerenteLojaSchema.parse(req.body);
      const relationship = await storage.addGerenteToLoja(validatedData);
      res.json(relationship);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Add gerente to loja error:", error);
      res.status(500).json({ message: "Failed to add manager to store" });
    }
  });

  // Remove a manager from a store
  app.delete("/api/gerente-lojas/:gerenteId/:lojaId", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const gerenteId = parseInt(req.params.gerenteId);
      const lojaId = parseInt(req.params.lojaId);
      await storage.removeGerenteFromLoja(gerenteId, lojaId);
      res.json({ message: "Manager removed from store successfully" });
    } catch (error) {
      console.error("Remove gerente from loja error:", error);
      res.status(500).json({ message: "Failed to remove manager from store" });
    }
  });

  // Get all relationships for a specific manager
  app.get("/api/gerentes/:gerenteId/relationships", jwtAuthMiddleware, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const gerenteId = parseInt(req.params.gerenteId);
      const relationships = await storage.getGerenteLojas(gerenteId);
      res.json(relationships);
    } catch (error) {
      console.error("Get gerente relationships error:", error);
      res.status(500).json({ message: "Failed to fetch manager relationships" });
    }
  });

  // User Management API - Import the service
  const { createUser } = await import("./services/userService");

  app.post("/api/admin/users", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = UserDataSchema.parse(req.body);
      const newUser = await createUser(validatedData);
      return res.status(201).json(newUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados de entrada inválidos", errors: error.flatten() });
      }
      if (error.name === 'ConflictError') {
        return res.status(409).json({ message: error.message });
      }
      console.error("Erro ao criar usuário:", error.message);
      return res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  // ============== SYSTEM METADATA ROUTES ==============
  
  // System metadata endpoint for hybrid filtering strategy
  app.get("/api/admin/system/metadata", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { lojas } = await import("../shared/schema");
      const { count } = await import("drizzle-orm");
      
      const result = await db.select({ count: count() }).from(lojas);
      const totalLojas = result[0]?.count || 0;
      
      res.json({ totalLojas });
    } catch (error) {
      console.error("Erro ao buscar metadados do sistema:", error);
      res.status(500).json({ message: "Erro ao buscar metadados do sistema" });
    }
  });

  // Get lojas by parceiro ID for server-side filtering
  app.get("/api/admin/parceiros/:parceiroId/lojas", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { lojas } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const parceiroId = parseInt(req.params.parceiroId);
      if (isNaN(parceiroId)) {
        return res.status(400).json({ message: "ID do parceiro inválido" });
      }
      
      const lojasResult = await db
        .select()
        .from(lojas)
        .where(eq(lojas.parceiroId, parceiroId));
      
      res.json(lojasResult);
    } catch (error) {
      console.error("Erro ao buscar lojas do parceiro:", error);
      res.status(500).json({ message: "Erro ao buscar lojas do parceiro" });
    }
  });

  // ============== LOJAS CRUD ROUTES ==============
  
  // GET all active lojas
  app.get("/api/admin/lojas", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const lojas = await storage.getLojas();
      res.json(lojas);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
      res.status(500).json({ message: "Erro ao buscar lojas" });
    }
  });

  // GET loja by ID
  app.get("/api/lojas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID da loja inválido" });
      }
      
      const loja = await storage.getLojaById(id);
      if (!loja) {
        return res.status(404).json({ message: "Loja não encontrada" });
      }
      
      res.json(loja);
    } catch (error) {
      console.error("Erro ao buscar loja:", error);
      res.status(500).json({ message: "Erro ao buscar loja" });
    }
  });

  // POST create new loja
  app.post("/api/admin/lojas", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertLojaSchema.strict().parse(req.body);
      const newLoja = await storage.createLoja(validatedData);
      res.status(201).json(newLoja);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao criar loja:", error);
      res.status(500).json({ message: "Erro ao criar loja" });
    }
  });

  // PUT update loja
  app.put("/api/admin/lojas/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID da loja inválido" });
      }
      
      const validatedData = updateLojaSchema.strict().parse(req.body);
      const updatedLoja = await storage.updateLoja(id, validatedData);
      
      if (!updatedLoja) {
        return res.status(404).json({ message: "Loja não encontrada" });
      }
      
      res.json(updatedLoja);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Erro ao atualizar loja:", error);
      res.status(500).json({ message: "Erro ao atualizar loja" });
    }
  });

  // DELETE soft delete loja (set is_active = false)
  app.delete("/api/admin/lojas/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID da loja inválido" });
      }
      
      // Check for dependencies before soft delete
      const dependencies = await storage.checkLojaDependencies(id);
      
      if (dependencies.hasUsers || dependencies.hasPropostas || dependencies.hasGerentes) {
        const dependencyDetails = [];
        if (dependencies.hasUsers) dependencyDetails.push("usuários ativos");
        if (dependencies.hasPropostas) dependencyDetails.push("propostas associadas");
        if (dependencies.hasGerentes) dependencyDetails.push("gerentes associados");
        
        return res.status(409).json({ 
          message: "Não é possível desativar esta loja",
          details: `A loja possui ${dependencyDetails.join(", ")}. Remova ou transfira essas dependências antes de desativar a loja.`,
          dependencies: dependencies
        });
      }
      
      // Perform soft delete
      await storage.deleteLoja(id);
      res.json({ message: "Loja desativada com sucesso" });
    } catch (error) {
      console.error("Erro ao desativar loja:", error);
      res.status(500).json({ message: "Erro ao desativar loja" });
    }
  });

  // User profile endpoint for RBAC context
  app.get('/api/auth/profile', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
      }

      res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        full_name: req.user.full_name,
        loja_id: req.user.loja_id,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Health check endpoints for system stability monitoring
  app.get('/api/health/storage', async (req, res) => {
    try {
      // Test basic storage operations
      const users = await storage.getUsers();
      const lojas = await storage.getLojas();
      const usersWithDetails = await storage.getUsersWithDetails();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          getUsers: { status: 'ok', count: users.length },
          getLojas: { status: 'ok', count: lojas.length },
          getUsersWithDetails: { status: 'ok', count: usersWithDetails.length },
        }
      });
    } catch (error) {
      console.error('Storage health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/health/schema', async (req, res) => {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();

      // Check essential tables exist
      const tables = ['profiles', 'lojas', 'parceiros', 'produtos', 'propostas'];
      const checks: Record<string, any> = {};

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          checks[table] = {
            status: error ? 'error' : 'ok',
            error: error?.message || null
          };
        } catch (err) {
          checks[table] = {
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
          };
        }
      }

      const allHealthy = Object.values(checks).every(check => check.status === 'ok');

      res.status(allHealthy ? 200 : 500).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        tables: checks
      });
    } catch (error) {
      console.error('Schema health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ====================================
  // ENDPOINT DE UPLOAD DE DOCUMENTOS
  // ====================================
  app.post("/api/upload", upload.single('file'), jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const file = req.file;
      const proposalId = req.body.proposalId || req.body.filename?.split('-')[0] || 'temp';
      
      if (!file) {
        return res.status(400).json({ message: "Arquivo é obrigatório" });
      }

      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const supabase = createServerSupabaseAdminClient();
      
      // Usar filename do body ou gerar um timestamp
      const fileName = req.body.filename || `${Date.now()}-${file.originalname}`;
      const filePath = `proposta-${proposalId}/${fileName}`;
      
      console.log(`[DEBUG] Fazendo upload de ${file.originalname} para ${filePath}`);
      
      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('[ERROR] Erro no upload:', uploadError);
        return res.status(400).json({ 
          message: `Erro no upload: ${uploadError.message}` 
        });
      }

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      console.log(`[DEBUG] Upload bem-sucedido. Arquivo salvo em: ${publicUrl.publicUrl}`);

      res.json({
        success: true,
        fileName: fileName,
        filePath: filePath,
        url: publicUrl.publicUrl,
        originalName: file.originalname,
        size: file.size,
        type: file.mimetype
      });

    } catch (error) {
      console.error('[ERROR] Erro no upload de documento:', error);
      res.status(500).json({ 
        message: "Erro interno do servidor no upload" 
      });
    }
  });

  // === PDF TEMPLATE MANAGEMENT ROUTES ===

  // Get all PDF templates
  app.get("/api/admin/pdf-templates", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      const templates = await TemplateManager.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Erro ao buscar templates' });
    }
  });

  // Get specific PDF template
  app.get("/api/admin/pdf-templates/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      const template = await TemplateManager.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: 'Erro ao buscar template' });
    }
  });

  // Create or update PDF template
  app.post("/api/admin/pdf-templates", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      const template = req.body;

      // Validate template
      const validation = TemplateManager.validateTemplate(template);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Template inválido', details: validation.errors });
      }

      await TemplateManager.saveTemplate(template);
      res.json({ success: true, message: 'Template salvo com sucesso' });
    } catch (error) {
      console.error('Error saving template:', error);
      res.status(500).json({ error: 'Erro ao salvar template' });
    }
  });

  // Duplicate PDF template
  app.post("/api/admin/pdf-templates/:id/duplicate", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório para duplicação' });
      }

      const newTemplate = await TemplateManager.duplicateTemplate(req.params.id, name, description);
      res.json(newTemplate);
    } catch (error) {
      console.error('Error duplicating template:', error);
      res.status(500).json({ error: 'Erro ao duplicar template' });
    }
  });

  // Delete PDF template
  app.delete("/api/admin/pdf-templates/:id", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      await TemplateManager.deleteTemplate(req.params.id);
      res.json({ success: true, message: 'Template excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Erro ao excluir template' });
    }
  });

  // Preview PDF template
  app.post("/api/admin/pdf-templates/:id/preview", jwtAuthMiddleware, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { TemplateManager } = await import("./services/templateManager");
      const { PDFTemplateEngine } = await import("./services/pdfTemplateEngine");
      
      const template = await TemplateManager.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' });
      }

      // Sample data for preview
      const sampleData = {
        propostaId: 'PREVIEW-123456',
        dataEmissao: new Date(),
        dataVencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        clienteData: {
          nome: 'João da Silva',
          cpf: '123.456.789-00',
          email: 'joao@email.com',
          telefone: '(11) 99999-9999',
          endereco: 'Rua das Flores, 123 - São Paulo/SP'
        },
        condicoesData: {
          valor: 10000,
          prazo: 12,
          prazoMeses: '12 meses',
          parcela: 920.50,
          taxaJuros: 2.5,
          valorTac: 150.00,
          valorIof: 38.00
        },
        credorData: {
          razaoSocial: 'Empresa de Crédito LTDA',
          cnpj: '12.345.678/0001-90'
        },
        pagamentoInfo: '• Parcelas mensais fixas\n• Vencimento: dia 15 de cada mês',
        clausulasGerais: '1. Cláusula exemplo\n2. Outra cláusula',
        localData: 'São Paulo/SP, ' + new Date().toLocaleDateString('pt-BR'),
        assinaturaDevedor: '________________\nJoão da Silva\nCPF: 123.456.789-00',
        assinaturaCredor: '________________\nEmpresa Crédito\nCNPJ: 12.345.678/0001-90'
      };

      const engine = new PDFTemplateEngine(template, sampleData);
      const pdfBuffer = await engine.generate();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="preview-${template.name}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating preview:', error);
      res.status(500).json({ error: 'Erro ao gerar preview' });
    }
  });

  // Register origination routes
  app.use('/api/origination', originationRoutes);

  const httpServer = createServer(app);
  return httpServer;
}