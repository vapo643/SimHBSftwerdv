import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createServerSupabaseClient } from "../client/src/lib/supabase";
import { authMiddleware, type AuthRequest } from "./lib/auth";
import { rlsAuthMiddleware, validateLojaAccess, type EnhancedAuthRequest } from "./lib/rls-setup";
import { insertPropostaSchema, updatePropostaSchema, insertGerenteLojaSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

// User Management Schema
export const UserDataSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("Formato de email inválido"),
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

const adminMiddleware = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    return res.status(403).json({ message: "Acesso negado. Permissão de administrador necessária." });
  }
  next();
};

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

  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
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

  // Proposal routes
  app.get("/api/propostas", authMiddleware, async (req, res) => {
    try {
      const propostas = await storage.getPropostas();
      res.json(propostas);
    } catch (error) {
      console.error("Get propostas error:", error);
      res.status(500).json({ message: "Failed to fetch propostas" });
    }
  });

  app.get("/api/propostas/:id", authMiddleware, async (req, res) => {
    try {
      const idParam = req.params.id;
      let proposta;

      // Handle both numeric and string IDs
      if (idParam.startsWith("PRO-") || idParam.startsWith("PROP-")) {
        // For string IDs like PRO-001, return mock data for development
        proposta = {
          id: idParam,
          clienteNome: "João Silva",
          clienteCpf: "123.456.789-00",
          clienteEmail: "joao.silva@email.com",
          clienteTelefone: "(11) 99999-9999",
          clienteDataNascimento: "1990-01-01",
          clienteRenda: "5000.00",
          valor: "15000.00",
          prazo: 12,
          finalidade: "Capital de giro",
          garantia: "Sem garantia",
          status: "em_analise",
          documentos: ["documento1.pdf", "documento2.pdf"],
          createdAt: new Date().toISOString(),
          score: 750,
          parceiro: "Parceiro A",
          loja: "Loja Central"
        };
      } else {
        // For numeric IDs, use database
        const id = parseInt(idParam);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid proposal ID format" });
        }
        proposta = await storage.getPropostaById(id);
      }

      if (!proposta) {
        return res.status(404).json({ message: "Proposta not found" });
      }

      res.json(proposta);
    } catch (error) {
      console.error("Get proposta error:", error);
      res.status(500).json({ message: "Failed to fetch proposta" });
    }
  });

  app.post("/api/propostas", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertPropostaSchema.parse(req.body);
      const proposta = await storage.createProposta(validatedData);
      res.status(201).json(proposta);
    } catch (error) {
      if (error instanceof z.ZodError) {
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
  app.post("/nova-proposta", authMiddleware, async (req: AuthRequest, res) => {
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

  app.patch("/api/propostas/:id", authMiddleware, async (req, res) => {
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

  app.get("/api/propostas/status/:status", authMiddleware, async (req, res) => {
    try {
      const status = req.params.status;
      const propostas = await storage.getPropostasByStatus(status);
      res.json(propostas);
    } catch (error) {
      console.error("Get propostas by status error:", error);
      res.status(500).json({ message: "Failed to fetch propostas" });
    }
  });

  // File upload route
  app.post("/api/upload", authMiddleware, upload.single("file"), async (req, res) => {
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
app.get("/api/tabelas-comerciais-disponiveis", authMiddleware, async (req, res) => {
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
    const { tabelasComerciais } = await import("../shared/schema");

    // STEP 1: Busca Prioritária - Tabelas Personalizadas (produto + parceiro)
    const tabelasPersonalizadas = await db
      .select()
      .from(tabelasComerciais)
      .where(
        and(
          eq(tabelasComerciais.produtoId, produtoIdNum),
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
    const tabelasGerais = await db
      .select()
      .from(tabelasComerciais)
      .where(
        and(
          eq(tabelasComerciais.produtoId, produtoIdNum),
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

  // Mock data para prazos
  const prazos = [
    { id: 1, valor: "12 meses" },
    { id: 2, valor: "24 meses" },
    { id: 3, valor: "36 meses" },
  ];

  // API endpoint for partners - GET all
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

  // API endpoint for partners - POST create
  app.post("/api/admin/parceiros", authMiddleware, async (req, res) => {
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
  app.put("/api/admin/parceiros/:id", authMiddleware, async (req, res) => {
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
  app.delete("/api/admin/parceiros/:id", authMiddleware, async (req, res) => {
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

      // Verificar se o produto está em uso
      const emUso = await verificarProdutoEmUso(id);
      if (emUso) {
        return res.status(400).json({ 
          message: "Não é possível excluir este produto pois ele está sendo utilizado em tabelas comerciais" 
        });
      }

      await deletarProduto(id);
      res.json({ message: "Produto excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
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
      taxaJurosMensal: taxaDeJurosMensal,
      iof: parseFloat(iof.toFixed(2)),
      valorTac: tac,
      cet: parseFloat(cetAnual.toFixed(2)),
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

  // Update proposal status
  app.put("/api/propostas/:id/status", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, observacao } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status é obrigatório" });
      }

      // Mock update - in real app would update database
      const mockUpdatedProposta = {
        id,
        status,
        observacao,
        updatedAt: new Date().toISOString(),
      };

      res.json(mockUpdatedProposta);
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // Get proposal logs
  app.get("/api/propostas/:id/logs", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      // Mock logs data
      const mockLogs = [
        {
          id: 1,
          status_novo: "Em Análise",
          observacao: "Proposta iniciada para análise",
          user_id: "user-123",
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
        {
          id: 2,
          status_novo: "Pendente",
          observacao: "Documentos adicionais necessários",
          user_id: "user-456",
          created_at: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        },
      ];

      res.json(mockLogs);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ message: "Erro ao carregar histórico" });
    }
  });



  // Dashboard stats
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
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
  app.get("/api/gerentes/:gerenteId/lojas", authMiddleware, async (req, res) => {
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
  app.get("/api/lojas/:lojaId/gerentes", authMiddleware, async (req, res) => {
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
  app.post("/api/gerente-lojas", authMiddleware, async (req, res) => {
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
  app.delete("/api/gerente-lojas/:gerenteId/:lojaId", authMiddleware, async (req, res) => {
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
  app.get("/api/gerentes/:gerenteId/relationships", authMiddleware, async (req, res) => {
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

  app.post("/api/admin/users", authMiddleware, rlsAuthMiddleware, adminMiddleware, async (req: any, res: any) => {
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

  const httpServer = createServer(app);
  return httpServer;
}