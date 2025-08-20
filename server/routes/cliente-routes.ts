import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../lib/supabase";
import { propostas } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Buscar dados do cliente por CPF
router.get("/clientes/cpf/:cpf", async (req: Request, res: Response) => {
  try {
    const { cpf } = req.params;
    const cleanCPF = cpf.replace(/\D/g, "");

    if (!cleanCPF || cleanCPF.length !== 11) {
      return res.status(400).json({ error: "CPF inválido" });
    }

    console.log(`[CLIENTE API] Buscando dados para CPF: ${cleanCPF}`);

    // Buscar a proposta mais recente do cliente
    const [latestProposal] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.clienteCpf, cleanCPF))
      .orderBy(desc(propostas.createdAt))
      .limit(1);

    if (!latestProposal) {
      console.log(`[CLIENTE API] Nenhuma proposta encontrada para CPF: ${cleanCPF}`);
      return res.json({ exists: false });
    }

    console.log(`[CLIENTE API] Proposta encontrada: ${latestProposal.numeroProposta} para CPF: ${cleanCPF}`);

    // Retornar dados do cliente da proposta mais recente
    const clientData = {
      exists: true,
      data: {
        // Dados básicos
        nome: latestProposal.clienteNome || "",
        email: latestProposal.clienteEmail || "",
        telefone: latestProposal.clienteTelefone || "",
        cpf: latestProposal.clienteCpf || "",
        
        // Dados pessoais
        dataNascimento: latestProposal.clienteDataNascimento || "",
        rg: latestProposal.clienteRg || "",
        orgaoEmissor: latestProposal.clienteOrgaoEmissor || "",
        rgUf: latestProposal.clienteRgUf || "",
        rgDataEmissao: latestProposal.clienteRgDataEmissao || "",
        estadoCivil: latestProposal.clienteEstadoCivil || "",
        nacionalidade: latestProposal.clienteNacionalidade || "",
        localNascimento: latestProposal.clienteLocalNascimento || "",
        
        // Endereço
        cep: latestProposal.clienteCep || "",
        logradouro: latestProposal.clienteLogradouro || "",
        numero: latestProposal.clienteNumero || "",
        complemento: latestProposal.clienteComplemento || "",
        bairro: latestProposal.clienteBairro || "",
        cidade: latestProposal.clienteCidade || "",
        estado: latestProposal.clienteUf || "",
        
        // Dados profissionais
        ocupacao: latestProposal.clienteOcupacao || "",
        rendaMensal: latestProposal.clienteRenda || "",
        telefoneEmpresa: latestProposal.clienteEmpresaNome || "", // Usando nome da empresa como alternativa
        
        // Dados de pagamento
        metodoPagamento: latestProposal.metodoPagamento || "conta_bancaria",
        dadosPagamentoBanco: latestProposal.dadosPagamentoBanco || "",
        dadosPagamentoAgencia: latestProposal.dadosPagamentoAgencia || "",
        dadosPagamentoConta: latestProposal.dadosPagamentoConta || "",
        dadosPagamentoDigito: latestProposal.dadosPagamentoDigito || "",
        dadosPagamentoPix: latestProposal.dadosPagamentoPix || "",
        dadosPagamentoTipoPix: latestProposal.dadosPagamentoTipoPix || "",
        dadosPagamentoPixBanco: latestProposal.dadosPagamentoPixBanco || "",
        dadosPagamentoPixNomeTitular: latestProposal.dadosPagamentoPixNomeTitular || "",
        dadosPagamentoPixCpfTitular: latestProposal.dadosPagamentoPixCpfTitular || "",
      }
    };

    return res.json(clientData);
  } catch (error) {
    console.error("Erro ao buscar cliente por CPF:", error);
    res.status(500).json({ error: "Erro ao buscar dados do cliente" });
  }
});

// Buscar endereço por CEP (fallback próprio caso API externa falhe)
router.get("/cep/:cep", async (req: Request, res: Response) => {
  try {
    const { cep } = req.params;
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return res.status(400).json({ error: "CEP inválido" });
    }

    // Tentar múltiplas APIs de CEP
    const apis = [
      `https://viacep.com.br/ws/${cleanCep}/json/`,
      `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
      `https://cep.awesomeapi.com.br/json/${cleanCep}`,
    ];

    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();

          // Normalizar resposta das diferentes APIs
          if (apiUrl.includes("viacep")) {
            if (!data.erro) {
              return res.json({
                logradouro: data.logradouro || "",
                bairro: data.bairro || "",
                cidade: data.localidade || "",
                estado: data.uf || "",
                cep: data.cep || cleanCep,
              });
            }
          } else if (apiUrl.includes("brasilapi")) {
            return res.json({
              logradouro: data.street || "",
              bairro: data.neighborhood || "",
              cidade: data.city || "",
              estado: data.state || "",
              cep: data.cep || cleanCep,
            });
          } else if (apiUrl.includes("awesomeapi")) {
            return res.json({
              logradouro: data.address || "",
              bairro: data.district || "",
              cidade: data.city || "",
              estado: data.state || "",
              cep: data.cep || cleanCep,
            });
          }
        }
      } catch (apiError) {
        console.log(`API ${apiUrl} falhou, tentando próxima...`);
        continue;
      }
    }

    return res.status(404).json({ error: "CEP não encontrado" });
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    res.status(500).json({ error: "Erro ao buscar CEP" });
  }
});

export default router;
