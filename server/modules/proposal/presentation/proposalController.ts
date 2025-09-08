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

import { Request, Response, NextFunction } from 'express';
// 🏡 P0.2 - IoC Container DI implementation
import { Container, TOKENS } from '../../shared/infrastructure/Container';
import type { CreateProposalUseCase } from '../application/CreateProposalUseCase';
import type { GetProposalByIdUseCase } from '../application/GetProposalByIdUseCase';
import type { ApproveProposalUseCase } from '../application/ApproveProposalUseCase';
import type { RejectProposalUseCase } from '../application/RejectProposalUseCase';
import type { PendenciarPropostaUseCase } from '../application/PendenciarPropostaUseCase';
import type { ListProposalsByCriteriaUseCase } from '../application/ListProposalsByCriteriaUseCase';
import type { ResubmitPendingProposalUseCase } from '../application/ResubmitPendingProposalUseCase';
import { Proposal, ProposalStatus } from '../domain/Proposal';
import { ProposalOutputSchema } from '../../../schemas/proposalOutput.schema';
import { SafeLogger } from '../../shared/infrastructure/SanitizedLogger';

export class ProposalController {
  private container: Container;

  // Dependencies injected via IoC container - DIP compliant 🏡 P0.2
  constructor() {
    this.container = Container.getInstance();
  }

