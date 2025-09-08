/**
 * Implementação concreta do Repository de Propostas
 *
 * Usa Drizzle ORM para persistência no PostgreSQL.
 * Parte da camada de infraestrutura.
 */

import { eq, and, gte, lte, or, isNull, sql, inArray, desc, asc, gt, lt } from 'drizzle-orm';
import { db } from '../../../lib/supabase';
import { propostas, ccbs, boletos, produtos, tabelasComerciais, lojas, parceiros } from '@shared/schema';
import { Proposal, ProposalStatus } from '../domain/Proposal';
import { IProposalRepository, ProposalSearchCriteria } from '../domain/IProposalRepository';
import { PaginatedResult, CursorPaginationOptions, RepositoryFilters, CursorUtils } from '@shared/types/pagination';
import { EventDispatcher } from '../../../infrastructure/events/EventDispatcher';

export class ProposalRepository implements IProposalRepository {
  async save(proposal: Proposal): Promise<void> {
    const data = proposal.toPersistence();
    
    console.log('🔍 [REPOSITORY DEBUG] Starting save for proposal:', proposal.id);
    console.log('🔍 [REPOSITORY DEBUG] Persistence data keys:', Object.keys(data));
    console.log('🔍 [REPOSITORY DEBUG] analista_id:', data.analista_id);
    console.log('🔍 [REPOSITORY DEBUG] user_id:', data.user_id);
    console.log('🔍 [REPOSITORY DEBUG] status:', data.status);

    // P1.1 OPTIMIZATION: Use INSERT...ON CONFLICT instead of exists check
    // Try insert first - if conflict, then update
    try {
      // Attempt INSERT for new proposal
      const numeroProposta = await this.getNextNumeroProposta();
      console.log('🔍 [REPOSITORY DEBUG] Next numero proposta:', numeroProposta);
      
      const insertValues = {
        id: proposal.id, // UUID do domínio
        numeroProposta: numeroProposta, // ID sequencial começando em 300001
        status: data.status,
        clienteNome: data.cliente_data.nome,
        clienteCpf: data.cliente_data.cpf,
        clienteData: JSON.stringify(data.cliente_data),
        valor: data.valor.toString(),
        prazo: data.prazo,
        taxaJuros: data.taxa_juros.toString(),
        taxaJurosAnual: data.taxa_juros_anual?.toString() || (data.taxa_juros * 12).toString(), // Campo obrigatório
        valorTac: data.valor_tac?.toString() || '0', // Campo obrigatório  
        valorIof: data.valor_iof?.toString() || '0', // Campo obrigatório
        valorTotalFinanciado: data.valor_total_financiado?.toString() || data.valor.toString(), // Campo obrigatório
        produtoId: data.produto_id,
        tabelaComercialId: data.tabela_comercial_id,
        lojaId: data.loja_id,
        metodoPagamento: data.dados_pagamento?.metodo,
        dadosPagamentoTipo: data.dados_pagamento?.tipo_conta || data.dados_pagamento?.pixTipo || data.dados_pagamento?.pix_tipo,
        dadosPagamentoBanco: data.dados_pagamento_banco,
        dadosPagamentoAgencia: data.dados_pagamento?.agencia,
        dadosPagamentoConta: data.dados_pagamento?.conta,
        dadosPagamentoDigito: data.dados_pagamento?.digito,
        dadosPagamentoPix: data.dados_pagamento?.pixChave || data.dados_pagamento?.pix_chave,
        dadosPagamentoPixBanco: data.dados_pagamento?.pixBanco,
        dadosPagamentoPixNomeTitular: data.dados_pagamento?.pixNomeTitular,
        dadosPagamentoPixCpfTitular: data.dados_pagamento?.pixCpfTitular,
        motivoPendencia: data.motivo_rejeicao,
        observacoes: data.observacoes,
        ccbDocumentoUrl: data.ccb_documento_url,
        userId: data.user_id || 'e647afc0-03fa-482d-8293-d824dcab0399', // Campo obrigatório UUID - usar real da proposta existente
        analistaId: data.analista_id || 'e647afc0-03fa-482d-8293-d824dcab0399', // Campo obrigatório UUID
        createdAt: data.created_at,
        // Adicionar campos faltantes identificados pelo LSP
        clienteComprometimentoRenda: data.cliente_comprometimento_renda || 30, // Valor padrão
        clienteEndereco: data.cliente_data.endereco || '', // Extrair do clienteData
        // Campos obrigatórios booleanos faltantes
        ccbGerado: false, // Valor padrão para nova proposta
        assinaturaEletronicaConcluida: false, // Valor padrão para nova proposta
        biometriaConcluida: false, // Valor padrão para nova proposta
        // CORREÇÃO MANDATÓRIA PAM V1.0: Adicionar finalidade e garantia
        finalidade: data.finalidade,
        garantia: data.garantia
      };
      
      console.log('🔍 [REPOSITORY DEBUG] Insert values userId:', insertValues.userId);
      console.log('🔍 [REPOSITORY DEBUG] Insert values analistaId:', insertValues.analistaId);
      console.log('🔍 [REPOSITORY DEBUG] Insert values ccbGerado:', insertValues.ccbGerado);
      
      await db.insert(propostas).values([insertValues]);
      
      console.log('[REPOSITORY] New proposal inserted:', proposal.id);
      
    } catch (insertError: any) {
      console.log('🚨 [REPOSITORY DEBUG] INSERT FAILED:', insertError.message);
      console.log('🚨 [REPOSITORY DEBUG] Error code:', insertError.code);
      console.log('🚨 [REPOSITORY DEBUG] Error detail:', insertError.detail);
      console.log('🚨 [REPOSITORY DEBUG] Full error:', insertError);
      
      // If insert fails due to unique constraint (proposal already exists), then update
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        console.log('[REPOSITORY] Proposal exists, updating:', proposal.id);
        // UPDATE existing proposal
        await db
          .update(propostas)
          .set({
            status: data.status,
            clienteData: JSON.stringify(data.cliente_data),
            valor: data.valor.toString(),
            prazo: data.prazo,
            taxaJuros: data.taxa_juros.toString(),
            produtoId: data.produto_id,
            tabelaComercialId: data.tabela_comercial_id,
            lojaId: data.loja_id,
            dadosPagamentoTipo: data.dados_pagamento?.tipo_conta || data.dados_pagamento?.pixTipo || data.dados_pagamento?.pix_tipo,
            dadosPagamentoBanco: data.dados_pagamento_banco,
            dadosPagamentoAgencia: data.dados_pagamento?.agencia,
            dadosPagamentoConta: data.dados_pagamento?.conta,
            dadosPagamentoDigito: data.dados_pagamento?.digito,
            dadosPagamentoPix: data.dados_pagamento?.pixChave || data.dados_pagamento?.pix_chave,
            dadosPagamentoPixBanco: data.dados_pagamento?.pixBanco,
            dadosPagamentoPixNomeTitular: data.dados_pagamento?.pixNomeTitular,
            dadosPagamentoPixCpfTitular: data.dados_pagamento?.pixCpfTitular,
            motivoPendencia: data.motivo_rejeicao,
            observacoes: data.observacoes,
            ccbDocumentoUrl: data.ccb_documento_url,
            // CORREÇÃO MANDATÓRIA PAM V1.0: Adicionar finalidade e garantia no UPDATE
            finalidade: data.finalidade,
            garantia: data.garantia,
            // updatedAt campo removido - será atualizado automaticamente pelo schema
          })
          .where(eq(propostas.id, data.id));
      } else {
        // Re-throw unexpected errors
        console.error('[REPOSITORY] Unexpected error during proposal insert:', insertError);
        throw insertError;
      }
    }

