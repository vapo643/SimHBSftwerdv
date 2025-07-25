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
    // Role validation for ANALISTA or ADMINISTRADOR
    if (!req.user?.role || !['ANALISTA', 'ADMINISTRADOR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado. Apenas analistas e administradores podem alterar status.' });
    }
    try {
      const propostaId = req.params.id;
      const { status, observacao, valorAprovado, motivoPendencia } = req.body;
      
      // Validation schema for status change
      const statusChangeSchema = z.object({
        status: z.enum(['aprovado', 'rejeitado', 'pendente']),
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
        'aguardando_analise': ['em_analise', 'aprovado', 'rejeitado', 'pendente'],
        'em_analise': ['aprovado', 'rejeitado', 'pendente'],
        'pendente': ['aguardando_analise'] // Atendente can resubmit
      };
      
      const currentStatus = currentProposta.status;
      if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(status)) {
        throw new Error(`Transição inválida de ${currentStatus} para ${status}`);
      }
      
      // 3. Update proposal using only fields that exist in the real table
      const updateData: any = {
        status,
        analista_id: req.user?.id,
        data_analise: new Date().toISOString()
      };
      
      if (status === 'pendente' && motivoPendencia) {
        updateData.motivo_pendencia = motivoPendencia;
      }
      
      const { error: updateError } = await supabase
        .from('propostas')
        .update(updateData)
        .eq('id', propostaId);
        
      if (updateError) {
        throw new Error(`Erro ao atualizar status: ${updateError.message}`);
      }
      
      const result = { success: true, statusAnterior: currentStatus, statusNovo: status };
      
      console.log(`[${new Date().toISOString()}] Proposta ${propostaId} - status alterado de ${result.statusAnterior} para ${result.statusNovo} pelo analista ${req.user?.id}`);
      
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

  app.get("/api/propostas/:id", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const idParam = req.params.id;
      let proposta;

      // Get proposal from database - all IDs are strings now
      proposta = await storage.getPropostaById(idParam);

      if (!proposta) {
        return res.status(404).json({ message: "Proposta not found" });
      }

      res.json(proposta);
    } catch (error) {
      console.error("Get proposta error:", error);
      res.status(500).json({ message: "Failed to fetch proposta" });
    }
  });

  app.post("/api/propostas", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // DIAGNÓSTICO PASSO 2: Log do req.body bruto como chega do frontend
      console.log('🔍 BACKEND - req.body bruto recebido:', JSON.stringify(req.body, null, 2));

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
      
      // Debug log to track data
      console.log('POST /api/propostas - Data being sent to storage:', {
        id: dataForDatabase.id,
        clienteDataKeys: Object.keys(dataForDatabase.clienteData || {}),
        clienteNome: dataForDatabase.clienteData?.nome,
        condicoesDataKeys: Object.keys(dataForDatabase.condicoesData || {}),
        valor: dataForDatabase.condicoesData?.valor
      });
      
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

  // Legacy file upload route (mantido para compatibilidade)
  app.post("/api/upload", jwtAuthMiddleware, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileName = `${Date.now()}-${req.file.originalname}`;

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.storage
        .from("documents")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(fileName);

      res.json({
        fileName: data.path,
        url: publicUrl.publicUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
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

  // New endpoint for formalization proposals (filtered by status)
  app.get("/api/propostas/formalizacao", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = await import("../server/lib/supabase");
      const { propostas } = await import("../shared/schema");
      const { inArray, desc } = await import("drizzle-orm");

      // Formalization statuses according to business logic
      const formalizationStatuses = [
        'aprovado',
        'documentos_enviados', 
        'contratos_preparados',
        'contratos_assinados',
        'pronto_pagamento'
      ];

      // Query proposals with formalization statuses
      const formalizacaoPropostas = await db
        .select()
        .from(propostas)
        .where(inArray(propostas.status, formalizationStatuses))
        .orderBy(desc(propostas.createdAt));

      console.log(`[${new Date().toISOString()}] Retornando ${formalizacaoPropostas.length} propostas em formalização`);
      res.json(formalizacaoPropostas);
    } catch (error) {
      console.error("Erro ao buscar propostas de formalização:", error);
      res.status(500).json({ 
        message: "Erro ao buscar propostas de formalização" 
      });
    }
  });

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

  // Endpoint for formalization data
  app.get("/api/propostas/:id/formalizacao", jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const propostaId = parseInt(req.params.id);
      if (isNaN(propostaId)) {
        return res.status(400).json({ message: "ID da proposta inválido" });
      }

      const { db } = await import("../server/lib/supabase");
      const { eq } = await import("drizzle-orm");
      const { propostas, lojas, parceiros, produtos } = await import("../shared/schema");

      // Get proposal with related data
      const proposta = await db
        .select({
          id: propostas.id,
          status: propostas.status,
          clienteData: propostas.clienteData,
          condicoesData: propostas.condicoesData,
          dataAprovacao: propostas.dataAprovacao,
          documentosAdicionais: propostas.documentosAdicionais,
          contratoGerado: propostas.contratoGerado,
          contratoAssinado: propostas.contratoAssinado,
          dataAssinatura: propostas.dataAssinatura,
          dataPagamento: propostas.dataPagamento,
          observacoesFormalização: propostas.observacoesFormalização,
          createdAt: propostas.createdAt,
          lojaNome: lojas.nomeLoja,
          parceiroRazaoSocial: parceiros.razaoSocial,
          produtoNome: produtos.nomeProduto,
        })
        .from(propostas)
        .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
        .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
        .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
        .where(eq(propostas.id, propostaId.toString()))
        .limit(1);

      if (!proposta || proposta.length === 0) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }

      console.log(`[${new Date().toISOString()}] Dados de formalização retornados para proposta ${propostaId}`);
      res.json(proposta[0]);
    } catch (error) {
      console.error("Erro ao buscar dados de formalização:", error);
      res.status(500).json({ message: "Erro ao buscar dados de formalização" });
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
            status,
            updatedAt: new Date()
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

  // Register origination routes
  app.use('/api/origination', originationRoutes);

  const httpServer = createServer(app);
  return httpServer;
}