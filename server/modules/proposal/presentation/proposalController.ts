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

      // Mapear body da requisição para DTO do caso de uso
      const dto = {
        clienteNome: req.body.nomeCompleto || req.body.clienteNome,
        clienteCpf: req.body.cpf || req.body.clienteCpf,
        clienteRg: req.body.clienteRg,
        clienteEmail: req.body.email || req.body.clienteEmail,
        clienteTelefone: req.body.telefone || req.body.clienteTelefone,
        clienteEndereco: req.body.clienteEndereco,
        clienteCidade: req.body.clienteCidade,
        clienteEstado: req.body.clienteEstado || req.body.clienteUf,
        clienteCep: req.body.clienteCep,
        clienteDataNascimento: req.body.clienteDataNascimento,
        clienteRendaMensal: req.body.clienteRenda ? parseFloat(req.body.clienteRenda) : undefined,
        clienteEmpregador: req.body.clienteEmpregador || req.body.clienteEmpresaNome,
        clienteTempoEmprego: req.body.clienteTempoEmprego,
        clienteDividasExistentes: req.body.clienteDividasExistentes
          ? parseFloat(req.body.clienteDividasExistentes)
          : undefined,
        valor: parseFloat(req.body.valorSolicitado || req.body.valor),
        prazo: parseInt(req.body.prazo),
        taxaJuros: parseFloat(req.body.taxaJuros || '2.5'),
        produtoId: req.body.produto_id || req.body.produtoId || 1,
        lojaId: (req as any).user?.lojaId || 1,
        atendenteId: req.body.atendenteId || (req as any).user?.id,
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
      const useCase = new GetProposalByIdUseCase(this.repository);

      const proposal = await useCase.execute(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Serializar agregado para resposta
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
      const { status, loja_id, atendente_id, cpf } = req.query;

      // Aplicar filtros baseados no role do usuário
      const user = (req as any).user;
      let criteria: any = {};

      if (status) criteria.status = status as string;
      if (loja_id) criteria.lojaId = parseInt(loja_id as string);
      if (cpf) criteria.cpf = cpf as string;

      // Se for ATENDENTE, filtrar apenas suas propostas
      if (user?.role === 'ATENDENTE') {
        criteria.atendenteId = user.id;
      } else if (atendente_id) {
        criteria.atendenteId = atendente_id as string;
      }

      const proposals = await this.repository.findByCriteria(criteria);

      // Serializar lista de agregados
      const data = proposals.map((proposal) => ({
        id: proposal.id,
        status: proposal.status,
        cliente_nome: proposal.clienteData.nome,
        cliente_cpf: proposal.clienteData.cpf,
        valor: proposal.valor,
        prazo: proposal.prazo,
        taxa_juros: proposal.taxaJuros,
        produto_id: proposal.produtoId,
        loja_id: proposal.lojaId,
        atendente_id: proposal.atendenteId,
        created_at: proposal.createdAt,
        updated_at: proposal.updatedAt,
        valor_parcela: proposal.calculateMonthlyPayment(),
      }));

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
