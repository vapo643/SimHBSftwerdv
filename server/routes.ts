import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createServerSupabaseClient } from "../client/src/lib/supabase";
import { authMiddleware, type AuthRequest } from "./lib/auth";
import { insertPropostaSchema, updatePropostaSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        return res.status(401).json({ message: error.message });
      }
      
      res.json({ 
        user: data.user, 
        session: data.session 
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
            name
          }
        }
      });
      
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      
      res.json({ 
        user: data.user, 
        session: data.session 
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
      const id = parseInt(req.params.id);
      const proposta = await storage.getPropostaById(id);
      
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
      const { data: publicUrl } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      res.json({ 
        fileName: data.path,
        url: publicUrl.publicUrl
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Mock data para produtos e prazos
  const produtos = [
    { id: 1, nome: 'Crédito Pessoal' },
    { id: 2, nome: 'Crédito Imobiliário' },
    { id: 3, nome: 'Crédito Consignado' },
  ];

  const prazos = [
    { id: 1, valor: '12 meses' },
    { id: 2, valor: '24 meses' },
    { id: 3, valor: '36 meses' },
  ];

  // Rota para buscar produtos
  app.get('/api/produtos', (req, res) => {
    res.json(produtos);
  });

  // Rota para buscar prazos
  app.get('/api/prazos', (req, res) => {
    res.json(prazos);
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const allPropostas = await storage.getPropostas();
      
      const stats = {
        totalPropostas: allPropostas.length,
        aguardandoAnalise: allPropostas.filter(p => p.status === "aguardando_analise").length,
        aprovadas: allPropostas.filter(p => p.status === "aprovado").length,
        valorTotal: allPropostas.reduce((sum, p) => sum + parseFloat(p.valor), 0)
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