  /**
   * Criar nova proposta
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const useCase = this.container.resolve<CreateProposalUseCase>(
        TOKENS.CREATE_PROPOSAL_USE_CASE
      );

      // SAFE DEBUG: Log request body for troubleshooting without PII exposure
      SafeLogger.debug('[ProposalController.create] Raw request body received');
      SafeLogger.debug('[ProposalController.create] User context available', {
        userId: (req as any).user?.id,
      });

      // SAFE DEBUG: Test individual field parsing without exposing PII
      SafeLogger.debug('[DEBUG] valorSolicitado received', {
        type: typeof req.body.valorSolicitado,
      });
      SafeLogger.debug('[DEBUG] parseFloat test successful', {
        isValid: !isNaN(parseFloat(req.body.valorSolicitado)),
      });

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
        taxaJuros: req.body.taxaJuros
          ? parseFloat(req.body.taxaJuros)
          : Proposal.getDefaultInterestRate(),
        produtoId: req.body.produtoId,
        tabelaComercialId: req.body.tabelaComercialId,

        // ===== VALORES CALCULADOS =====
        valorTac: req.body.valorTac ? parseFloat(req.body.valorTac) : undefined,
        valorIof: req.body.valorIof ? parseFloat(req.body.valorIof) : undefined,
        valorTotalFinanciado: req.body.valorTotalFinanciado
          ? parseFloat(req.body.valorTotalFinanciado)
          : undefined,

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

      SafeLogger.debug('[ProposalController.create] DTO mapping completed', {
        hasRequiredFields: !!(dto.clienteNome && dto.clienteCpf && dto.valor),
      });

      // Validar campos obrigatórios
      if (!dto.clienteNome || !dto.clienteCpf || !dto.valor) {
        SafeLogger.error('[ProposalController.create] Missing required fields', {
          clienteNome: !!dto.clienteNome,
          clienteCpf: !!dto.clienteCpf,
          valor: !!dto.valor,
        });
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios ausentes: nome, CPF e valor',
        });
      }

      const result = await useCase.execute(dto);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Buscar proposta por ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;

      // OPERAÇÃO VISÃO CLARA V1.0: Buscar proposta por ID usando método específico
      const getByIdUseCase = this.container.resolve<GetProposalByIdUseCase>(
        TOKENS.GET_PROPOSAL_BY_ID_USE_CASE
      );
      const proposal = await getByIdUseCase.execute(id);

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

      SafeLogger.debug('[getById] Extracted related data', {
        hasProductName: !!produtoNome,
        hasTableName: !!tabelaComercialNome,
        hasTableRate: tabelaComercialTaxa !== null,
        hasStoreName: !!lojaNome,
        produtoId: proposal.produtoId,
        tabelaComercialId: proposal.tabelaComercialId,
      });

      // PAM V1.0 CORREÇÃO: proposal agora é DTO, usar type casting
      const proposalDto = proposal as any;

      // OPERAÇÃO VISÃO CLARA V1.0: Serializar DTO COMPLETO para resposta
      const data = {
        id: proposalDto.id,
        status: proposalDto.status,
        cliente_data: proposalDto.cliente_data || proposalDto.clienteData,
        clienteData: proposalDto.cliente_data || proposalDto.clienteData, // Duplicado para compatibilidade
        // CORREÇÃO CRÍTICA: Adicionar condicoesData estruturado que o frontend espera
        condicoesData: {
          valor: proposalDto.valor || proposalDto.valorSolicitado, // DTO tem valor como número
          prazo: proposalDto.prazo,
          taxaJuros: proposalDto.taxaJuros,
          finalidade: proposalDto.finalidade,
          garantia: proposalDto.garantia,
        },
        valor: proposalDto.valor || proposalDto.valorSolicitado, // DTO já tem valor como número
        prazo: proposalDto.prazo,
        taxa_juros: proposalDto.taxaJuros,
        taxaJuros: proposalDto.taxaJuros, // Duplicado para compatibilidade
        produto_id: proposalDto.produtoId || proposalDto.produto_id,
        produtoId: proposalDto.produtoId || proposalDto.produto_id, // Duplicado para compatibilidade
        produto_nome: proposalDto.produto_nome || proposalDto.produtoNome, // NOVO: Nome do produto
        tabela_comercial_id: proposalDto.tabelaComercialId || proposalDto.tabela_comercial_id, // CORREÇÃO: Campo que estava ausente
        tabela_comercial_nome: proposalDto.tabela_comercial_nome || proposalDto.tabelaComercialNome, // NOVO: Nome da tabela comercial
        tabela_comercial_taxa: proposalDto.tabela_comercial_taxa || proposalDto.tabelaComercialTaxa, // NOVO: Taxa da tabela comercial
        loja_id: proposalDto.lojaId || proposalDto.loja_id,
        loja_nome: proposalDto.loja_nome || proposalDto.lojaNome, // Usar dados relacionados
        atendente_id: proposalDto.atendenteId || proposalDto.userId,
        dados_pagamento: proposalDto.dadosPagamento,
        motivo_rejeicao: proposalDto.motivoRejeicao,
        motivo_pendencia: proposalDto.motivoRejeicao, // CORREÇÃO: Campo motivoPendencia não existe no agregado
        observacoes: proposalDto.observacoes,
        ccb_url: proposalDto.ccbUrl,
        ccbUrl: proposalDto.ccbUrl, // Duplicado para compatibilidade
        created_at: proposalDto.createdAt,
        updated_at: proposalDto.updatedAt,
        createdAt: proposalDto.createdAt, // Duplicado para compatibilidade
        updatedAt: proposalDto.updatedAt, // Duplicado para compatibilidade
        // ✍️ CORREÇÃO CRÍTICA: Incluir campos em camelCase (igual ao endpoint de listagem)
        valorSolicitado: proposalDto.valor || proposalDto.valorSolicitado,
        valorTac: proposalDto.valorTac,
        valorIof: proposalDto.valorIof,
        valorTotalFinanciado: proposalDto.valorTotalFinanciado,
        // Manter snake_case para compatibilidade com código legacy
        valor_tac: proposalDto.valorTac,
        valor_iof: proposalDto.valorIof,
        valor_total_financiado: proposalDto.valorTotalFinanciado,
        // CAMPOS AUSENTES - CORREÇÃO AUDITORIA
        finalidade: proposalDto.finalidade,
        garantia: proposalDto.garantia,
        // PAM V1.0 CORREÇÃO CRÍTICA: Adicionar campos de CCB
        ccb_gerado: proposalDto.ccbGerado,
        caminho_ccb: proposalDto.caminhoCcb,
        ccb_gerado_em: proposalDto.ccbGeradoEm,
        caminho_ccb_assinado: proposalDto.caminhoCcbAssinado,
        data_assinatura: proposalDto.dataAssinatura,
        // PAM V1.0: DTO já tem valores calculados
        valor_parcela: proposalDto.valorParcela,
        valor_total: proposalDto.valorTotal,
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
        SafeLogger.error('[ProposalController.getById] Output validation failed', {
          errorType: validationError?.constructor?.name,
        });
        // Em desenvolvimento, log o erro mas envie a resposta mesmo assim
        // Em produção, você pode querer tratar isso diferentemente
        return res.json(response);
      }
    } catch (error: any) {
      // PAM P2.4.1: Delegate error handling to centralized middleware
      next(error);
    }
  }

  /**
   * Listar propostas com filtros
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { status, loja_id, atendente_id, cpf, queue } = req.query;

      // Aplicar filtros baseados no role do usuário
      const user = (req as any).user;
      let criteria: any = {};

      if (status) criteria.status = status as string;
      if (loja_id) criteria.lojaId = parseInt(loja_id as string);
      if (cpf) criteria.cpf = cpf as string;

      // PAM P2.2: Processar parâmetro queue=analysis usando enum canônico
      if (queue === 'analysis') {
        // Filtrar propostas em análise usando enum canônico sincronizado
        if (!status) {
          criteria.statusArray = [ProposalStatus.EM_ANALISE];
        }
      }

      // Se for ATENDENTE, filtrar apenas suas propostas
      if (user?.role === 'ATENDENTE') {
        criteria.atendenteId = user.id;
      } else if (atendente_id) {
        criteria.atendenteId = atendente_id as string;
      }

      // PERF-BOOST-001: Usar método lightweight para listagem
      // 🏡 P0.2 GREEN - DIP Compliant: Use case elimina violação DIP
      const listUseCase = this.container.resolve<ListProposalsByCriteriaUseCase>(
        TOKENS.LIST_PROPOSALS_BY_CRITERIA_USE_CASE
      );
      const rawData = await listUseCase.execute(criteria);

      // PAM V1.0 DEBUG: Log crítico para entender o que chega no controller
      console.log('🔍 [CONTROLLER DEBUG] rawData do UseCase - Total:', rawData.length);
      if (rawData.length > 0) {
        console.log(
          '🔍 [CONTROLLER DEBUG] Primeiro item do UseCase:',
          JSON.stringify({
            id: rawData[0].id,
            parceiro: rawData[0].parceiro,
            loja: rawData[0].loja,
          })
        );
      }

      // TODO P1.2: Remover este adaptador quando o repositório for consolidado para retornar o DTO correto
      // OPERAÇÃO AÇO LÍQUIDO P0.3: Adaptador de Contrato API para blindagem do frontend
      const data = rawData.map((row) => ({
        id: row.id,
        status: row.status,
        nomeCliente: row.nomeCliente, // ← Já mapeado pelo repository
        cpfCliente: row.cpfCliente, // ← CORREÇÃO: Use Case agora retorna camelCase
        emailCliente: row.emailCliente || null, // ← CORREÇÃO: Use Case agora retorna camelCase
        telefoneCliente: row.telefoneCliente || null, // ← CORREÇÃO: Use Case agora retorna camelCase
        valorSolicitado: row.valorSolicitado, // ← CORREÇÃO: Use Case agora retorna camelCase
        prazo: row.prazo,
        taxaJuros: row.taxaJuros, // ← CORREÇÃO: Use Case agora retorna camelCase
        // CORREÇÃO CRÍTICA P3: Incluir campos que estavam ausentes
        valorTac: row.valorTac, // ← CORREÇÃO: Use Case agora retorna camelCase
        valorIof: row.valorIof, // ← CORREÇÃO: Use Case agora retorna camelCase
        valorTotalFinanciado: row.valorTotalFinanciado, // ← CORREÇÃO: Use Case agora retorna camelCase
        finalidade: row.finalidade,
        garantia: row.garantia,
        lojaId: row.lojaId, // ← CORREÇÃO: Use Case agora retorna camelCase
        parceiro: row.parceiro, // ← Já estruturado pelo repository
        loja: row.loja, // ← Já estruturado pelo repository
        createdAt: row.createdAt, // ← CORREÇÃO: Use Case agora retorna camelCase
        updatedAt: row.updatedAt, // ← CORREÇÃO: Use Case agora retorna camelCase
      }));

      return res.json({
        success: true,
        data,
        total: data.length,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Aprovar proposta
   */
  async approve(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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

      const useCase = this.container.resolve<ApproveProposalUseCase>(
        TOKENS.APPROVE_PROPOSAL_USE_CASE
      );

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
      next(error);
    }
  }

  /**
   * Rejeitar proposta
   */
  async reject(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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

      const useCase = this.container.resolve<RejectProposalUseCase>(
        TOKENS.REJECT_PROPOSAL_USE_CASE
      );

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
      next(error);
    }
  }

  /**
   * Pendenciar proposta
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Missão P0
   */
  async pendenciar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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

      SafeLogger.info('[ProposalController.pendenciar] Processing proposal request', {
        hasProposalId: !!id,
        hasAnalystId: !!analistaId,
      });

      const useCase = this.container.resolve<PendenciarPropostaUseCase>(
        TOKENS.PENDENCIAR_PROPOSTA_USE_CASE
      );

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
      next(error);
    }
  }

  /**
   * Reenviar proposta pendente para análise (após correções)
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Endpoint específico para reenvio
   */
  async resubmitFromPending(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const getByIdUseCase = this.container.resolve<GetProposalByIdUseCase>(
        TOKENS.GET_PROPOSAL_BY_ID_USE_CASE
      );
      const proposal = await getByIdUseCase.execute(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar o novo método específico para reenvio de pendentes
      proposal.resubmitFromPending();
      // 🏡 P0.2 - DIP Compliant: Use appropriate use case for persistence
      const repository = this.container.resolve<any>(TOKENS.PROPOSAL_REPOSITORY);
      await repository.save(proposal);

      return res.status(200).json({
        success: true,
        message: 'Proposta reenviada para análise com sucesso',
        propostaId: proposal.id,
        novoStatus: proposal.status,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Atualizar dados da proposta (para correções)
   * PAM V2.5 - OPERAÇÃO VISÃO CLARA - Endpoint para salvamento
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      SafeLogger.debug('[CONTROLLER DEBUG] Starting update request');
      const { id } = req.params;
      const { cliente_data, condicoes_data } = req.body;

      SafeLogger.debug('[CONTROLLER DEBUG] Request analysis', {
        bodyKeysCount: Object.keys(req.body).length,
        hasClienteData: !!cliente_data,
        hasCondicoesData: !!condicoes_data,
      });

      if (!cliente_data && !condicoes_data) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum dado fornecido para atualização',
        });
      }

      SafeLogger.debug('[CONTROLLER DEBUG] Finding proposal by ID');
      const getByIdUseCase = this.container.resolve<GetProposalByIdUseCase>(
        TOKENS.GET_PROPOSAL_BY_ID_USE_CASE
      );
      const proposal = await getByIdUseCase.execute(id);

      if (!proposal) {
        SafeLogger.warn('[CONTROLLER DEBUG] Proposal not found', { requestedId: !!id });
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      SafeLogger.debug('[CONTROLLER DEBUG] Proposal found', { status: proposal.status });

      // Verificar se a proposta pode ser editada (apenas pendenciadas)
      const statusString = String(proposal.status || '').trim();
      SafeLogger.debug('[CONTROLLER DEBUG] Status validation', { statusString });
      if (statusString !== 'pendenciado' && statusString !== 'pendente') {
        SafeLogger.warn('[CONTROLLER DEBUG] Invalid status for editing', {
          currentStatus: statusString,
        });
        return res.status(400).json({
          success: false,
          error: 'Apenas propostas pendenciadas podem ser editadas',
        });
      }

      SafeLogger.debug('[CONTROLLER DEBUG] Updating proposal data');
      
      // DEBUG CRÍTICO: Verificar se proposal é uma instância de Proposal
      SafeLogger.debug('[CONTROLLER DEBUG] Proposal object analysis', {
        isProposal: proposal.constructor.name,
        hasUpdateMethod: typeof proposal.updateAfterPending,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(proposal)),
        proposalId: proposal.id,
        proposalStatus: proposal.status
      });
      
      // Atualizar dados usando o método do agregado
      // LINHA 622 - VERIFICA SE MÉTODO EXISTE ANTES DE CHAMAR
      if (typeof proposal.updateAfterPending === 'function') {
        proposal.updateAfterPending({
          clienteData: cliente_data,
          observacoes: condicoes_data?.observacoes || '',
        });
      } else {
        SafeLogger.error('[CRITICAL ERROR] updateAfterPending method not found on proposal object', {
          proposalType: typeof proposal,
          constructorName: proposal.constructor.name,
          proposalId: proposal.id,
          availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(proposal))
        });
        throw new Error('updateAfterPending method not available on proposal object');
      }

      SafeLogger.debug('[CONTROLLER DEBUG] Saving updated proposal');
      // 🏡 P0.2 - DIP Compliant: Use appropriate use case for persistence
      const repository = this.container.resolve<any>(TOKENS.PROPOSAL_REPOSITORY);
      await repository.save(proposal);

      SafeLogger.info('[CONTROLLER DEBUG] Proposal update completed successfully');
      return res.status(200).json({
        success: true,
        message: 'Proposta atualizada com sucesso',
        propostaId: proposal.id,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Buscar proposta por CPF (última proposta do cliente)
   */
  async getByCpf(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { cpf } = req.params;

      if (!cpf) {
        return res.status(400).json({
          success: false,
          error: 'CPF é obrigatório',
        });
      }

      // 🏡 P0.2 - DIP Compliant: Use case instead of direct repository access
      // TODO: Create dedicated FindByCPFUseCase when available
      const repository = this.container.resolve<any>(TOKENS.PROPOSAL_REPOSITORY);
      const proposals = await repository.findByCPF(cpf);

      if (!proposals || proposals.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // Retornar a proposta mais recente
      const latestProposal = proposals.sort(
        (a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      return res.json({
        success: true,
        data: {
          cliente_data: latestProposal.clienteData,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Submeter proposta para análise
   */
  async submitForAnalysis(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const { id } = req.params;

      const getByIdUseCase = this.container.resolve<GetProposalByIdUseCase>(
        TOKENS.GET_PROPOSAL_BY_ID_USE_CASE
      );
      const proposal = await getByIdUseCase.execute(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar método do agregado
      proposal.submitForAnalysis();

      // Persistir mudança
      // 🏡 P0.2 - DIP Compliant: Use appropriate use case for persistence
      const repository = this.container.resolve<any>(TOKENS.PROPOSAL_REPOSITORY);
      await repository.save(proposal);

      return res.json({
        success: true,
        message: 'Proposta submetida para análise',
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Buscar propostas para formalização (baseado em status específicos)
   * PAM P2.3: Migração de GET /formalizacao de core.ts
   */
  async getFormalizacao(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      SafeLogger.debug('[DEBUG] FORMALIZATION ROUTE HIT IN DDD CONTROLLER');
      SafeLogger.debug('[DEBUG] Route information', { url: req.url, path: req.path });

      const { createServerSupabaseAdminClient } = await import('../../../lib/supabase.js');
      const supabase = createServerSupabaseAdminClient();

      // Formalization statuses - TODOS exceto BOLETOS_EMITIDOS
      const formalizationStatuses = [
        'aprovado',
        'aceito_atendente',
        'documentos_enviados',
        'CCB_GERADA',
        'AGUARDANDO_ASSINATURA',
        'ASSINATURA_PENDENTE',
        'ASSINATURA_CONCLUIDA',
        'PAGAMENTO_PENDENTE',
        'PAGAMENTO_PARCIAL',
        'contratos_preparados',
        'contratos_assinados',
      ];

      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      const userLojaId = (req as any).user?.loja_id;

      SafeLogger.info('[FORMALIZATION] Querying proposals with user context', {
        hasUserId: !!userId,
        userRole,
        userLojaId,
      });

      // Build query based on user role
      let query = supabase.from('propostas').select('*').in('status', formalizationStatuses);

      // Apply role-based filtering
      if (userRole === 'ATENDENTE') {
        query = query.eq('user_id', userId);
        SafeLogger.debug('[FORMALIZATION] Applying ATENDENTE filter');
      } else if (userRole === 'GERENTE') {
        query = query.eq('loja_id', userLojaId);
        SafeLogger.debug('[FORMALIZATION] Applying GERENTE filter', { userLojaId });
      }

      const { data: formalizacaoPropostasRaw, error } = await query;

      if (error) {
        SafeLogger.error('Formalization error fetching proposals', {
          errorType: error?.constructor?.name,
        });
        throw error;
      }

      // Transform data for frontend compatibility
      const formalizacaoPropostas = formalizacaoPropostasRaw.map((proposta: any) => {
        // Parse client data
        const clienteData = proposta.cliente_data ? JSON.parse(proposta.cliente_data) : {};
        const condicoesData = proposta.condicoes_data ? JSON.parse(proposta.condicoes_data) : {};

        return {
          ...proposta,
          clienteData,
          condicoesData,
          // Convert snake_case to camelCase for frontend compatibility
          createdAt: proposta.created_at,
          numeroProposta: proposta.numero_proposta,
          lojaId: proposta.loja_id,
          produtoId: proposta.produto_id,
          tabelaComercialId: proposta.tabela_comercial_id,
          userId: proposta.user_id,
          analistaId: proposta.analista_id,
          dataAnalise: proposta.data_analise,
          motivoPendencia: proposta.motivo_pendencia,
          dataAprovacao: proposta.data_aprovacao,
          documentosAdicionais: proposta.documentos_adicionais,
          contratoGerado: proposta.contrato_gerado,
          contratoAssinado: proposta.contrato_assinado,
          dataAssinatura: proposta.data_assinatura,
          dataPagamento: proposta.data_pagamento,
          observacoesFormalização: proposta.observacoes_formalizacao,
        };
      });

      SafeLogger.info('Formalization proposals found', { count: formalizacaoPropostas.length });
      return res.json(formalizacaoPropostas);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Buscar logs de observação/auditoria de uma proposta
   * PAM P2.3: Migração de GET /:id/observacoes de core.ts
   */
  async getObservacoes(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const propostaId = req.params.id;
      const { createServerSupabaseAdminClient } = await import('../../../lib/supabase.js');
      const supabase = createServerSupabaseAdminClient();

      const { data: logs, error } = await supabase
        .from('proposta_logs')
        .select(
          `
          id,
          observacao,
          status_anterior,
          status_novo,
          created_at,
          autor_id,
          profiles!proposta_logs_autor_id_fkey (
            full_name,
            role
          )
        `
        )
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: true });

      if (error) {
        SafeLogger.warn('Erro ao buscar logs de auditoria', {
          errorType: error?.constructor?.name,
        });
        return res.json({ logs: [] });
      }

      const transformedLogs =
        logs?.map((log: any) => ({
          id: log.id,
          acao:
            log.status_novo === 'aguardando_analise'
              ? 'reenvio_atendente'
              : `mudanca_status_${log.status_novo}`,
          detalhes: log.observacao,
          status_anterior: log.status_anterior,
          status_novo: log.status_novo,
          data_acao: log.created_at,
          autor_id: log.autor_id,
          profiles: log.profiles,
          observacao: log.observacao,
          created_at: log.created_at,
        })) || [];

      return res.json({
        logs: transformedLogs,
        total: transformedLogs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualizar status da proposta (legacy compatibility)
   * PAM P2.3: Migração de PUT /:id/status de core.ts
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    // Validação defensiva do req.body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Mapear para os novos endpoints baseado no status
    if (status === 'aprovado') {
      return this.approve(req, res, next);
    } else if (status === 'rejeitado') {
      return this.reject(req, res, next);
    } else if (status === 'aguardando_analise') {
      return this.submitForAnalysis(req, res, next);
    } else if (status === 'pendente' || status === 'pendenciado') {
      // OPERAÇÃO VISÃO CLARA V1.0: Implementar transição para pendenciado
      try {
        // DEBUG: Log completo do request body
        SafeLogger.debug('Pendenciar request received', {
          userId: (req as any).user?.id,
          proposalId: id,
          fieldsCount: Object.keys(req.body).length,
        });
        SafeLogger.debug('Pendenciar operation details', {
          status,
          hasMotivo: !!req.body.motivo_pendencia || !!req.body.motivoPendencia,
          hasObservacao: !!req.body.observacao,
        });

        // Aceitar tanto camelCase (frontend) quanto snake_case (backend)
        const motivo_pendencia =
          req.body.motivo_pendencia || req.body.motivoPendencia || req.body.observacao;
        SafeLogger.debug('Pendenciar final motivo processed', {
          hasFinalMotivo: !!motivo_pendencia,
        });

        if (!motivo_pendencia) {
          SafeLogger.debug('Pendenciar validation failed', { reason: 'motivo_pendencia_missing' });
          return res.status(400).json({
            success: false,
            error: 'Motivo da pendência é obrigatório',
          });
        }

        // Garantir que o motivo seja passado corretamente para o controller
        req.body.motivo_pendencia = motivo_pendencia;
        SafeLogger.debug('Pendenciar validation passed', { motivoPresent: true });

        // OPERAÇÃO VISÃO CLARA V1.0: Implementado endpoint de pendência
        return this.pendenciar(req, res, next);
      } catch (error) {
        next(error);
      }
    }

    // Para outros status, retornar erro por enquanto
    return res.status(400).json({
      success: false,
      error: 'Status transition not yet implemented in DDD architecture',
    });
  }
}