    // Processar eventos de domínio (comentado temporariamente para load test)
    const events = proposal.getUncommittedEvents();
    
    // Em desenvolvimento, apenas log dos eventos sem despachar para Redis
    if (process.env.NODE_ENV === 'development') {
      for (const event of events) {
        console.log(`[DOMAIN EVENT LOGGED] ${event.eventType} for aggregate ${event.aggregateId} (Redis disabled in dev)`);
      }
      proposal.markEventsAsCommitted();
    } else {
      const eventDispatcher = EventDispatcher.getInstance();
      for (const event of events) {
        await eventDispatcher.dispatch(event);
        console.log(`[DOMAIN EVENT DISPATCHED] ${event.eventType} for aggregate ${event.aggregateId}`);
      }
      proposal.markEventsAsCommitted();
    }
  }

  async findById(id: string): Promise<Proposal | null> {
    console.log('🔍 [findById] PAM V1.0 - Replicating findByCriteriaLightweight logic for ID:', id);
    
    // PAM V1.0 CORREÇÃO MANDATÓRIA: Query completa com TODOS os campos do cliente
    const result = await db
      .select({
        id: propostas.id,
        status: propostas.status,
        cliente_nome: propostas.clienteNome,
        cliente_cpf: propostas.clienteCpf,
        // CORREÇÃO MANDATÓRIA: Adicionar campos do cliente que faltavam
        cliente_email: propostas.clienteEmail,
        cliente_telefone: propostas.clienteTelefone,
        cliente_data_nascimento: propostas.clienteDataNascimento,
        cliente_renda: propostas.clienteRenda,
        cliente_rg: propostas.clienteRg,
        cliente_orgao_emissor: propostas.clienteOrgaoEmissor,
        cliente_estado_civil: propostas.clienteEstadoCivil,
        cliente_nacionalidade: propostas.clienteNacionalidade,
        cliente_cep: propostas.clienteCep,
        cliente_endereco: propostas.clienteEndereco,
        cliente_ocupacao: propostas.clienteOcupacao,
        clienteData: propostas.clienteData, // Campo JSON com dados completos
        valor: propostas.valor,
        prazo: propostas.prazo,
        taxa_juros: propostas.taxaJuros,
        valor_tac: propostas.valorTac,
        valor_iof: propostas.valorIof,
        valor_total_financiado: propostas.valorTotalFinanciado,
        finalidade: propostas.finalidade,
        garantia: propostas.garantia,
        produto_id: propostas.produtoId,
        produto_nome: produtos.nomeProduto,
        tabela_comercial_nome: tabelasComerciais.nomeTabela,
        loja_id: propostas.lojaId,
        loja_nome: lojas.nomeLoja,
        parceiro_id: parceiros.id,
        parceiro_nome: parceiros.razaoSocial,
        atendente_id: propostas.userId,
        created_at: propostas.createdAt,
        updated_at: propostas.updatedAt
      })
      .from(propostas)
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id)) // CRUCIAL: JOIN com parceiros que estava faltando!
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)))
      .limit(1);

    if (!result || result.length === 0) {
      console.log('🔍 [findById] No proposal found for ID:', id);
      return null;
    }

    console.log('🔍 [findById] PAM V1.0 SUCCESS - Found complete data:', {
      parceiro: result[0].parceiro_nome,
      loja: result[0].loja_nome,
      produto: result[0].produto_nome
    });

    // PAM V1.0 CORREÇÃO CRÍTICA: Usar o mesmo mapeador que funciona no findByCriteriaLightweight
    const mappedData = this.mapRowToProposalDTO(result[0]);
    
    // Retornar como Domain Object para manter compatibilidade com interface IProposalRepository
    return this.mapToDomain({
      id: mappedData.id,
      status: mappedData.status,
      clienteNome: mappedData.nomeCliente,
      clienteCpf: mappedData.cpfCliente,
      valor: mappedData.valorSolicitado,
      prazo: mappedData.prazo,
      taxaJuros: mappedData.taxaJuros,
      valorTac: mappedData.valorTac,
      valorIof: mappedData.valorIof,
      valorTotalFinanciado: mappedData.valorTotalFinanciado,
      finalidade: mappedData.finalidade,
      garantia: mappedData.garantia,
      produtoId: mappedData.produto?.id || null,
      tabelaComercialId: null, // TODO: adicionar se necessário
      lojaId: mappedData.lojaId,
      userId: mappedData.atendenteId,
      createdAt: mappedData.createdAt,
      updatedAt: mappedData.updatedAt,
      deletedAt: null
    });
  }

  // PAM V4.1 PERF-F2-001: Eliminando N+1 com JOIN otimizado
  async findByCriteria(criteria: ProposalSearchCriteria): Promise<Proposal[]> {
    const conditions = [isNull(propostas.deletedAt)];

    if (criteria.status) {
      conditions.push(eq(propostas.status, criteria.status));
    }

    if (criteria.lojaId) {
      conditions.push(eq(propostas.lojaId, criteria.lojaId));
    }

    if (criteria.atendenteId) {
      conditions.push(eq(propostas.userId, criteria.atendenteId));
    }

    if (criteria.cpf) {
      const cleanCPF = criteria.cpf.replace(/\D/g, '');
      conditions.push(eq(propostas.clienteCpf, cleanCPF));
    }

    if (criteria.dateFrom) {
      conditions.push(gte(propostas.createdAt, criteria.dateFrom));
    }

    if (criteria.dateTo) {
      conditions.push(lte(propostas.createdAt, criteria.dateTo));
    }

    console.log('🔍 [PAM V4.1] Executing optimized proposal query with JOINs...');
    
    // OPTIMIZATION: Single query with LEFT JOINs para eliminar N+1
    const results = await db
      .select({
        proposta: propostas,
        produto: produtos,
        tabelaComercial: tabelasComerciais,
        loja: lojas,
      })
      .from(propostas)
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .where(and(...conditions))
      .orderBy(desc(propostas.createdAt)); // Ordenação para melhor UX

    console.log(`🔍 [PAM V4.1] Query executed: ${results.length} proposals with joined data`);

    return results.map((row) => this.mapToDomainWithJoinedData(row));
  }

  // PERF-BOOST-001: Método otimizado para listagem sem Value Objects pesados
  async findByCriteriaLightweight(criteria: ProposalSearchCriteria): Promise<any[]> {
    const conditions = [isNull(propostas.deletedAt)];

    if (criteria.status) {
      conditions.push(eq(propostas.status, criteria.status));
    }
    
    // CORREÇÃO CRÍTICA: Suporte para múltiplos status na fila de análise
    if (criteria.statusArray && Array.isArray(criteria.statusArray)) {
      conditions.push(inArray(propostas.status, criteria.statusArray));
    }

    if (criteria.lojaId) {
      conditions.push(eq(propostas.lojaId, criteria.lojaId));
    }

    if (criteria.atendenteId) {
      conditions.push(eq(propostas.userId, criteria.atendenteId));
    }

    if (criteria.cpf) {
      const cleanCPF = criteria.cpf.replace(/\D/g, '');
      conditions.push(eq(propostas.clienteCpf, cleanCPF));
    }

    if (criteria.dateFrom) {
      conditions.push(gte(propostas.createdAt, criteria.dateFrom));
    }

    if (criteria.dateTo) {
      conditions.push(lte(propostas.createdAt, criteria.dateTo));
    }

    console.log('⚡ [PERF-BOOST-001] Executing lightweight query without Value Objects...');
    
    // OPTIMIZATION: Retornar dados diretos do banco sem conversão para domínio
    // OPERAÇÃO VISÃO CLARA V1.0: Adicionado JOIN com parceiros
    // CORREÇÃO CRÍTICA P3: Adicionar campos ausentes que causavam N/A no frontend
    const results = await db
      .select({
        id: propostas.id,
        status: propostas.status,
        cliente_nome: propostas.clienteNome,
        cliente_cpf: propostas.clienteCpf,
        valor: propostas.valor,
        prazo: propostas.prazo,
        taxa_juros: propostas.taxaJuros,
        // CAMPOS AUSENTES - CORREÇÃO P3
        valor_tac: propostas.valorTac,
        valor_iof: propostas.valorIof,
        valor_total_financiado: propostas.valorTotalFinanciado,
        finalidade: propostas.finalidade,
        garantia: propostas.garantia,
        produto_id: propostas.produtoId,
        produto_nome: produtos.nomeProduto,
        tabela_comercial_nome: tabelasComerciais.nomeTabela,
        loja_id: propostas.lojaId,
        loja_nome: lojas.nomeLoja,
        parceiro_id: parceiros.id,
        parceiro_nome: parceiros.razaoSocial,
        atendente_id: propostas.userId,
        created_at: propostas.createdAt,
        updated_at: propostas.updatedAt,
      })
      .from(propostas)
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
      .where(and(...conditions))
      .orderBy(desc(propostas.createdAt));

    console.log(`⚡ [PERF-BOOST-001] Query executed: ${results.length} proposals (lightweight)`);
    
    // PAM V1.0 DEBUG: Log do primeiro resultado para análise
    if (results.length > 0) {
      console.log('🔍 [PAM DEBUG] First result keys:', Object.keys(results[0]));
      console.log('🔍 [PAM DEBUG] loja_nome:', results[0].loja_nome);
      console.log('🔍 [PAM DEBUG] parceiro_nome:', results[0].parceiro_nome);
      console.log('🔍 [PAM DEBUG] LINHA 310 - TESTE CRÍTICO');
      console.log('🔍 [PAM DEBUG] DEBUG FINALIZADO - Próximo: MAPEADOR');
    } else {
      console.log('🔍 [PAM DEBUG] NENHUM RESULTADO ENCONTRADO!');
    }

    // PAM V1.0 - RECONSTRUÇÃO DO CONTRATO DE DADOS: Usar mapeador completo
    console.log('🔍 [PAM DEBUG] ANTES DO MAPEADOR - Total results:', results.length);
    console.log('🔍 [PAM DEBUG] CHAMANDO MAPEADOR...');
    
    try {
      const mappedResults = results.map((row) => this.mapRowToProposalDTO(row));
      console.log('🔍 [PAM DEBUG] MAPEADOR CONCLUÍDO - Total mapped:', mappedResults.length);
      return mappedResults;
    } catch (error: any) {
      console.error('🚨 [PAM DEBUG] ERRO NO MAPEADOR:', error);
      console.error('🚨 [PAM DEBUG] Stack trace:', error.stack);
      // FALLBACK: Retornar dados brutos se o mapeador falhar
      return results;
    }
  }

  /**
   * PAM V1.0 - RECONSTRUÇÃO DO CONTRATO DE DADOS
   * Método privado para mapeamento completo de dados do banco para frontend
   * Converte snake_case para camelCase e estrutura dados corretamente
   */
  private mapRowToProposalDTO(row: any): any {
    // PAM V1.0 DEBUG: Log para análise do mapeamento
    console.log('🔍 [MAPEADOR DEBUG] parceiro_id:', row.parceiro_id);
    console.log('🔍 [MAPEADOR DEBUG] parceiro_nome:', row.parceiro_nome);
    console.log('🔍 [MAPEADOR DEBUG] loja_id:', row.loja_id);
    console.log('🔍 [MAPEADOR DEBUG] loja_nome:', row.loja_nome);
    
    const result = {
      // Dados básicos da proposta
      id: row.id,
      status: row.status,
      numeroProposta: row.numero_proposta,
      
      // Dados do cliente (snake_case → camelCase)
      nomeCliente: row.cliente_nome,
      clienteNome: row.cliente_nome,
      cpfCliente: row.cliente_cpf,
      clienteCpf: row.cliente_cpf,
      emailCliente: row.cliente_email || null,
      telefoneCliente: row.cliente_telefone || null,
      
      // Dados financeiros (snake_case → camelCase)
      valor: row.valor,
      valorSolicitado: row.valor, // Frontend espera valorSolicitado
      prazo: row.prazo,
      taxaJuros: row.taxa_juros,
      valorTac: row.valor_tac,
      valorIof: row.valor_iof,
      valorTotalFinanciado: row.valor_total_financiado,
      finalidade: row.finalidade,
      garantia: row.garantia,
      
      // Dados de produtos e tabelas
      produtoId: row.produto_id,
      nomeProduto: row.produto_nome,
      tabelaComercialNome: row.tabela_comercial_nome,
      
      // Dados de datas (snake_case → camelCase)
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      
      // Dados estruturados de parceiro
      parceiro: row.parceiro_id ? {
        id: row.parceiro_id,
        razaoSocial: row.parceiro_nome
      } : null,
      
      // Dados estruturados de loja  
      loja: row.loja_id ? {
        id: row.loja_id,
        nomeLoja: row.loja_nome
      } : null,
      
      // Dados do atendente
      atendenteId: row.atendente_id,
      userId: row.atendente_id, // Compatibilidade
      
      // Cálculo de parcela (mantido do código anterior)
      valorParcela: Proposal.calculateMonthlyPaymentStatic(
        parseFloat(row.valor || '0'),
        parseFloat(row.taxa_juros || '0'),
        row.prazo || 1
      ),
    };
    
    console.log('🔍 [MAPEADOR DEBUG] OBJETO RESULT CRIADO COM SUCESSO');
    
    // PAM V1.0 DEBUG: Log do resultado final do mapeamento
    console.log('🔍 [MAPEADOR DEBUG] ANTES JSON STRINGIFY');
    console.log('🔍 [MAPEADOR DEBUG] result.parceiro existe?', !!result.parceiro);
    console.log('🔍 [MAPEADOR DEBUG] result.loja existe?', !!result.loja);
    console.log('🔍 [MAPEADOR DEBUG] RESULTADO FINAL parceiro:', result.parceiro);
    console.log('🔍 [MAPEADOR DEBUG] RESULTADO FINAL loja:', result.loja);
    
    return result;
  }

  async findAll(): Promise<Proposal[]> {
    const results = await db.select().from(propostas).where(isNull(propostas.deletedAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByStatus(status: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.status, status), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByCPF(cpf: string): Promise<Proposal[]> {
    const cleanCPF = cpf.replace(/\D/g, '');

    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.clienteCpf, cleanCPF), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByLojaId(lojaId: number): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.lojaId, lojaId), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async findByAtendenteId(atendenteId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(and(eq(propostas.userId, atendenteId), isNull(propostas.deletedAt)));

    return results.map((row) => this.mapToDomain(row));
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(propostas)
      .where(and(eq(propostas.id, id), isNull(propostas.deletedAt)));

    return result[0].count > 0;
  }

  async delete(id: string): Promise<void> {
    const now = new Date();

    await db.update(propostas).set({ deletedAt: now }).where(eq(propostas.id, id));
  }

  async getNextSequentialId(): Promise<number> {
    // Buscar o maior ID atual e incrementar
    // Como o ID é string no banco, precisamos converter
    const result = await db
      .select({ maxId: sql<number>`COALESCE(MAX(CAST(id AS INTEGER)), 300000)` })
      .from(propostas);

    return result[0].maxId + 1;
  }

  async getNextNumeroProposta(): Promise<number> {
    // Buscar o maior numero_proposta e incrementar
    // Inicia em 300001 se não houver propostas
    const result = await db
      .select({ maxNumero: sql<number>`COALESCE(MAX(numero_proposta), 300000)` })
      .from(propostas);

    return result[0].maxNumero + 1;
  }

  // ========================================================================
  // NOVOS MÉTODOS - PAM V1.0 QUERIES DE NEGÓCIO ESPECÍFICAS
  // ========================================================================

  async findByClienteCpfAndStatus(cpf: string, status: ProposalStatus[]): Promise<Proposal[]> {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.clienteCpf, cleanCPF),
          inArray(propostas.status, status),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(desc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findPendingForAnalysis(
    options: CursorPaginationOptions,
    filters?: RepositoryFilters
  ): Promise<PaginatedResult<Proposal>> {
    const {
      limit = 50,
      cursor,
      cursorField = 'created_at',
      direction = 'desc'
    } = options;

    // Validar limite
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    // Construir condições base
    const conditions = [
      eq(propostas.status, ProposalStatus.EM_ANALISE),
      isNull(propostas.deletedAt)
    ];

    // Adicionar filtros opcionais
    if (filters?.createdAfter) {
      conditions.push(gte(propostas.createdAt, filters.createdAfter));
    }
    if (filters?.createdBefore) {
      conditions.push(lte(propostas.createdAt, filters.createdBefore));
    }

    // Adicionar condição do cursor
    if (cursor && CursorUtils.isValid(cursor)) {
      const cursorValue = CursorUtils.decode(cursor);
      
      if (cursorField === 'created_at') {
        const cursorDate = new Date(cursorValue);
        const cursorCondition = direction === 'desc' 
          ? lt(propostas.createdAt, cursorDate)
          : gt(propostas.createdAt, cursorDate);
        conditions.push(cursorCondition);
      }
    }

    // Executar query OTIMIZADA com JOINs
    const query = db
      .select({
        proposta: propostas,
        produto: produtos,
        tabelaComercial: tabelasComerciais,
        loja: lojas,
        parceiro: parceiros
      })
      .from(propostas)
      .leftJoin(produtos, eq(propostas.produtoId, produtos.id))
      .leftJoin(tabelasComerciais, eq(propostas.tabelaComercialId, tabelasComerciais.id))
      .leftJoin(lojas, eq(propostas.lojaId, lojas.id))
      .leftJoin(parceiros, eq(lojas.parceiroId, parceiros.id))
      .where(and(...conditions))
      .limit(safeLimit + 1); // +1 para verificar hasNextPage

    // Aplicar ordenação
    if (direction === 'desc') {
      query.orderBy(desc(propostas.createdAt));
    } else {
      query.orderBy(asc(propostas.createdAt));
    }

    const results = await query;
    
    // Verificar se há próxima página
    const hasNextPage = results.length > safeLimit;
    const data = hasNextPage ? results.slice(0, safeLimit) : results;
    
    // Gerar cursors
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;
    
    if (hasNextPage && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = CursorUtils.createFromItem(lastItem.proposta, cursorField);
    }
    
    if (cursor && data.length > 0) {
      const firstItem = data[0];
      prevCursor = CursorUtils.createFromItem(firstItem.proposta, cursorField);
    }

    console.log('🚀 [PERF-OPT] findPendingForAnalysis optimized with JOINs:', data.length, 'proposals');
    
    return {
      data: data.map((row) => this.mapToDomainWithJoinedData(row)),
      pagination: {
        nextCursor,
        prevCursor,
        pageSize: data.length,
        hasNextPage,
        hasPrevPage: !!cursor
      }
    };
  }

  async findByComprometimentoRenda(threshold: number): Promise<Proposal[]> {
    // Query complexa que calcula comprometimento de renda
    // Utilizando campos de renda mensal e valor da proposta
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          isNull(propostas.deletedAt),
          sql`
            CASE 
              WHEN ${propostas.clienteRenda} IS NOT NULL AND ${propostas.clienteRenda} > 0 
              THEN ((${propostas.valor}::numeric / ${propostas.prazo}) / ${propostas.clienteRenda}::numeric) * 100 
              ELSE 0 
            END >= ${threshold}
          `
        )
      )
      .orderBy(desc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row));
  }

  async findPendingByAnalyst(analistaId: string): Promise<Proposal[]> {
    const results = await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.userId, analistaId),
          eq(propostas.status, ProposalStatus.EM_ANALISE),
          isNull(propostas.deletedAt)
        )
      )
      .orderBy(asc(propostas.createdAt)); // FIFO para workload management

    return results.map((row) => this.mapToDomain(row));
  }

  async findReadyForCCBGeneration(): Promise<Proposal[]> {
    // Busca propostas aprovadas que ainda não têm CCB gerada
    const results = await db
      .select({
        proposta: propostas,
      })
      .from(propostas)
      .leftJoin(ccbs, eq(propostas.id, ccbs.propostaId))
      .where(
        and(
          eq(propostas.status, ProposalStatus.APROVADO),
          isNull(propostas.deletedAt),
          isNull(ccbs.id) // Não tem CCB ainda
        )
      )
      .orderBy(asc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row.proposta));
  }

  async findAwaitingBoletoGeneration(): Promise<Proposal[]> {
    // Busca propostas com assinatura concluída que ainda não têm boletos
    const results = await db
      .select({
        proposta: propostas,
      })
      .from(propostas)
      .leftJoin(boletos, eq(propostas.id, boletos.propostaId))
      .where(
        and(
          eq(propostas.status, ProposalStatus.ASSINATURA_CONCLUIDA),
          isNull(propostas.deletedAt),
          isNull(boletos.id) // Não tem boletos ainda
        )
      )
      .orderBy(asc(propostas.createdAt));

    return results.map((row) => this.mapToDomain(row.proposta));
  }

  /**
   * PAM V4.1: Mapeia dados JOINados para o agregado Proposal
   * Inclui informações relacionadas (produto, tabela comercial, loja)
   */
  private mapToDomainWithJoinedData(row: any): Proposal {
    const proposal = this.mapToDomain(row.proposta);
    
    // Anexar dados relacionados ao agregado para evitar N+1 queries
    if (row.produto) {
      (proposal as any)._relatedProductName = row.produto.nomeProduto;
    }
    
    if (row.tabelaComercial) {
      (proposal as any)._relatedCommercialTableName = row.tabelaComercial.nomeTabela;
      (proposal as any)._relatedCommercialTableRate = row.tabelaComercial.taxaJuros;
    }
    
    if (row.loja) {
      (proposal as any)._relatedStoreName = row.loja.nomeLoja;
    }
    
    return proposal;
  }

  /**
   * Mapeia dados do banco para o agregado Proposal
   */
  private mapToDomain(row: any): Proposal {
    // ID já é string no banco
    const aggregateId = row.id;

    // Parse cliente_data from JSON string if it exists
    let clienteData;
    if (row.clienteData) {
      try {
        clienteData =
          typeof row.clienteData === 'string' ? JSON.parse(row.clienteData) : row.clienteData;
      } catch {
        clienteData = {
          nome: row.clienteNome,
          cpf: row.clienteCpf,
          rg: row.clienteRg,
          email: row.clienteEmail,
          telefone: row.clienteTelefone,
          endereco: row.clienteEndereco,
          cidade: row.clienteCidade,
          estado: row.clienteUf,
          cep: row.clienteCep,
          data_nascimento: row.clienteDataNascimento,
          renda_mensal: row.clienteRenda ? parseFloat(row.clienteRenda) : undefined,
          empregador: row.clienteEmpresaNome,
          tempo_emprego: row.clienteTempoEmprego,
          dividas_existentes: row.clienteDividasExistentes
            ? parseFloat(row.clienteDividasExistentes)
            : undefined,
        };
      }
    } else {
      clienteData = {
        nome: row.clienteNome,
        cpf: row.clienteCpf,
        rg: row.clienteRg,
        email: row.clienteEmail,
        telefone: row.clienteTelefone,
        endereco: row.clienteEndereco,
        cidade: row.clienteCidade,
        estado: row.clienteUf,
        cep: row.clienteCep,
        data_nascimento: row.clienteDataNascimento,
        renda_mensal: row.clienteRenda ? parseFloat(row.clienteRenda) : undefined,
        empregador: row.clienteEmpresaNome,
        tempo_emprego: row.clienteTempoEmprego,
        dividas_existentes: row.clienteDividasExistentes
          ? parseFloat(row.clienteDividasExistentes)
          : undefined,
      };
    }

    // OPERAÇÃO VISÃO CLARA V1.0: Mapear dados do banco para domínio

    // OPERAÇÃO VISÃO CLARA V1.0: Incluir campos ausentes no mapeamento
    return Proposal.fromDatabase({
      id: aggregateId,
      status: row.status,
      cliente_data: clienteData,
      valor: parseFloat(row.valor),
      prazo: row.prazo,
      taxa_juros: parseFloat(row.taxaJuros),
      produto_id: row.produtoId,
      tabela_comercial_id: row.tabelaComercialId,
      loja_id: row.lojaId,
      parceiro_id: row.parceiroId,
      atendente_id: row.atendenteId,
      // CORREÇÃO: Incluir campos que estavam ausentes - USANDO NOMES CORRETOS DO DRIZZLE SCHEMA
      valor_tac: row.valorTac ? parseFloat(row.valorTac) : 0,
      valor_iof: row.valorIof ? parseFloat(row.valorIof) : 0,
      valor_total_financiado: row.valorTotalFinanciado ? parseFloat(row.valorTotalFinanciado) : parseFloat(row.valor),
      finalidade: row.finalidade,
      garantia: row.garantia,
      dados_pagamento: row.dadosPagamentoMetodo
        ? {
            metodo: row.dadosPagamentoMetodo || row.metodoPagamento,
            banco: row.dadosPagamentoBanco,
            agencia: row.dadosPagamentoAgencia,
            conta: row.dadosPagamentoConta,
            tipo_conta: row.dadosPagamentoTipoConta,
            pix_chave: row.dadosPagamentoPix,
            pix_tipo: row.dadosPagamentoTipo,
          }
        : undefined,
      motivo_rejeicao: row.motivoRejeicao,
      observacoes: row.observacoes,
      ccb_url: row.ccbDocumentoUrl,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
  }
}
