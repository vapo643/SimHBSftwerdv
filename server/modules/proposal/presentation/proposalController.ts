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
import { ProposalOutputSchema } from '../../../schemas/proposalOutput.schema';

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

      // CRITICAL FIX: Extrair nomes relacionados anexados pelo mapToDomainWithJoinedData
      const produtoNome = (proposal as any)._relatedProductName || null;
      const tabelaComercialNome = (proposal as any)._relatedCommercialTableName || null;
      const tabelaComercialTaxa = (proposal as any)._relatedCommercialTableRate ?? null;
      const lojaNome = (proposal as any)._relatedStoreName || null;
      
      console.log('🔍 [getById] Extracted related data:', {
        produtoNome,
        tabelaComercialNome,
        tabelaComercialTaxa,
        lojaNome,
        produtoId: proposal.produtoId,
        tabelaComercialId: proposal.tabelaComercialId
      });

      // OPERAÇÃO VISÃO CLARA V1.0: Serializar agregado COMPLETO para resposta
      const data = {
        id: proposal.id,
        status: proposal.status,
        cliente_data: proposal.clienteData,
        clienteData: proposal.clienteData, // Duplicado para compatibilidade
        // CORREÇÃO CRÍTICA: Adicionar condicoesData estruturado que o frontend espera
        condicoesData: {
          valor: proposal.valor.getReais(),
          prazo: proposal.prazo,
          taxaJuros: proposal.taxaJuros,
          finalidade: proposal.finalidade,
          garantia: proposal.garantia,
        },
        valor: proposal.valor.getReais(), // CORREÇÃO CRÍTICA: Converter Money Value Object para número
        prazo: proposal.prazo,
        taxa_juros: proposal.taxaJuros,
        taxaJuros: proposal.taxaJuros, // Duplicado para compatibilidade
        produto_id: proposal.produtoId,
        produtoId: proposal.produtoId, // Duplicado para compatibilidade
        produto_nome: produtoNome, // NOVO: Nome do produto
        tabela_comercial_id: proposal.tabelaComercialId, // CORREÇÃO: Campo que estava ausente
        tabela_comercial_nome: tabelaComercialNome, // NOVO: Nome da tabela comercial
        tabela_comercial_taxa: tabelaComercialTaxa, // NOVO: Taxa da tabela comercial
        loja_id: proposal.lojaId,
        loja_nome: lojaNome, // Usar dados relacionados
        atendente_id: proposal.atendenteId,
        dados_pagamento: proposal.dadosPagamento,
        motivo_rejeicao: proposal.motivoRejeicao,
        motivo_pendencia: proposal.motivoRejeicao, // Alias para compatibilidade
        observacoes: proposal.observacoes,
        ccb_url: proposal.ccbUrl,
        ccbUrl: proposal.ccbUrl, // Duplicado para compatibilidade
        created_at: proposal.createdAt,
        updated_at: proposal.updatedAt,
        createdAt: proposal.createdAt, // Duplicado para compatibilidade
        updatedAt: proposal.updatedAt, // Duplicado para compatibilidade
        // CORREÇÃO: Incluir campos que estavam ausentes
        valor_tac: proposal.valorTac,
        valor_iof: proposal.valorIof,
        valor_total_financiado: proposal.valorTotalFinanciado,
        // CAMPOS AUSENTES - CORREÇÃO AUDITORIA
        finalidade: proposal.finalidade,
        garantia: proposal.garantia,
        // Cálculos do agregado - valores já retornados como números pelos métodos
        valor_parcela: proposal.calculateMonthlyPayment(),
        valor_total: proposal.calculateTotalAmount(),
      };

      const response = {
        success: true,
        data,
      };
      
      // Validar a resposta antes de enviar
      try {
        const validated = ProposalOutputSchema.parse(response);
        return res.json(validated);
      } catch (validationError) {
        console.error('[ProposalController.getById] Output validation failed:', validationError);
        // Em desenvolvimento, log o erro mas envie a resposta mesmo assim
        // Em produção, você pode querer tratar isso diferentemente
        return res.json(response);
      }
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

      // OPERAÇÃO AÇO LÍQUIDO P0.2: Processar parâmetro queue=analysis
      // FIX CRÍTICO: Remover estado inexistente 'aguardando_analise'
      if (queue === 'analysis') {
        // Filtrar apenas status de análise - usar apenas status existentes no banco
        if (!status) {
          criteria.statusArray = ['em_analise']; // TEMPORÁRIO: Apenas estado existente
          // TODO P2.2: Reintegrar 'aguardando_analise' após correção da FSM
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
      const { id } = req.params;
      const { motivo_pendencia, observacoes } = req.body;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      if (!motivo_pendencia) {
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
   * Reenviar proposta pendente para análise (após correções)
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Endpoint específico para reenvio
   */
  async resubmitFromPending(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const proposal = await this.repository.findById(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar o novo método específico para reenvio de pendentes
      proposal.resubmitFromPending();
      await this.repository.save(proposal);

      return res.json({
        success: true,
        message: 'Proposta reenviada para análise com sucesso',
        propostaId: proposal.id,
        novoStatus: proposal.status,
      });
    } catch (error: any) {
      console.error('[ProposalController.resubmitFromPending] Error:', error);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('Apenas propostas pendentes')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao reenviar proposta',
      });
    }
  }

  /**
   * Atualizar dados da proposta (para correções)
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Endpoint para salvamento
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      console.log('🔍 [CONTROLLER DEBUG] Starting update for proposal ID:', req.params.id);
      const { id } = req.params;
      const { cliente_data, condicoes_data } = req.body;
      
      console.log('🔍 [CONTROLLER DEBUG] Request body keys:', Object.keys(req.body));
      console.log('🔍 [CONTROLLER DEBUG] cliente_data provided:', !!cliente_data);
      console.log('🔍 [CONTROLLER DEBUG] condicoes_data provided:', !!condicoes_data);

      if (!cliente_data && !condicoes_data) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum dado fornecido para atualização',
        });
      }

      console.log('🔍 [CONTROLLER DEBUG] Finding proposal by ID...');
      const proposal = await this.repository.findById(id);

      if (!proposal) {
        console.log('🚨 [CONTROLLER DEBUG] Proposal not found for ID:', id);
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }
      
      console.log('🔍 [CONTROLLER DEBUG] Proposal found, status:', proposal.status);

      // Verificar se a proposta pode ser editada (apenas pendenciadas)
      const statusString = String(proposal.status || '').trim();
      console.log('🔍 [CONTROLLER DEBUG] Status string:', statusString);
      if (statusString !== 'pendenciado' && statusString !== 'pendente') {
        console.log('🚨 [CONTROLLER DEBUG] Invalid status for editing:', statusString);
        return res.status(400).json({
          success: false,
          error: 'Apenas propostas pendenciadas podem ser editadas',
        });
      }

      console.log('🔍 [CONTROLLER DEBUG] Calling updateAfterPending...');
      // Atualizar dados usando o método do agregado
      proposal.updateAfterPending({
        clienteData: cliente_data,
        observacoes: condicoes_data?.observacoes || '',
      });

      console.log('🔍 [CONTROLLER DEBUG] Calling repository.save...');
      await this.repository.save(proposal);

      console.log('✅ [CONTROLLER DEBUG] Save completed successfully');
      return res.json({
        success: true,
        message: 'Proposta atualizada com sucesso',
        propostaId: proposal.id,
      });
    } catch (error: any) {
      console.error('🚨 [CONTROLLER DEBUG] ERROR in update:', error);
      console.error('🚨 [CONTROLLER DEBUG] Error stack:', error.stack);

      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('Apenas propostas pendenciadas')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar proposta',
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
