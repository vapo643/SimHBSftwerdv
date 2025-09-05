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
import { 
  proposalRepository,
  createProposalUseCase,
  getProposalByIdUseCase,
  approveProposalUseCase,
  rejectProposalUseCase,
  pendenciarPropostaUseCase
} from '../../dependencies';
import { Proposal, ProposalStatus } from '../domain/Proposal';
import { ProposalOutputSchema } from '../../../schemas/proposalOutput.schema';

export class ProposalController {
  // Dependencies injected via IoC container - DIP compliant
  constructor() {
    // All dependencies managed centrally via dependencies.ts
  }

  /**
   * Criar nova proposta
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const useCase = createProposalUseCase();

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
        taxaJuros: req.body.taxaJuros ? parseFloat(req.body.taxaJuros) : Proposal.getDefaultInterestRate(),
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
      const proposal = await proposalRepository.findById(id);

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
      const rawData = await proposalRepository.findByCriteriaLightweight(criteria);

      // TODO P1.2: Remover este adaptador quando o repositório for consolidado para retornar o DTO correto
      // OPERAÇÃO AÇO LÍQUIDO P0.3: Adaptador de Contrato API para blindagem do frontend
      const data = rawData.map(row => ({
        id: row.id,
        status: row.status,
        nomeCliente: row.nomeCliente, // ← Já mapeado pelo repository
        cpfCliente: row.cliente_cpf,
        emailCliente: null, // ← Campo não retornado pelo repository (TODO P1.2)
        telefoneCliente: null, // ← Campo não retornado pelo repository (TODO P1.2)  
        valorSolicitado: row.valor,
        prazo: row.prazo,
        lojaId: row.loja_id,
        parceiro: row.parceiro, // ← Já estruturado pelo repository
        loja: row.loja, // ← Já estruturado pelo repository
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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

      const useCase = approveProposalUseCase();

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

      const useCase = rejectProposalUseCase();

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

      console.log(`[ProposalController.pendenciar] Pendenciando proposta ${id} por analista ${analistaId}`);

      const useCase = pendenciarPropostaUseCase();

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
  async resubmitFromPending(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { id } = req.params;
      const analistaId = (req as any).user?.id;

      if (!analistaId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const proposal = await proposalRepository.findById(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar o novo método específico para reenvio de pendentes
      proposal.resubmitFromPending();
      await proposalRepository.save(proposal);

      return res.json({
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
  async update(req: Request, res: Response, next: NextFunction): Promise<Response> {
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
      const proposal = await proposalRepository.findById(id);

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
      await proposalRepository.save(proposal);

      console.log('✅ [CONTROLLER DEBUG] Save completed successfully');
      return res.json({
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
  async getByCpf(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const { cpf } = req.params;

      if (!cpf) {
        return res.status(400).json({
          success: false,
          error: 'CPF é obrigatório',
        });
      }

      const proposals = await proposalRepository.findByCPF(cpf);

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
      next(error);
    }
  }

  /**
   * Submeter proposta para análise
   */
  async submitForAnalysis(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const { id } = req.params;

      const proposal = await proposalRepository.findById(id);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      // Usar método do agregado
      proposal.submitForAnalysis();

      // Persistir mudança
      await proposalRepository.save(proposal);

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
  async getFormalizacao(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      console.log('🔍 [DEBUG] FORMALIZATION ROUTE HIT IN DDD CONTROLLER!');
      console.log('🔍 [DEBUG] URL:', req.url);
      console.log('🔍 [DEBUG] Path:', req.path);
      
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

      console.log(`🔐 [FORMALIZATION] Querying for user ${userId} with role ${userRole} from loja ${userLojaId}`);

      // Build query based on user role
      let query = supabase.from('propostas').select('*').in('status', formalizationStatuses);

      // Apply role-based filtering
      if (userRole === 'ATENDENTE') {
        query = query.eq('user_id', userId);
        console.log(`🔐 [FORMALIZATION] ATENDENTE filter: user_id = ${userId}`);
      } else if (userRole === 'GERENTE') {
        query = query.eq('loja_id', userLojaId);
        console.log(`🔐 [FORMALIZATION] GERENTE filter: loja_id = ${userLojaId}`);
      }

      const { data: formalizacaoPropostasRaw, error } = await query;

      if (error) {
        console.error('❌ [FORMALIZATION] Error fetching proposals:', error);
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

      console.log(`✅ [FORMALIZATION] Found ${formalizacaoPropostas.length} propostas for formalization`);
      return res.json(formalizacaoPropostas);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Buscar logs de observação/auditoria de uma proposta
   * PAM P2.3: Migração de GET /:id/observacoes de core.ts
   */
  async getObservacoes(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const propostaId = req.params.id;
      const { createServerSupabaseAdminClient } = await import('../../../lib/supabase.js');
      const supabase = createServerSupabaseAdminClient();

      const { data: logs, error } = await supabase
        .from('proposta_logs')
        .select(`
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
        `)
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Erro ao buscar logs de auditoria:', error);
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
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<Response> {
    // Validação defensiva do req.body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body is required'
      });
    }
    
    const { status } = req.body;

    // Mapear para os novos endpoints baseado no status
    if (status === 'aprovado') {
      return this.approve(req, res);
    } else if (status === 'rejeitado') {
      return this.reject(req, res);
    } else if (status === 'aguardando_analise') {
      return this.submitForAnalysis(req, res);
    } else if (status === 'pendente' || status === 'pendenciado') {
      // OPERAÇÃO VISÃO CLARA V1.0: Implementar transição para pendenciado
      try {
        // DEBUG: Log completo do request body
        console.log(`[PENDENCIAR DEBUG] Full req.body:`, JSON.stringify(req.body, null, 2));
        console.log(`[PENDENCIAR DEBUG] Status:`, status);
        console.log(`[PENDENCIAR DEBUG] motivo_pendencia:`, req.body.motivo_pendencia);
        console.log(`[PENDENCIAR DEBUG] motivoPendencia:`, req.body.motivoPendencia);
        console.log(`[PENDENCIAR DEBUG] observacao:`, req.body.observacao);
        
        // Aceitar tanto camelCase (frontend) quanto snake_case (backend)
        const motivo_pendencia = req.body.motivo_pendencia || req.body.motivoPendencia || req.body.observacao;
        console.log(`[PENDENCIAR DEBUG] Final motivo_pendencia:`, motivo_pendencia);
        
        if (!motivo_pendencia) {
          console.log(`[PENDENCIAR DEBUG] ❌ Motivo da pendência não encontrado!`);
          return res.status(400).json({
            success: false,
            error: 'Motivo da pendência é obrigatório',
          });
        }
        
        // Garantir que o motivo seja passado corretamente para o controller
        req.body.motivo_pendencia = motivo_pendencia;
        console.log(`[PENDENCIAR DEBUG] ✅ Motivo definido, passando para controller`);
        
        // OPERAÇÃO VISÃO CLARA V1.0: Implementado endpoint de pendência
        return this.pendenciar(req, res);
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
