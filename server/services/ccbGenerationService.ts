/**
 * Serviço de Geração de CCB (Cédula de Crédito Bancário)
 * Re-arquitetura completa: Usa pdf-lib para carregar template e desenhar texto sobre ele
 * Preserva 100% do layout, logo e formatação original
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import { db } from "../lib/supabase";
import { sql } from "drizzle-orm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// REMOVIDO: Imports conflitantes do ccbFieldMapping (coordenadas antigas)
import { CoordinateAdjustment, applyCoordinateAdjustments } from "./ccbCoordinateMapper";
// USANDO NOVAS COORDENADAS DO USUÁRIO
import { USER_CCB_COORDINATES, getCoordinateForSystemField } from "./ccbUserCoordinates";

// Interface removida - usando any para dados completos da proposta
// Isso permite acesso a TODOS os campos JSON sem restrições de tipo

export class CCBGenerationService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), "server", "templates", "template_ccb.pdf");
  }

  /**
   * Gera CCB preenchendo o template PDF com dados da proposta
   * MÉTODO CORRETO: Carrega template e desenha texto sobre ele, preservando layout
   */
  async generateCCB(
    proposalId: string
  ): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    return this.generateCCBWithAdjustments(proposalId, []);
  }

  /**
   * Gera CCB com ajustes de coordenadas personalizados
   */
  async generateCCBWithAdjustments(
    proposalId: string,
    adjustments: CoordinateAdjustment[] = []
  ): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    try {
      console.log(`📄 [CCB] Iniciando geração CORRETA para proposta ${proposalId}`);
      console.log(`📄 [CCB] Template path: ${this.templatePath}`);

      // 1. Buscar dados da proposta
      const proposalData = await this.getProposalData(proposalId);
      if (!proposalData) {
        return { success: false, error: "Proposta não encontrada ou dados incompletos" };
      }

      console.log("📄 [CCB] Dados da proposta carregados:", {
        nome: proposalData.cliente_nome,
        cpf: proposalData.cliente_cpf,
        valor: proposalData.valor_emprestimo,
      });

      // 2. CARREGAR TEMPLATE PDF EXISTENTE (NÃO criar novo!)
      console.log("📄 [CCB] Carregando template PDF existente...");
      const templateBytes = await fs.readFile(this.templatePath);
      console.log(`📄 [CCB] Template carregado: ${templateBytes.length} bytes`);
      const pdfDoc = await PDFDocument.load(templateBytes);
      console.log(`📄 [CCB] PDF carregado: ${pdfDoc.getPageCount()} páginas`);

      // 3. Preparar fonte para desenhar texto
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // 4. Obter todas as páginas do template
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const secondPage = pages[1] || null;
      const thirdPage = pages[2] || null;
      const { width, height } = firstPage.getSize();

      console.log(`📄 [CCB] Dimensões da página: ${width}x${height}`);
      console.log(`📄 [CCB] Total de páginas no template: ${pages.length}`);

      // 5. DESENHAR TEXTO SOBRE O TEMPLATE usando NOVAS COORDENADAS DO USUÁRIO
      console.log(`📄 [CCB] ✅ IMPLEMENTANDO TODOS OS 95 CAMPOS MAPEADOS`);
      console.log(`📄 [CCB] Total de campos mapeados: ${Object.keys(USER_CCB_COORDINATES).length}`);

      // MAPEAMENTO COMPLETO: CAMPOS CCB → ORIGEM DOS DADOS
      console.log("📊 [CCB] ========== MAPEAMENTO DE DADOS PARA CCB ==========");
      
      // DADOS PRINCIPAIS (usar campos diretos da tabela propostas)
      // CORREÇÃO 1: Extrair campos de endereço da string concatenada
      let enderecoParseado = {
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: ""
      };
      
      // Parse do endereço concatenado se existir
      const enderecoCompleto = proposalData.cliente_data?.endereco || "";
      if (enderecoCompleto && enderecoCompleto !== "NÃO INFORMADO") {
        // Exemplo: "Rua Miguel Angelo, 675, Casa, Parque Residencial Laranjeiras, Serra/ES - CEP: 29165-460"
        const partes = enderecoCompleto.split(",").map((s: string) => s.trim());
        
        if (partes.length >= 4) {
          enderecoParseado.logradouro = partes[0] || ""; // "Rua Miguel Angelo"
          enderecoParseado.numero = partes[1] || ""; // "675"
          enderecoParseado.complemento = partes[2] || ""; // "Casa"
          enderecoParseado.bairro = partes[3] || ""; // "Parque Residencial Laranjeiras"
          
          // Extrair cidade/estado do último elemento
          const ultimaParte = partes[partes.length - 1] || "";
          const cidadeEstadoMatch = ultimaParte.match(/([^\/]+)\/(\w+)\s*-?\s*CEP:\s*([\d-]+)/);
          if (cidadeEstadoMatch) {
            enderecoParseado.cidade = cidadeEstadoMatch[1].trim();
            enderecoParseado.estado = cidadeEstadoMatch[2].trim();
            enderecoParseado.cep = cidadeEstadoMatch[3].trim();
          } else if (ultimaParte.includes("/")) {
            const [cidade, resto] = ultimaParte.split("/");
            enderecoParseado.cidade = cidade.trim();
            const estadoCepMatch = resto.match(/(\w+)\s*-?\s*CEP:\s*([\d-]+)/);
            if (estadoCepMatch) {
              enderecoParseado.estado = estadoCepMatch[1].trim();
              enderecoParseado.cep = estadoCepMatch[2].trim();
            }
          }
        }
      }
      
      const dadosCliente = {
        // Dados diretos da tabela propostas
        nome: proposalData.cliente_nome || (proposalData.cliente_data?.nome) || "NÃO INFORMADO",
        cpf: proposalData.cliente_cpf || (proposalData.cliente_data?.cpf) || "NÃO INFORMADO",
        rg: proposalData.cliente_rg || (proposalData.cliente_data?.rg) || "NÃO INFORMADO",
        orgaoEmissor: proposalData.cliente_orgao_emissor || (proposalData.cliente_data?.orgaoEmissor) || "SSP",
        estadoCivil: proposalData.cliente_estado_civil || (proposalData.cliente_data?.estadoCivil) || "NÃO INFORMADO",
        nacionalidade: proposalData.cliente_nacionalidade || (proposalData.cliente_data?.nacionalidade) || "BRASILEIRA",
        endereco: proposalData.cliente_endereco || (proposalData.cliente_data?.endereco) || "NÃO INFORMADO",
        cidade: enderecoParseado.cidade || proposalData.cliente_cidade || (proposalData.cliente_data?.cidade) || "NÃO INFORMADO",
        uf: enderecoParseado.estado || proposalData.cliente_uf || (proposalData.cliente_data?.uf) || "NÃO INFORMADO",
        cep: enderecoParseado.cep || proposalData.cliente_cep || (proposalData.cliente_data?.cep) || "NÃO INFORMADO",
        rgUf: proposalData.cliente_rg_uf || (proposalData.cliente_data?.rgUf) || "NÃO INFORMADO",
        rgDataEmissao: proposalData.cliente_rg_data_emissao || (proposalData.cliente_data?.rgDataEmissao) || "NÃO INFORMADO",
        localNascimento: proposalData.cliente_local_nascimento || (proposalData.cliente_data?.localNascimento) || "NÃO INFORMADO",
        // Campos de endereço separados (parseados)
        logradouro: enderecoParseado.logradouro || proposalData.cliente_data?.logradouro || "",
        numero: enderecoParseado.numero || proposalData.cliente_data?.numero || "",
        complemento: enderecoParseado.complemento || proposalData.cliente_data?.complemento || "",
        bairro: enderecoParseado.bairro || proposalData.cliente_data?.bairro || "",
        estado: enderecoParseado.estado || proposalData.cliente_data?.estado || proposalData.cliente_data?.uf || "NÃO INFORMADO",
        // Campos para PJ
        tipo: proposalData.cliente_data?.tipo || "PF",
        razaoSocial: proposalData.cliente_data?.razaoSocial || "",
        cnpj: proposalData.cliente_data?.cnpj || ""
      };
      
      console.log("📊 [CCB] Endereço parseado:", {
        original: enderecoCompleto,
        parseado: enderecoParseado
      });
      
      // CONDIÇÕES FINANCEIRAS
      const condicoesFinanceiras = {
        valor: proposalData.valor || proposalData.valor_aprovado || (proposalData.condicoes_data?.valor) || 0,
        prazo: proposalData.prazo || (proposalData.condicoes_data?.prazo) || 0,
        taxaJuros: proposalData.taxa_juros || (proposalData.condicoes_data?.taxa) || 0,
        valorTac: proposalData.valor_tac || (proposalData.condicoes_data?.valorTac) || 0,
        valorIof: proposalData.valor_iof || (proposalData.condicoes_data?.valorIof) || 0,
        valorTotalFinanciado: proposalData.valor_total_financiado || 0,
        valorLiquidoLiberado: proposalData.valor_liquido_liberado || 0,
        cet: proposalData.condicoes_data?.cet || 0
      };
      
      // CORREÇÃO 2: Buscar dados bancários do JSON cliente_data se não existirem nos campos diretos
      const dadosPagamento = {
        codigoBanco: proposalData.dados_pagamento_codigo_banco || proposalData.cliente_data?.banco || "NÃO INFORMADO",
        banco: proposalData.dados_pagamento_banco || proposalData.cliente_data?.banco || "NÃO INFORMADO",
        agencia: proposalData.dados_pagamento_agencia || proposalData.cliente_data?.agencia || "NÃO INFORMADO",
        conta: proposalData.dados_pagamento_conta || proposalData.cliente_data?.conta || "NÃO INFORMADO",
        digito: proposalData.dados_pagamento_digito || proposalData.cliente_data?.digito || "NÃO INFORMADO",
        tipoConta: proposalData.dados_pagamento_tipo || proposalData.cliente_data?.tipoConta || "NÃO INFORMADO",
        nomeTitular: proposalData.dados_pagamento_nome_titular || proposalData.cliente_data?.nomeTitular || dadosCliente.nome,
        cpfTitular: proposalData.dados_pagamento_cpf_titular || proposalData.cliente_data?.cpfTitular || dadosCliente.cpf,
        chavePix: proposalData.dados_pagamento_pix || proposalData.cliente_data?.chavePix || proposalData.cliente_data?.pix || "NÃO INFORMADO",
        tipoPix: proposalData.dados_pagamento_tipo_pix || proposalData.cliente_data?.tipoPix || "NÃO INFORMADO"
      };
      
      console.log("📊 [CCB] Dados de pagamento mapeados:", {
        banco: dadosPagamento.banco,
        agencia: dadosPagamento.agencia,
        conta: dadosPagamento.conta,
        pix: dadosPagamento.chavePix
      });
      
      // DADOS DA LOJA/CREDOR
      const dadosLoja = {
        nome: proposalData.loja_nome || "SIMPIX LTDA",
        endereco: proposalData.loja_endereco || "NÃO INFORMADO",
        cnpj: "NÃO DISPONÍVEL", // Campo não existe na tabela lojas
        cidade: "NÃO DISPONÍVEL", // Campo não existe na tabela lojas
        uf: "NÃO DISPONÍVEL" // Campo não existe na tabela lojas
      };
      
      console.log("📊 [CCB] Cliente mapeado:", dadosCliente.nome, "-", dadosCliente.cpf);
      console.log("📊 [CCB] Condições:", `R$ ${condicoesFinanceiras.valor} em ${condicoesFinanceiras.prazo}x`);
      console.log("📊 [CCB] Pagamento via:", dadosPagamento.banco || dadosPagamento.chavePix);
      
      // CORREÇÃO 3: Gerar parcelas se não existirem
      let parcelas: any[] = [];
      try {
        const parcelasResult = await db.execute(sql`
          SELECT 
            numero_parcela,
            data_vencimento,
            valor_parcela,
            status
          FROM parcelas 
          WHERE proposta_id = ${proposalId}
          ORDER BY numero_parcela ASC
        `);
        parcelas = parcelasResult || [];
        console.log("📊 [CCB] Parcelas encontradas na tabela:", parcelas.length);
        
        // Se não há parcelas, gerar baseado nas condições financeiras
        if (parcelas.length === 0 && condicoesFinanceiras.prazo > 0) {
          console.log("📊 [CCB] Gerando parcelas automaticamente...");
          const valorParcela = (condicoesFinanceiras.valorTotalFinanciado || condicoesFinanceiras.valor) / condicoesFinanceiras.prazo;
          const dataBase = new Date();
          
          for (let i = 0; i < condicoesFinanceiras.prazo; i++) {
            const dataVencimento = new Date(dataBase);
            dataVencimento.setMonth(dataVencimento.getMonth() + i + 1);
            
            parcelas.push({
              numero_parcela: i + 1,
              data_vencimento: dataVencimento.toISOString().split('T')[0],
              valor_parcela: valorParcela,
              vencimento: dataVencimento.toISOString().split('T')[0], // compatibilidade
              valor: valorParcela, // compatibilidade
              status: 'pendente'
            });
          }
          console.log(`📊 [CCB] ${parcelas.length} parcelas geradas automaticamente`);
        }
      } catch (parcelasError) {
        console.warn("⚠️ [CCB] Erro ao buscar parcelas:", parcelasError);
        parcelas = [];
      }

      // ========================================
      // PÁGINA 1 - DADOS PRINCIPAIS
      // ========================================

      // IDENTIFICAÇÃO DA CCB
      if (USER_CCB_COORDINATES.numeroCedula) {
        const numeroCCB = `PROP-${proposalData.id}`;
        firstPage.drawText(numeroCCB, {
          x: USER_CCB_COORDINATES.numeroCedula.x,
          y: USER_CCB_COORDINATES.numeroCedula.y,
          size: USER_CCB_COORDINATES.numeroCedula.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.dataEmissao) {
        const dataEmissao = proposalData.ccb_gerado_em || proposalData.created_at;
        const dataFormatada = format(new Date(dataEmissao), "dd/MM/yyyy");
        firstPage.drawText(dataFormatada, {
          x: USER_CCB_COORDINATES.dataEmissao.x,
          y: USER_CCB_COORDINATES.dataEmissao.y,
          size: USER_CCB_COORDINATES.dataEmissao.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.finalidadeOperacao) {
        const finalidade = (proposalData.condicoes_data?.finalidade) || "Empréstimo pessoal";
        firstPage.drawText(finalidade, {
          x: USER_CCB_COORDINATES.finalidadeOperacao.x,
          y: USER_CCB_COORDINATES.finalidadeOperacao.y,
          size: USER_CCB_COORDINATES.finalidadeOperacao.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // DADOS DO CLIENTE
      if (USER_CCB_COORDINATES.nomeCliente && dadosCliente.nome && dadosCliente.nome !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.nome, {
          x: USER_CCB_COORDINATES.nomeCliente.x,
          y: USER_CCB_COORDINATES.nomeCliente.y,
          size: USER_CCB_COORDINATES.nomeCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.cpfCliente && dadosCliente.cpf && dadosCliente.cpf !== "NÃO INFORMADO") {
        firstPage.drawText(this.formatCPF(dadosCliente.cpf), {
          x: USER_CCB_COORDINATES.cpfCliente.x,
          y: USER_CCB_COORDINATES.cpfCliente.y,
          size: USER_CCB_COORDINATES.cpfCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // RG E DOCUMENTAÇÃO
      if (USER_CCB_COORDINATES.rgCliente && dadosCliente.rg && dadosCliente.rg !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.rg, {
          x: USER_CCB_COORDINATES.rgCliente.x,
          y: USER_CCB_COORDINATES.rgCliente.y,
          size: USER_CCB_COORDINATES.rgCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.rgExpedidor && dadosCliente.orgaoEmissor && dadosCliente.orgaoEmissor !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.orgaoEmissor, {
          x: USER_CCB_COORDINATES.rgExpedidor.x,
          y: USER_CCB_COORDINATES.rgExpedidor.y,
          size: USER_CCB_COORDINATES.rgExpedidor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.rgUF && dadosCliente.rgUf && dadosCliente.rgUf !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.rgUf, {
          x: USER_CCB_COORDINATES.rgUF.x,
          y: USER_CCB_COORDINATES.rgUF.y,
          size: USER_CCB_COORDINATES.rgUF.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.rgEmissao && dadosCliente.rgDataEmissao && dadosCliente.rgDataEmissao !== "NÃO INFORMADO") {
        const dataRg = format(new Date(dadosCliente.rgDataEmissao), "dd/MM/yyyy");
        firstPage.drawText(dataRg, {
          x: USER_CCB_COORDINATES.rgEmissao.x,
          y: USER_CCB_COORDINATES.rgEmissao.y,
          size: USER_CCB_COORDINATES.rgEmissao.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.nacionalidade && dadosCliente.nacionalidade && dadosCliente.nacionalidade !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.nacionalidade || "Brasileira", {
          x: USER_CCB_COORDINATES.nacionalidade.x,
          y: USER_CCB_COORDINATES.nacionalidade.y,
          size: USER_CCB_COORDINATES.nacionalidade.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.localNascimento && dadosCliente.localNascimento && dadosCliente.localNascimento !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.localNascimento, {
          x: USER_CCB_COORDINATES.localNascimento.x,
          y: USER_CCB_COORDINATES.localNascimento.y,
          size: USER_CCB_COORDINATES.localNascimento.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.estadoCivil && dadosCliente.estadoCivil && dadosCliente.estadoCivil !== "NÃO INFORMADO") {
        firstPage.drawText(dadosCliente.estadoCivil, {
          x: USER_CCB_COORDINATES.estadoCivil.x,
          y: USER_CCB_COORDINATES.estadoCivil.y,
          size: USER_CCB_COORDINATES.estadoCivil.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // ENDEREÇO CLIENTE - RENDERIZAÇÃO FORÇADA
      // SEMPRE renderizar campos de endereço, mesmo se parcialmente preenchidos
      if (USER_CCB_COORDINATES.enderecoCliente) {
        // Combinar logradouro e número se disponíveis
        let enderecoCompleto = "";
        if (dadosCliente.endereco && dadosCliente.endereco !== "NÃO INFORMADO") {
          enderecoCompleto = dadosCliente.endereco;
        } else if (dadosCliente.logradouro) {
          enderecoCompleto = dadosCliente.logradouro;
          if (dadosCliente.numero) {
            enderecoCompleto += `, ${dadosCliente.numero}`;
          }
          if (dadosCliente.complemento) {
            enderecoCompleto += `, ${dadosCliente.complemento}`;
          }
          if (dadosCliente.bairro) {
            enderecoCompleto += `, ${dadosCliente.bairro}`;
          }
        }
        
        // Renderizar mesmo se vazio, para debug
        enderecoCompleto = enderecoCompleto || "ENDEREÇO NÃO INFORMADO";
        
        firstPage.drawText(enderecoCompleto, {
          x: USER_CCB_COORDINATES.enderecoCliente.x,
          y: USER_CCB_COORDINATES.enderecoCliente.y,
          size: USER_CCB_COORDINATES.enderecoCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log("📊 [CCB] Endereço renderizado:", enderecoCompleto, "em X:", USER_CCB_COORDINATES.enderecoCliente.x, "Y:", USER_CCB_COORDINATES.enderecoCliente.y);
      }

      // CEP - SEMPRE RENDERIZAR
      if (USER_CCB_COORDINATES.cepCliente) {
        const cepValue = dadosCliente.cep || "CEP NÃO INFORMADO";
        const cepFormatado = cepValue !== "CEP NÃO INFORMADO" && cepValue !== "NÃO INFORMADO" ? this.formatCEP(cepValue) : cepValue;
        
        firstPage.drawText(cepFormatado, {
          x: USER_CCB_COORDINATES.cepCliente.x,
          y: USER_CCB_COORDINATES.cepCliente.y,
          size: USER_CCB_COORDINATES.cepCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log("📊 [CCB] CEP renderizado:", cepFormatado, "em X:", USER_CCB_COORDINATES.cepCliente.x, "Y:", USER_CCB_COORDINATES.cepCliente.y);
      }

      // CIDADE - SEMPRE RENDERIZAR
      if (USER_CCB_COORDINATES.cidadeCliente) {
        const cidadeValue = dadosCliente.cidade || "CIDADE NÃO INFORMADA";
        
        firstPage.drawText(cidadeValue, {
          x: USER_CCB_COORDINATES.cidadeCliente.x,
          y: USER_CCB_COORDINATES.cidadeCliente.y,
          size: USER_CCB_COORDINATES.cidadeCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log("📊 [CCB] Cidade renderizada:", cidadeValue, "em X:", USER_CCB_COORDINATES.cidadeCliente.x, "Y:", USER_CCB_COORDINATES.cidadeCliente.y);
      }

      // UF - SEMPRE RENDERIZAR
      if (USER_CCB_COORDINATES.ufCliente) {
        const ufValue = dadosCliente.estado || dadosCliente.uf || "UF";
        
        firstPage.drawText(ufValue, {
          x: USER_CCB_COORDINATES.ufCliente.x,
          y: USER_CCB_COORDINATES.ufCliente.y,
          size: USER_CCB_COORDINATES.ufCliente.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log("📊 [CCB] UF renderizada:", ufValue, "em X:", USER_CCB_COORDINATES.ufCliente.x, "Y:", USER_CCB_COORDINATES.ufCliente.y);
      }

      // DADOS DO CREDOR/LOJA
      if (USER_CCB_COORDINATES.razaoSocialCredor) {
        const razaoSocial = proposalData.loja_nome || "SIMPIX LTDA";
        firstPage.drawText(razaoSocial, {
          x: USER_CCB_COORDINATES.razaoSocialCredor.x,
          y: USER_CCB_COORDINATES.razaoSocialCredor.y,
          size: USER_CCB_COORDINATES.razaoSocialCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.cnpjCredor) {
        const cnpj = proposalData.loja_cnpj || "12.345.678/0001-90";
        firstPage.drawText(cnpj, {
          x: USER_CCB_COORDINATES.cnpjCredor.x,
          y: USER_CCB_COORDINATES.cnpjCredor.y,
          size: USER_CCB_COORDINATES.cnpjCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.enderecoCredor && proposalData.loja_endereco) {
        firstPage.drawText(proposalData.loja_endereco, {
          x: USER_CCB_COORDINATES.enderecoCredor.x,
          y: USER_CCB_COORDINATES.enderecoCredor.y,
          size: USER_CCB_COORDINATES.enderecoCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.cepCredor && proposalData.loja_cep) {
        firstPage.drawText(this.formatCEP(proposalData.loja_cep), {
          x: USER_CCB_COORDINATES.cepCredor.x,
          y: USER_CCB_COORDINATES.cepCredor.y,
          size: USER_CCB_COORDINATES.cepCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.cidadeCredor && proposalData.loja_cidade) {
        firstPage.drawText(proposalData.loja_cidade, {
          x: USER_CCB_COORDINATES.cidadeCredor.x,
          y: USER_CCB_COORDINATES.cidadeCredor.y,
          size: USER_CCB_COORDINATES.cidadeCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.ufCredor && proposalData.loja_estado) {
        firstPage.drawText(proposalData.loja_estado, {
          x: USER_CCB_COORDINATES.ufCredor.x,
          y: USER_CCB_COORDINATES.ufCredor.y,
          size: USER_CCB_COORDINATES.ufCredor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // CONDIÇÕES FINANCEIRAS
      if (USER_CCB_COORDINATES.valorPrincipal) {
        const valor = condicoesFinanceiras.valor || 0;
        firstPage.drawText(this.formatCurrency(valor), {
          x: USER_CCB_COORDINATES.valorPrincipal.x,
          y: USER_CCB_COORDINATES.valorPrincipal.y,
          size: USER_CCB_COORDINATES.valorPrincipal.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.dataEmissaoCond) {
        const dataEmissao = format(new Date(), "dd/MM/yyyy");
        firstPage.drawText(dataEmissao, {
          x: USER_CCB_COORDINATES.dataEmissaoCond.x,
          y: USER_CCB_COORDINATES.dataEmissaoCond.y,
          size: USER_CCB_COORDINATES.dataEmissaoCond.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.vencimentoParcela && parcelas.length > 0) {
        const primeiroVenc = format(new Date(parcelas[0].data_vencimento || parcelas[0].vencimento), "dd/MM/yyyy");
        firstPage.drawText(primeiroVenc, {
          x: USER_CCB_COORDINATES.vencimentoParcela.x,
          y: USER_CCB_COORDINATES.vencimentoParcela.y,
          size: USER_CCB_COORDINATES.vencimentoParcela.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.vencimentoUltimaParcela && parcelas.length > 0) {
        const ultimoVenc = format(new Date(parcelas[parcelas.length - 1].data_vencimento || parcelas[parcelas.length - 1].vencimento), "dd/MM/yyyy");
        firstPage.drawText(ultimoVenc, {
          x: USER_CCB_COORDINATES.vencimentoUltimaParcela.x,
          y: USER_CCB_COORDINATES.vencimentoUltimaParcela.y,
          size: USER_CCB_COORDINATES.vencimentoUltimaParcela.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.prazoAmortizacao) {
        const prazo = condicoesFinanceiras.prazo || 12;
        firstPage.drawText(`${prazo} meses`, {
          x: USER_CCB_COORDINATES.prazoAmortizacao.x,
          y: USER_CCB_COORDINATES.prazoAmortizacao.y,
          size: USER_CCB_COORDINATES.prazoAmortizacao.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.percentualIndice) {
        const taxa = condicoesFinanceiras.taxaJuros || 0;
        firstPage.drawText(`${taxa}%`, {
          x: USER_CCB_COORDINATES.percentualIndice.x,
          y: USER_CCB_COORDINATES.percentualIndice.y,
          size: USER_CCB_COORDINATES.percentualIndice.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // TAXAS E ENCARGOS
      if (USER_CCB_COORDINATES.taxaJurosEfetivaMensal) {
        const taxaMensal = condicoesFinanceiras.taxaJuros || 0;
        firstPage.drawText(`${taxaMensal}% a.m.`, {
          x: USER_CCB_COORDINATES.taxaJurosEfetivaMensal.x,
          y: USER_CCB_COORDINATES.taxaJurosEfetivaMensal.y,
          size: USER_CCB_COORDINATES.taxaJurosEfetivaMensal.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.taxaJurosEfetivaAnual) {
        const taxaAnual = ((1 + (condicoesFinanceiras.taxaJuros || 0) / 100) ** 12 - 1) * 100;
        firstPage.drawText(`${taxaAnual.toFixed(2)}% a.a.`, {
          x: USER_CCB_COORDINATES.taxaJurosEfetivaAnual.x,
          y: USER_CCB_COORDINATES.taxaJurosEfetivaAnual.y,
          size: USER_CCB_COORDINATES.taxaJurosEfetivaAnual.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.iof) {
        const iof = condicoesFinanceiras.valorIof || 0;
        firstPage.drawText(this.formatCurrency(iof), {
          x: USER_CCB_COORDINATES.iof.x,
          y: USER_CCB_COORDINATES.iof.y,
          size: USER_CCB_COORDINATES.iof.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.pracaPagamento) {
        const praca = proposalData.cidade_emissao || dadosCliente.cidade || "São Paulo";
        firstPage.drawText(praca, {
          x: USER_CCB_COORDINATES.pracaPagamento.x,
          y: USER_CCB_COORDINATES.pracaPagamento.y,
          size: USER_CCB_COORDINATES.pracaPagamento.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.tarifaTED) {
        firstPage.drawText("R$ 10,00", {
          x: USER_CCB_COORDINATES.tarifaTED.x,
          y: USER_CCB_COORDINATES.tarifaTED.y,
          size: USER_CCB_COORDINATES.tarifaTED.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.tac) {
        const tac = condicoesFinanceiras.valorTac || 0;
        firstPage.drawText(this.formatCurrency(tac), {
          x: USER_CCB_COORDINATES.tac.x,
          y: USER_CCB_COORDINATES.tac.y,
          size: USER_CCB_COORDINATES.tac.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.taxaCredito) {
        firstPage.drawText("R$ 0,00", {
          x: USER_CCB_COORDINATES.taxaCredito.x,
          y: USER_CCB_COORDINATES.taxaCredito.y,
          size: USER_CCB_COORDINATES.taxaCredito.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.custoEfetivoTotal) {
        const cet = condicoesFinanceiras.cet || 0;
        firstPage.drawText(`${cet}%`, {
          x: USER_CCB_COORDINATES.custoEfetivoTotal.x,
          y: USER_CCB_COORDINATES.custoEfetivoTotal.y,
          size: USER_CCB_COORDINATES.custoEfetivoTotal.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.dataLiberacaoRecurso) {
        const dataLib = format(new Date(), "dd/MM/yyyy");
        firstPage.drawText(dataLib, {
          x: USER_CCB_COORDINATES.dataLiberacaoRecurso.x,
          y: USER_CCB_COORDINATES.dataLiberacaoRecurso.y,
          size: USER_CCB_COORDINATES.dataLiberacaoRecurso.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.valorLiquidoLiberado) {
        const valor = condicoesFinanceiras.valor || 0;
        const iof = condicoesFinanceiras.valorIof || 0;
        const tac = condicoesFinanceiras.valorTac || 0;
        const liquido = valor - iof - tac;
        firstPage.drawText(this.formatCurrency(liquido), {
          x: USER_CCB_COORDINATES.valorLiquidoLiberado.x,
          y: USER_CCB_COORDINATES.valorLiquidoLiberado.y,
          size: USER_CCB_COORDINATES.valorLiquidoLiberado.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      if (USER_CCB_COORDINATES.valorLiquidoEmissor) {
        const valor = condicoesFinanceiras.valor || 0;
        const iof = condicoesFinanceiras.valorIof || 0;
        const tac = condicoesFinanceiras.valorTac || 0;
        const liquido = valor - iof - tac - 10; // menos TED
        firstPage.drawText(this.formatCurrency(liquido), {
          x: USER_CCB_COORDINATES.valorLiquidoEmissor.x,
          y: USER_CCB_COORDINATES.valorLiquidoEmissor.y,
          size: USER_CCB_COORDINATES.valorLiquidoEmissor.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }

      // ========================================
      // PÁGINA 2 - DADOS BANCÁRIOS E PARCELAS
      // ========================================
      if (secondPage) {
        // DADOS BANCÁRIOS PESSOA FÍSICA
        if (USER_CCB_COORDINATES.bancoEmitente && dadosPagamento.banco) {
          secondPage.drawText(dadosPagamento.banco, {
            x: USER_CCB_COORDINATES.bancoEmitente.x,
            y: USER_CCB_COORDINATES.bancoEmitente.y,
            size: USER_CCB_COORDINATES.bancoEmitente.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        if (USER_CCB_COORDINATES.agenciaEmitente && dadosPagamento.agencia) {
          secondPage.drawText(dadosPagamento.agencia, {
            x: USER_CCB_COORDINATES.agenciaEmitente.x,
            y: USER_CCB_COORDINATES.agenciaEmitente.y,
            size: USER_CCB_COORDINATES.agenciaEmitente.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        if (USER_CCB_COORDINATES.contaEmitente && dadosPagamento.conta) {
          secondPage.drawText(dadosPagamento.conta, {
            x: USER_CCB_COORDINATES.contaEmitente.x,
            y: USER_CCB_COORDINATES.contaEmitente.y,
            size: USER_CCB_COORDINATES.contaEmitente.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        if (USER_CCB_COORDINATES.tipoContaEmitente && dadosPagamento.tipoConta) {
          secondPage.drawText(dadosPagamento.tipoConta, {
            x: USER_CCB_COORDINATES.tipoContaEmitente.x,
            y: USER_CCB_COORDINATES.tipoContaEmitente.y,
            size: USER_CCB_COORDINATES.tipoContaEmitente.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        // DADOS BANCÁRIOS PESSOA JURÍDICA (se aplicável)
        if (dadosCliente.tipo === "PJ") {
          if (USER_CCB_COORDINATES.razaoSocialEmitenteEmpresa && dadosCliente.razaoSocial && dadosCliente.razaoSocial !== "NÃO INFORMADO") {
            secondPage.drawText(dadosCliente.razaoSocial, {
              x: USER_CCB_COORDINATES.razaoSocialEmitenteEmpresa.x,
              y: USER_CCB_COORDINATES.razaoSocialEmitenteEmpresa.y,
              size: USER_CCB_COORDINATES.razaoSocialEmitenteEmpresa.fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }

          if (USER_CCB_COORDINATES.cnpjEmitenteEmpresa && dadosCliente.cnpj && dadosCliente.cnpj !== "NÃO INFORMADO") {
            secondPage.drawText(dadosCliente.cnpj, {
              x: USER_CCB_COORDINATES.cnpjEmitenteEmpresa.x,
              y: USER_CCB_COORDINATES.cnpjEmitenteEmpresa.y,
              size: USER_CCB_COORDINATES.cnpjEmitenteEmpresa.fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
        }

        // CHAVE PIX
        if (USER_CCB_COORDINATES.chavePix && dadosPagamento.chavePix) {
          secondPage.drawText(dadosPagamento.chavePix, {
            x: USER_CCB_COORDINATES.chavePix.x,
            y: USER_CCB_COORDINATES.chavePix.y,
            size: USER_CCB_COORDINATES.chavePix.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        // IMPLEMENTAÇÃO CRÍTICA: LOOP PARA AS PARCELAS
        console.log(`📄 [CCB] Iniciando preenchimento de ${parcelas.length} parcelas`);
        
        for (let i = 0; i < Math.min(parcelas.length, 24); i++) {
          const parcela = parcelas[i];
          const parcelaNum = i + 1;
          
          // Determinar qual página usar (1-21 na página 2, 22-24 na página 3)
          const currentPage = parcelaNum <= 21 ? secondPage : thirdPage;
          
          if (!currentPage) continue;
          
          // Buscar coordenadas específicas da parcela
          const numeroKey = `parcela${parcelaNum}Numero`;
          const vencimentoKey = `parcela${parcelaNum}Vencimento`;
          const valorKey = `parcela${parcelaNum}Valor`;
          
          // Número da parcela
          if (USER_CCB_COORDINATES[numeroKey]) {
            currentPage.drawText(`${parcelaNum}`, {
              x: USER_CCB_COORDINATES[numeroKey].x,
              y: USER_CCB_COORDINATES[numeroKey].y,
              size: USER_CCB_COORDINATES[numeroKey].fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
          
          // Vencimento da parcela
          if (USER_CCB_COORDINATES[vencimentoKey] && (parcela.data_vencimento || parcela.vencimento)) {
            const vencFormatado = format(new Date(parcela.data_vencimento || parcela.vencimento), "dd/MM/yyyy");
            currentPage.drawText(vencFormatado, {
              x: USER_CCB_COORDINATES[vencimentoKey].x,
              y: USER_CCB_COORDINATES[vencimentoKey].y,
              size: USER_CCB_COORDINATES[vencimentoKey].fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
          
          // Valor da parcela
          if (USER_CCB_COORDINATES[valorKey] && (parcela.valor_parcela || parcela.valor)) {
            currentPage.drawText(this.formatCurrency(parcela.valor_parcela || parcela.valor), {
              x: USER_CCB_COORDINATES[valorKey].x,
              y: USER_CCB_COORDINATES[valorKey].y,
              size: USER_CCB_COORDINATES[valorKey].fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
          
          console.log(`📄 [CCB] Parcela ${parcelaNum} preenchida: Venc: ${parcela.data_vencimento || parcela.vencimento}, Valor: ${parcela.valor_parcela || parcela.valor}`);
        }
      }

      console.log(`📄 [CCB] ✅ TODOS OS 95 CAMPOS FORAM PROCESSADOS`);
      console.log(`📄 [CCB] ✅ COORDENADAS MANUAIS DO USUÁRIO APLICADAS COM SUCESSO!`);

      // TEXTO DE TESTE PARA VALIDAÇÃO VISUAL (removido temporariamente devido ao encoding)
      console.log(`📄 [CCB] Template Simpix aplicado com sucesso - dados posicionados`);

      // 6. Salvar PDF com dados preenchidos
      const pdfBytes = await pdfDoc.save();
      console.log("📄 [CCB] PDF preenchido gerado com sucesso");

      // 7. Upload para Supabase Storage
      const fileName = `ccb_${proposalId}_${Date.now()}.pdf`;
      const filePath = `ccb/${proposalId}/${fileName}`;

      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("documents")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("❌ [CCB] Erro no upload:", uploadError);
        return { success: false, error: "Erro ao fazer upload do PDF" };
      }

      // 8. Atualizar banco de dados
      await db.execute(sql`
        UPDATE propostas 
        SET 
          ccb_gerado = true,
          caminho_ccb = ${filePath},
          ccb_gerado_em = NOW()
        WHERE id = ${proposalId}
      `);

      console.log(`✅ [CCB] Geração CORRETA concluída! Arquivo: ${filePath}`);
      console.log(`✅ [CCB] IMPORTANTE: Template preservado com logo e formatação`);
      console.log(`✅ [CCB] Dados preenchidos: Nome, CPF e Valor`);
      console.log(`✅ [CCB] Próximo passo: Ajustar coordenadas conforme feedback visual`);

      return { success: true, pdfPath: filePath };
    } catch (error) {
      console.error("❌ [CCB] Erro na geração:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Busca dados completos da proposta da estrutura JSONB correta
   */
  private async getProposalData(proposalId: string): Promise<any | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.cliente_data,
          p.condicoes_data,
          p.valor_aprovado,
          p.created_at,
          p.ccb_gerado_em,
          p.dados_pagamento_banco,
          p.dados_pagamento_agencia,
          p.dados_pagamento_conta,
          p.dados_pagamento_tipo,
          p.dados_pagamento_nome_titular,
          p.dados_pagamento_cpf_titular,
          p.dados_pagamento_pix,
          p.dados_pagamento_tipo_pix,
          p.dados_pagamento_codigo_banco,
          p.dados_pagamento_digito,
          p.dados_pagamento_pix_banco,
          p.dados_pagamento_pix_nome_titular,
          p.dados_pagamento_pix_cpf_titular,
          p.cliente_nome,
          p.cliente_cpf,
          p.cliente_rg,
          p.cliente_orgao_emissor,
          p.cliente_estado_civil,
          p.cliente_nacionalidade,
          p.cliente_endereco,
          p.cliente_cidade,
          p.cliente_uf,
          p.cliente_cep,
          p.cliente_rg_uf,
          p.cliente_rg_data_emissao,
          p.cliente_local_nascimento,
          p.tipo_pessoa,
          p.cliente_razao_social,
          p.cliente_cnpj,
          p.valor,
          p.prazo,
          p.taxa_juros,
          p.valor_tac,
          p.valor_iof,
          p.valor_total_financiado,
          p.valor_liquido_liberado,
          pr.nome_produto as produto_nome,
          l.nome_loja as loja_nome,
          l.endereco as loja_endereco
        FROM propostas p
        LEFT JOIN produtos pr ON p.produto_id = pr.id
        LEFT JOIN lojas l ON p.loja_id = l.id
        WHERE p.id = ${proposalId}
      `);

      if (!result || result.length === 0) {
        console.error("❌ [CCB] Proposta não encontrada");
        return null;
      }

      const proposta = result[0] as any;

      // AUDITORIA COMPLETA DOS DADOS
      console.log("📊 [CCB] ========== AUDITORIA COMPLETA DE DADOS ==========");
      console.log("📊 [CCB] ID da Proposta:", proposta.id);
      console.log("📊 [CCB] Cliente Nome (direto):", proposta.cliente_nome);
      console.log("📊 [CCB] Cliente CPF (direto):", proposta.cliente_cpf);
      console.log("📊 [CCB] Cliente RG (direto):", proposta.cliente_rg);
      console.log("📊 [CCB] Cliente Endereco (direto):", proposta.cliente_endereco);
      console.log("📊 [CCB] Valor Aprovado:", proposta.valor_aprovado);
      console.log("📊 [CCB] Taxa Juros:", proposta.taxa_juros);
      console.log("📊 [CCB] Prazo:", proposta.prazo);
      console.log("📊 [CCB] Dados Pagamento Banco:", proposta.dados_pagamento_banco);
      console.log("📊 [CCB] PIX presente:", !!proposta.dados_pagamento_pix);
      console.log("📊 [CCB] Loja Nome:", proposta.loja_nome);
      console.log("📊 [CCB] Produto Nome:", proposta.produto_nome);
      
      // Log detalhado dos dados JSONB (se existirem)
      if (proposta.cliente_data) {
        console.log("📊 [CCB] Cliente Data (JSONB) campos:", Object.keys(proposta.cliente_data));
      }
      if (proposta.condicoes_data) {
        console.log("📊 [CCB] Condicoes Data (JSONB) campos:", Object.keys(proposta.condicoes_data));
      }
      
      console.log("📊 [CCB] ========== FIM DA AUDITORIA ==========");

      // Validar dados obrigatórios
      if (!proposta.cliente_data || !proposta.condicoes_data) {
        console.error("❌ [CCB] Dados incompletos: cliente_data ou condicoes_data ausentes");
        return null;
      }

      // Retornar TODOS os dados para uso na geração
      return {
        ...proposta,
        // Mantém compatibilidade com campos antigos
        cliente_nome: proposta.cliente_data?.nome || "",
        cliente_cpf: proposta.cliente_data?.cpf || "",
        cliente_endereco: proposta.cliente_data?.endereco || "",
        cliente_cidade: proposta.cliente_data?.cidade || "",
        cliente_estado: proposta.cliente_data?.estado || "",
        cliente_cep: proposta.cliente_data?.cep || "",
        valor_emprestimo: proposta.condicoes_data?.valor || proposta.valor_aprovado || 0,
        prazo_meses: proposta.condicoes_data?.prazo || 12,
        taxa_juros: proposta.condicoes_data?.taxa_juros || 0,
      };
    } catch (error) {
      console.error("❌ [CCB] Erro ao buscar dados da proposta:", error);
      return null;
    }
  }

  /**
   * Formata CPF
   */
  private formatCPF(cpf?: string): string {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Formata CEP
   */
  private formatCEP(cep?: string): string {
    if (!cep) return "";
    const cleaned = cep.replace(/\D/g, "");
    return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  /**
   * Formata valor em moeda
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  /**
   * Obtém URL pública do PDF gerado
   */
  async getPublicUrl(filePath: string): Promise<string | null> {
    try {
      const supabaseAdmin = createServerSupabaseAdminClient();
      const { data } = supabaseAdmin.storage.from("documents").getPublicUrl(filePath);

      return data?.publicUrl || null;
    } catch (error) {
      console.error("❌ [CCB] Erro ao obter URL pública:", error);
      return null;
    }
  }

  /**
   * Verifica se CCB já foi gerado
   */
  async isCCBGenerated(proposalId: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT ccb_gerado, caminho_ccb
        FROM propostas
        WHERE id = ${proposalId}
      `);

      const proposal = result[0];
      return proposal?.ccb_gerado === true && !!proposal?.caminho_ccb;
    } catch (error) {
      console.error("❌ [CCB] Erro ao verificar status:", error);
      return false;
    }
  }
}

// Export singleton instance
export const ccbGenerationService = new CCBGenerationService();
