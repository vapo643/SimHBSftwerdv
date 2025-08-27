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

      // Mapear body da requisição para DTO do caso de uso
      const dto = {
        clienteNome: req.body.clienteNome,
        clienteCpf: req.body.clienteCpf,
        clienteRg: req.body.clienteRg,
        clienteEmail: req.body.clienteEmail || null,
        clienteTelefone: req.body.clienteTelefone || null,
        clienteDataNascimento: req.body.clienteDataNascimento || null,
        clienteEnderecoLogradouro: req.body.clienteEnderecoLogradouro || null,
        clienteEnderecoNumero: req.body.clienteEnderecoNumero || null,
        clienteEnderecoComplemento: req.body.clienteEnderecoComplemento || null,
        clienteEnderecoBairro: req.body.clienteEnderecoBairro || null,
        clienteEnderecoCidade: req.body.clienteEnderecoCidade || null,
        clienteEnderecoUf: req.body.clienteEnderecoUf || null,
        clienteEnderecoCep: req.body.clienteEnderecoCep || null,
        produtoId: req.body.produtoId,
        valorSolicitado: req.body.valorSolicitado,
        numeroParcelas: req.body.numeroParcelas,
        tabelaComercialId: req.body.tabelaComercialId,
        observacoes: req.body.observacoes || null,
        // Contexto do atendente (extraído do JWT)
        atendenteId: (req as any).user?.id,
        lojaId: (req as any).user?.loja_id,
      };

      const result = await useCase.execute(dto);

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Proposta criada com sucesso',
      });
    } catch (error) {
      console.error('[ProposalController.create] Error creating proposal:', error);

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Buscar proposta por ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const useCase = new GetProposalByIdUseCase(this.repository);
      const proposalId = parseInt(req.params.id, 10);

      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          error: 'ID da proposta deve ser um número',
        });
      }

      const result = await useCase.execute({ id: proposalId });

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[ProposalController.getById] Error:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Aprovar proposta
   */
  async approve(req: Request, res: Response): Promise<Response> {
    try {
      const useCase = new ApproveProposalUseCase(this.repository);
      const proposalId = parseInt(req.params.id, 10);

      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          error: 'ID da proposta deve ser um número',
        });
      }

      const dto = {
        id: proposalId,
        userId: (req as any).user?.id,
        observacoes: req.body.observacoes || null,
      };

      const result = await useCase.execute(dto);

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Proposta aprovada com sucesso',
      });
    } catch (error) {
      console.error('[ProposalController.approve] Error:', error);

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Rejeitar proposta
   */
  async reject(req: Request, res: Response): Promise<Response> {
    try {
      const useCase = new RejectProposalUseCase(this.repository);
      const proposalId = parseInt(req.params.id, 10);

      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          error: 'ID da proposta deve ser um número',
        });
      }

      const dto = {
        id: proposalId,
        userId: (req as any).user?.id,
        motivo: req.body.motivo || 'Não especificado',
        observacoes: req.body.observacoes || null,
      };

      const result = await useCase.execute(dto);

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Proposta rejeitada com sucesso',
      });
    } catch (error) {
      console.error('[ProposalController.reject] Error:', error);

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Listar propostas com filtros
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      // Implementar filtros e paginação conforme necessário
      const filters = {
        status: req.query.status as string,
        lojaId: req.query.lojaId ? parseInt(req.query.lojaId as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      // Por enquanto, retornar lista vazia
      // Implementar caso de uso ListProposalsUseCase quando necessário
      
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: 0,
        },
      });
    } catch (error) {
      console.error('[ProposalController.list] Error:', error);

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
      });
    }
  }
}

// Export singleton instance
export const proposalController = new ProposalController();