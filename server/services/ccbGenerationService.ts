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
import {
  SIMPIX_CCB_MAPPING,
  TEST_COORDINATES,
  yFromTop,
  formatTextWithLineBreaks,
} from "./ccbFieldMapping";
import { CoordinateAdjustment, applyCoordinateAdjustments } from "./ccbCoordinateMapper";
// USANDO NOVAS COORDENADAS DO USUÁRIO
import { USER_CCB_COORDINATES, getCoordinateForSystemField } from "./ccbUserCoordinates";

interface PropostaData {
  id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_endereco?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  cliente_cep?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  valor_emprestimo: number;
  prazo_meses: number;
  taxa_juros: number;
  valor_total: number;
  valor_parcela: number;
  data_primeiro_vencimento?: Date;
  numero_contrato?: string;
  created_at: Date;
  loja_nome?: string;
  produto_nome?: string;
}

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

      // 4. Obter a primeira página do template
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      console.log(`📄 [CCB] Dimensões da página: ${width}x${height}`);

      // 5. DESENHAR TEXTO SOBRE O TEMPLATE usando NOVAS COORDENADAS DO USUÁRIO

      // MUDANÇA CRÍTICA: Usando coordenadas manuais do usuário ao invés das antigas
      console.log(
        `📄 [CCB] ✅ USANDO NOVAS COORDENADAS MANUAIS DO USUÁRIO (ccbUserCoordinates.ts)`
      );
      console.log(
        `📄 [CCB] Coordenadas antigas DESATIVADAS. Total de campos mapeados: ${Object.keys(USER_CCB_COORDINATES).length}`
      );

      // ========================================
      // USANDO COORDENADAS MANUAIS DO USUÁRIO
      // ========================================

      // IDENTIFICAÇÃO DA CCB (Topo da página)
      const numeroCedulaCoord = USER_CCB_COORDINATES.numeroCedula;
      if (numeroCedulaCoord) {
        const numeroCCB = `CCB-${proposalData.id}`;
        firstPage.drawText(numeroCCB, {
          x: numeroCedulaCoord.x,
          y: numeroCedulaCoord.y, // Usando Y direto (735)
          size: numeroCedulaCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Número CCB: "${numeroCCB}" em x:${numeroCedulaCoord.x}, y:${numeroCedulaCoord.y}`
        );
      }

      // DATA DE EMISSÃO
      const dataEmissaoCoord = USER_CCB_COORDINATES.dataEmissao;
      if (dataEmissaoCoord) {
        const dataAtual = format(new Date(), "dd/MM/yyyy");
        firstPage.drawText(dataAtual, {
          x: dataEmissaoCoord.x,
          y: dataEmissaoCoord.y, // Y:735
          size: dataEmissaoCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Data Emissão: "${dataAtual}" em x:${dataEmissaoCoord.x}, y:${dataEmissaoCoord.y}`
        );
      }

      // FINALIDADE DA OPERAÇÃO
      const finalidadeCoord = USER_CCB_COORDINATES.finalidadeOperacao;
      if (finalidadeCoord && proposalData.loja_nome) {
        firstPage.drawText("Empréstimo pessoal", {
          x: finalidadeCoord.x,
          y: finalidadeCoord.y, // Y:735
          size: finalidadeCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Finalidade: "Empréstimo pessoal" em x:${finalidadeCoord.x}, y:${finalidadeCoord.y}`
        );
      }

      // NOME DO CLIENTE (Sua coordenada: X:55, Y:645)
      const nomeCoord = USER_CCB_COORDINATES.nomeCliente;
      if (nomeCoord && proposalData.cliente_nome) {
        firstPage.drawText(proposalData.cliente_nome, {
          x: nomeCoord.x,
          y: nomeCoord.y, // Y:645
          size: nomeCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Nome: "${proposalData.cliente_nome}" em x:${nomeCoord.x}, y:${nomeCoord.y}`
        );
      }

      // CPF DO CLIENTE (Sua coordenada: X:405, Y:645)
      const cpfCoord = USER_CCB_COORDINATES.cpfCliente;
      if (cpfCoord && proposalData.cliente_cpf) {
        firstPage.drawText(this.formatCPF(proposalData.cliente_cpf), {
          x: cpfCoord.x,
          y: cpfCoord.y, // Y:645
          size: cpfCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] CPF: "${this.formatCPF(proposalData.cliente_cpf)}" em x:${cpfCoord.x}, y:${cpfCoord.y}`
        );
      }

      // ENDEREÇO DO CLIENTE (Sua coordenada: X:100, Y:670)
      const enderecoCoord = USER_CCB_COORDINATES.enderecoCliente;
      if (enderecoCoord && proposalData.cliente_endereco) {
        firstPage.drawText(proposalData.cliente_endereco, {
          x: enderecoCoord.x,
          y: enderecoCoord.y, // Y:670
          size: enderecoCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Endereço: "${proposalData.cliente_endereco}" em x:${enderecoCoord.x}, y:${enderecoCoord.y}`
        );
      }

      // CEP DO CLIENTE (Sua coordenada: X:270, Y:670)
      const cepCoord = USER_CCB_COORDINATES.cepCliente;
      if (cepCoord && proposalData.cliente_cep) {
        firstPage.drawText(this.formatCEP(proposalData.cliente_cep), {
          x: cepCoord.x,
          y: cepCoord.y, // Y:670
          size: cepCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] CEP: "${this.formatCEP(proposalData.cliente_cep)}" em x:${cepCoord.x}, y:${cepCoord.y}`
        );
      }

      // CIDADE DO CLIENTE (Sua coordenada: X:380, Y:670)
      const cidadeCoord = USER_CCB_COORDINATES.cidadeCliente;
      if (cidadeCoord && proposalData.cliente_cidade) {
        firstPage.drawText(proposalData.cliente_cidade, {
          x: cidadeCoord.x,
          y: cidadeCoord.y, // Y:670
          size: cidadeCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Cidade: "${proposalData.cliente_cidade}" em x:${cidadeCoord.x}, y:${cidadeCoord.y}`
        );
      }

      // UF DO CLIENTE (Sua coordenada: X:533, Y:670)
      const ufCoord = USER_CCB_COORDINATES.ufCliente;
      if (ufCoord && proposalData.cliente_estado) {
        firstPage.drawText(proposalData.cliente_estado, {
          x: ufCoord.x,
          y: ufCoord.y, // Y:670
          size: ufCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] UF: "${proposalData.cliente_estado}" em x:${ufCoord.x}, y:${ufCoord.y}`
        );
      }

      // DADOS DO CREDOR
      const razaoCredorCoord = USER_CCB_COORDINATES.razaoSocialCredor;
      if (razaoCredorCoord) {
        firstPage.drawText("SIMPIX LTDA", {
          x: razaoCredorCoord.x,
          y: razaoCredorCoord.y, // Y:465
          size: razaoCredorCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Razão Social Credor: "SIMPIX LTDA" em x:${razaoCredorCoord.x}, y:${razaoCredorCoord.y}`
        );
      }

      const cnpjCredorCoord = USER_CCB_COORDINATES.cnpjCredor;
      if (cnpjCredorCoord) {
        firstPage.drawText("12.345.678/0001-90", {
          x: cnpjCredorCoord.x,
          y: cnpjCredorCoord.y, // Y:465
          size: cnpjCredorCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] CNPJ Credor: "12.345.678/0001-90" em x:${cnpjCredorCoord.x}, y:${cnpjCredorCoord.y}`
        );
      }

      // VALOR PRINCIPAL (Sua coordenada: X:50, Y:350)
      const valorCoord = USER_CCB_COORDINATES.valorPrincipal;
      if (valorCoord && proposalData.valor_emprestimo) {
        firstPage.drawText(this.formatCurrency(proposalData.valor_emprestimo), {
          x: valorCoord.x,
          y: valorCoord.y, // Y:350
          size: valorCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Valor Principal: "${this.formatCurrency(proposalData.valor_emprestimo)}" em x:${valorCoord.x}, y:${valorCoord.y}`
        );
      }

      // PRAZO DE AMORTIZAÇÃO (Sua coordenada: X:50, Y:300)
      const prazoCoord = USER_CCB_COORDINATES.prazoAmortizacao;
      if (prazoCoord && proposalData.prazo_meses) {
        firstPage.drawText(`${proposalData.prazo_meses} meses`, {
          x: prazoCoord.x,
          y: prazoCoord.y, // Y:300
          size: prazoCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Prazo: "${proposalData.prazo_meses} meses" em x:${prazoCoord.x}, y:${prazoCoord.y}`
        );
      }

      // TAXA DE JUROS MENSAL (Sua coordenada: X:95, Y:245)
      const taxaCoord = USER_CCB_COORDINATES.taxaJurosEfetivaMensal;
      if (taxaCoord && proposalData.taxa_juros) {
        firstPage.drawText(`${proposalData.taxa_juros}%`, {
          x: taxaCoord.x,
          y: taxaCoord.y, // Y:245
          size: taxaCoord.fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `📄 [CCB] Taxa Mensal: "${proposalData.taxa_juros}%" em x:${taxaCoord.x}, y:${taxaCoord.y}`
        );
      }

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
  private async getProposalData(proposalId: string): Promise<PropostaData | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.cliente_data,
          p.condicoes_data,
          p.valor_aprovado,
          p.created_at,
          pr.nome_produto as produto_nome,
          l.nome_loja as loja_nome
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

      // Validar dados obrigatórios
      if (!proposta.cliente_data || !proposta.condicoes_data) {
        console.error("❌ [CCB] Dados incompletos: cliente_data ou condicoes_data ausentes");
        return null;
      }

      // Extrair dados das estruturas JSONB
      const clienteData = proposta.cliente_data as any;
      const condicoesData = proposta.condicoes_data as any;

      // Calcular valores derivados
      const valorBase = condicoesData.valor || proposta.valor_aprovado || 0;
      const prazo = condicoesData.prazo || 12;
      const taxaJuros = condicoesData.taxa_juros || 0;
      const valorTotal = condicoesData.valorTotalFinanciado || valorBase * (1 + taxaJuros / 100);
      const valorParcela = valorTotal / prazo;

      // Retornar estrutura padronizada
      return {
        id: proposta.id,
        cliente_nome: clienteData.nome || "",
        cliente_cpf: clienteData.cpf || "",
        cliente_endereco: clienteData.endereco || "",
        cliente_cidade: clienteData.cidade || "",
        cliente_estado: clienteData.estado || "",
        cliente_cep: clienteData.cep || "",
        cliente_email: clienteData.email || "",
        cliente_telefone: clienteData.telefone || "",
        valor_emprestimo: valorBase,
        prazo_meses: prazo,
        taxa_juros: taxaJuros,
        valor_total: valorTotal,
        valor_parcela: valorParcela,
        created_at: proposta.created_at || new Date(),
        loja_nome: proposta.loja_nome,
        produto_nome: proposta.produto_nome,
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
