/**
 * Proposal Controller
 *
 * Camada de apresentação responsável por:
 * 1. Receber requisições HTTP
 * 2. Chamar casos de uso apropriados
 * 3. Retornar respostas formatadas
 *
 * Não contém lógica de negócio - apenas orquestração
 */

import { Request, Response } from 'express';
import { ProposalRepository } from '../infrastructure/ProposalRepository';
import { CreateProposalUseCase } from '../application/CreateProposalUseCase';
import { GetProposalByIdUseCase } from '../application/GetProposalByIdUseCase';
import { ApproveProposalUseCase } from '../application/ApproveProposalUseCase';
import { RejectProposalUseCase } from '../application/RejectProposalUseCase';
import { PendenciarPropostaUseCase } from '../application/PendenciarPropostaUseCase';

export class ProposalController {
  private repository: ProposalRepository;

  constructor() {
    // Injeção de dependência simples - instanciação manual
    this.repository = new ProposalRepository();
  }

  /**
   * Criar nova proposta
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const useCase = new CreateProposalUseCase(this.repository);

      // DEBUG: Log request body for troubleshooting
      console.log(
        '[ProposalController.create] Raw request body:',
        JSON.stringify(req.body, null, 2)
      );
      console.log('[ProposalController.create] User context:', (req as any).user);

      // DEBUG: Test individual field parsing
      console.log('[DEBUG] valorSolicitado raw:', req.body.valorSolicitado, typeof req.body.valorSolicitado);
      console.log('[DEBUG] parseFloat test:', parseFloat(req.body.valorSolicitado));
      console.log('[DEBUG] CPF raw:', req.body.cpf, typeof req.body.cpf);
      console.log('[DEBUG] nomeCompleto raw:', req.body.nomeCompleto, typeof req.body.nomeCompleto);

      // LACRE DE OURO: Mapeamento COMPLETO de todos os campos enviados pelo frontend
      const dto = {
        // ===== DADOS BÁSICOS DO CLIENTE =====
        clienteNome: req.body.clienteNome,
        clienteCpf: req.body.clienteCpf,
        tipoPessoa: req.body.tipoPessoa,
        clienteRazaoSocial: req.body.clienteRazaoSocial,
        clienteCnpj: req.body.clienteCnpj,
        
        // ===== DOCUMENTAÇÃO COMPLETA (RG) =====
        clienteRg: req.body.clienteRg,
        clienteOrgaoEmissor: req.body.clienteOrgaoEmissor,
        clienteRgUf: req.body.clienteRgUf,
        clienteRgDataEmissao: req.body.clienteRgDataEmissao,
        
        // ===== DADOS PESSOAIS =====
        clienteEmail: req.body.clienteEmail,
        clienteTelefone: req.body.clienteTelefone,
        clienteDataNascimento: req.body.clienteDataNascimento,
        clienteLocalNascimento: req.body.clienteLocalNascimento,
        clienteEstadoCivil: req.body.clienteEstadoCivil,
        clienteNacionalidade: req.body.clienteNacionalidade,
        
        // ===== ENDEREÇO DETALHADO =====
        clienteCep: req.body.clienteCep,
        clienteLogradouro: req.body.clienteLogradouro,
        clienteNumero: req.body.clienteNumero,
        clienteComplemento: req.body.clienteComplemento,
        clienteBairro: req.body.clienteBairro,
        clienteCidade: req.body.clienteCidade,
        clienteUf: req.body.clienteUf,
        clienteEndereco: req.body.clienteEndereco, // Campo concatenado
        
        // ===== DADOS PROFISSIONAIS =====
        clienteOcupacao: req.body.clienteOcupacao,
        clienteRenda: req.body.clienteRenda ? parseFloat(req.body.clienteRenda) : undefined,
        clienteTelefoneEmpresa: req.body.clienteTelefoneEmpresa,
        
        // ===== DADOS DE PAGAMENTO =====
        metodoPagamento: req.body.metodoPagamento,
        dadosPagamentoBanco: req.body.dadosPagamentoBanco,
        dadosPagamentoAgencia: req.body.dadosPagamentoAgencia,
        dadosPagamentoConta: req.body.dadosPagamentoConta,
        dadosPagamentoDigito: req.body.dadosPagamentoDigito,
        dadosPagamentoPix: req.body.dadosPagamentoPix,
        dadosPagamentoTipoPix: req.body.dadosPagamentoTipoPix,
        dadosPagamentoPixBanco: req.body.dadosPagamentoPixBanco,
        dadosPagamentoPixNomeTitular: req.body.dadosPagamentoPixNomeTitular,
        dadosPagamentoPixCpfTitular: req.body.dadosPagamentoPixCpfTitular,
        
        // ===== DADOS DO EMPRÉSTIMO =====
        valor: parseFloat(req.body.valor),
        prazo: parseInt(req.body.prazo),
        taxaJuros: req.body.taxaJuros ? parseFloat(req.body.taxaJuros) : 2.5,
        produtoId: req.body.produtoId,
        tabelaComercialId: req.body.tabelaComercialId,
        
        // ===== VALORES CALCULADOS =====
        valorTac: req.body.valorTac ? parseFloat(req.body.valorTac) : undefined,
        valorIof: req.body.valorIof ? parseFloat(req.body.valorIof) : undefined,
        valorTotalFinanciado: req.body.valorTotalFinanciado ? parseFloat(req.body.valorTotalFinanciado) : undefined,
        
        // ===== CONDIÇÕES ESPECIAIS =====
        dataCarencia: req.body.dataCarencia,
        incluirTac: req.body.incluirTac,
        
        // ===== ADMINISTRATIVO =====
        lojaId: req.body.lojaId || (req as any).user?.lojaId || 1,
        atendenteId: req.body.atendenteId || (req as any).user?.id,
        finalidade: req.body.finalidade,
        garantia: req.body.garantia,
        formaLiberacao: req.body.formaLiberacao,
        formaPagamento: req.body.formaPagamento,
        pracaPagamento: req.body.pracaPagamento,
        
        // ===== REFERÊNCIAS PESSOAIS =====
        referenciaPessoal: req.body.referenciaPessoal,
        
        // ===== CONTROLE DE FLUXO =====
        submitForAnalysis: req.body.submitForAnalysis || false, // Padrão: false (criar como rascunho)
      };

      console.log('[ProposalController.create] Mapped DTO:', JSON.stringify(dto, null, 2));
      
      // Validar campos obrigatórios
      if (!dto.clienteNome || !dto.clienteCpf || !dto.valor) {
        console.error('[ProposalController.create] Missing required fields:', {
          clienteNome: !!dto.clienteNome,
          clienteCpf: !!dto.clienteCpf,
          valor: !!dto.valor
        });
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios ausentes: nome, CPF e valor'
        });
      }

      const result = await useCase.execute(dto);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[ProposalController.create] Error:', error);

      // Tratar erros de validação do domínio
      if (
        error.message.includes('CPF inválido') ||
        error.message.includes('Valor do empréstimo') ||
        error.message.includes('Prazo deve estar') ||
        error.message.includes('Taxa de juros')
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao criar proposta',
      });
    }
  }

  /**
   * Buscar proposta por ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      
      // OPERAÇÃO VISÃO CLARA V1.0: Buscar proposta por ID usando método específico
      const proposal = await this.repository.findById(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // OPERAÇÃO VISÃO CLARA V1.0: Serializar agregado COMPLETO para resposta
      const data = {
        id: proposal.id,
        status: proposal.status,
        cliente_data: proposal.clienteData,
        valor: proposal.valor,
        prazo: proposal.prazo,
        taxa_juros: proposal.taxaJuros,
        produto_id: proposal.produtoId,
        loja_id: proposal.lojaId,
        atendente_id: proposal.atendenteId,
        dados_pagamento: proposal.dadosPagamento,
        motivo_rejeicao: proposal.motivoRejeicao,
        observacoes: proposal.observacoes,
        ccb_url: proposal.ccbUrl,
        created_at: proposal.createdAt,
        updated_at: proposal.updatedAt,
        // CORREÇÃO: Incluir campos que estavam ausentes
        valor_tac: proposal.valorTac,
        valor_iof: proposal.valorIof,
        valor_total_financiado: proposal.valorTotalFinanciado,
        // OPERAÇÃO VISÃO CLARA V1.0: Incluir dados relacionados da loja
        loja_nome: (proposal as any)._relatedStoreName || null,
        // NOTA: finalidade e garantia não são propriedades do agregado Proposal
        // Eles estão no banco mas não foram modelados no domínio
        // Cálculos do agregado
        valor_parcela: proposal.calculateMonthlyPayment(),
        valor_total: proposal.calculateTotalAmount(),
      };

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('[ProposalController.getById] Error:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar proposta',
      });
    }
  }

  /**
   * Listar propostas com filtros
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const { status, loja_id, atendente_id, cpf, queue } = req.query;

      // Aplicar filtros baseados no role do usuário
      const user = (req as any).user;
      let criteria: any = {};

      if (status) criteria.status = status as string;
      if (loja_id) criteria.lojaId = parseInt(loja_id as string);
      if (cpf) criteria.cpf = cpf as string;

      // OPERAÇÃO VISÃO CLARA V1.0: Processar parâmetro queue=analysis
      if (queue === 'analysis') {
        // Filtrar apenas status de análise
        if (!status) {
          criteria.status = 'aguardando_analise';
        }
      }

      // Se for ATENDENTE, filtrar apenas suas propostas
      if (user?.role === 'ATENDENTE') {
        criteria.atendenteId = user.id;
      } else if (atendente_id) {
        criteria.atendenteId = atendente_id as string;
      }

      // PERF-BOOST-001: Usar método lightweight para listagem
      const data = await this.repository.findByCriteriaLightweight(criteria);

      return res.json({
        success: true,
        data,
        total: data.length,
      });
    } catch (error: any) {
      console.error('[ProposalController.list] Error:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro ao listar propostas',
      });
    }
  }

  /**
   * Aprovar proposta
   */
  async approve(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { observacoes } = req.body;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const useCase = new ApproveProposalUseCase(this.repository);

      await useCase.execute({
        proposalId: id,
        analistaId,
        observacoes,
      });

      return res.json({
        success: true,
        message: 'Proposta aprovada com sucesso',
      });
    } catch (error: any) {
      console.error('[ProposalController.approve] Error:', error);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (
        error.message.includes('Apenas propostas em análise') ||
        error.message.includes('Comprometimento de renda')
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao aprovar proposta',
      });
    }
  }

  /**
   * Rejeitar proposta
   */
  async reject(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      if (!motivo) {
        return res.status(400).json({
          success: false,
          error: 'Motivo da rejeição é obrigatório',
        });
      }

      const useCase = new RejectProposalUseCase(this.repository);

      await useCase.execute({
        proposalId: id,
        analistaId,
        motivo,
      });

      return res.json({
        success: true,
        message: 'Proposta rejeitada',
      });
    } catch (error: any) {
      console.error('[ProposalController.reject] Error:', error);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (
        error.message.includes('Apenas propostas em análise') ||
        error.message.includes('Motivo da rejeição')
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao rejeitar proposta',
      });
    }
  }

  /**
   * Pendenciar proposta
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Missão P0
   */
  async pendenciar(req: Request, res: Response): Promise<Response> {
    try {
      // 🚨 DEBUG LOGS - CONTROLLER PENDENCIAR
      console.log(`[🚨 CONTROLLER DEBUG] ===== CONTROLLER PENDENCIAR CHAMADO =====`);
      console.log(`[🚨 CONTROLLER DEBUG] URL:`, req.url);
      console.log(`[🚨 CONTROLLER DEBUG] Params:`, req.params);
      console.log(`[🚨 CONTROLLER DEBUG] Body completo:`, JSON.stringify(req.body, null, 2));
      
      const { id } = req.params;
      const { motivo_pendencia, observacoes } = req.body;
      const analistaId = (req as any).user?.id;

      console.log(`[🚨 CONTROLLER DEBUG] Campos extraídos:`);
      console.log(`[🚨 CONTROLLER DEBUG] - id:`, id);
      console.log(`[🚨 CONTROLLER DEBUG] - motivo_pendencia:`, motivo_pendencia);
      console.log(`[🚨 CONTROLLER DEBUG] - observacoes:`, observacoes);
      console.log(`[🚨 CONTROLLER DEBUG] - analistaId:`, analistaId);

      if (!analistaId) {
        console.log(`[🚨 CONTROLLER DEBUG] ❌ Usuário não autenticado!`);
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      if (!motivo_pendencia) {
        console.log(`[🚨 CONTROLLER DEBUG] ❌ Motivo da pendência não encontrado!`);
        console.log(`[🚨 CONTROLLER DEBUG] Body inteiro:`, JSON.stringify(req.body, null, 2));
        return res.status(400).json({
          success: false,
          error: 'Motivo da pendência é obrigatório',
        });
      }

      console.log(`[ProposalController.pendenciar] Pendenciando proposta ${id} por analista ${analistaId}`);

      const useCase = new PendenciarPropostaUseCase(this.repository);

      const result = await useCase.execute({
        propostaId: id,
        motivoPendencia: motivo_pendencia,
        analistaId,
        observacoes,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      return res.json({
        success: true,
        message: result.message,
        propostaId: result.propostaId,
        novoStatus: result.novoStatus,
      });
    } catch (error: any) {
      console.error('[ProposalController.pendenciar] Error:', error);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (
        error.message.includes('Apenas propostas') ||
        error.message.includes('Motivo da pendência')
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao pendenciar proposta',
      });
    }
  }

  /**
   * Buscar proposta por CPF (última proposta do cliente)
   */
  async getByCpf(req: Request, res: Response): Promise<Response> {
    try {
      const { cpf } = req.params;

      if (!cpf) {
        return res.status(400).json({
          success: false,
          error: 'CPF é obrigatório',
        });
      }

      const proposals = await this.repository.findByCPF(cpf);

      if (!proposals || proposals.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // Retornar a proposta mais recente
      const latestProposal = proposals.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      return res.json({
        success: true,
        data: {
          cliente_data: latestProposal.clienteData,
        },
      });
    } catch (error: any) {
      console.error('[ProposalController.getByCpf] Error:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados por CPF',
      });
    }
  }

  /**
   * Submeter proposta para análise
   */
  async submitForAnalysis(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const proposal = await this.repository.findById(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar método do agregado
      proposal.submitForAnalysis();

      // Persistir mudança
      await this.repository.save(proposal);

      return res.json({
        success: true,
        message: 'Proposta submetida para análise',
      });
    } catch (error: any) {
      console.error('[ProposalController.submitForAnalysis] Error:', error);

      if (error.message.includes('Apenas propostas em rascunho')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao submeter proposta',
      });
    }
  }
}
