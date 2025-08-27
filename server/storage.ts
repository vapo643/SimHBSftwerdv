import {
  _users,
  _userSessions,
  _propostas,
  _propostaLogs,
  _gerenteLojas,
  _lojas,
  _parceiros,
  _produtos,
  _tabelasComerciais,
  _profiles,
  _auditDeleteLog,
  _interCollections,
  _interWebhooks,
  _interCallbacks,
  type User,
  type InsertUser,
  type Proposta,
  type InsertProposta,
  type UpdateProposta,
  type GerenteLojas,
  type InsertGerenteLojas,
  type Loja,
  type InsertLoja,
  type UpdateLoja,
  type InterCollection,
  type InsertInterCollection,
  type UpdateInterCollection,
  type InterWebhook,
  type InsertInterWebhook,
  type InterCallback,
  type InsertInterCallback,
} from '@shared/schema';
import { db } from './lib/supabase';
import { eq, desc, and, or, not, isNull } from 'drizzle-orm';
import { transitionTo, InvalidTransitionError } from './services/statusFsmService';

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUsersWithDetails(): Promise<any[]>;

  // Propostas
  getPropostas(): Promise<any[]>;
  getPropostaById(id): Promise<Proposta | undefined>;
  getPropostasByStatus(status: string): Promise<Proposta[]>;
  createProposta(proposta: InsertProposta): Promise<Proposta>;
  updateProposta(id, proposta: UpdateProposta): Promise<Proposta>;
  deleteProposta(id, deletedBy?: string): Promise<void>;

  // ClickSign Integration Methods
  getPropostaByClickSignKey(
    keyType: 'document' | 'list' | 'signer',
    key: string
  ): Promise<Proposta | undefined>;
  getCcbUrl(propostaId: string): Promise<string | null>;
  createPropostaLog(log: {
    propostaId: string;
    autorId: string;
    statusAnterior?: string;
    statusNovo: string;
    observacao?: string;
  }): Promise<unknown>;

  // Lojas
  getLojas(): Promise<Loja[]>;
  getLojaById(id: number): Promise<Loja | undefined>;
  createLoja(loja: InsertLoja): Promise<Loja>;
  updateLoja(id: number, loja: UpdateLoja): Promise<Loja>;
  deleteLoja(id: number, deletedBy?: string): Promise<void>;
  checkLojaDependencies(
    id: number
  ): Promise<{ hasUsers: boolean; hasPropostas: boolean; hasGerentes: boolean }>;

  // Gerente-Lojas Relationships
  getGerenteLojas(gerenteId: number): Promise<GerenteLojas[]>;
  getLojasForGerente(gerenteId: number): Promise<number[]>;
  getGerentesForLoja(lojaId: number): Promise<number[]>;
  addGerenteToLoja(relationship: InsertGerenteLojas): Promise<GerenteLojas>;
  removeGerenteFromLoja(gerenteId: number, lojaId: number): Promise<void>;

  // Inter Bank Collections
  createInterCollection(collection: InsertInterCollection): Promise<InterCollection>;
  getInterCollectionByProposalId(propostaId: string): Promise<InterCollection | undefined>;
  getInterCollectionsByProposalId(propostaId: string): Promise<InterCollection[]>;
  getInterCollectionByCodigoSolicitacao(
    codigoSolicitacao: string
  ): Promise<InterCollection | undefined>;
  updateInterCollection(
    codigoSolicitacao: string,
    updates: UpdateInterCollection
  ): Promise<InterCollection>;
  getInterCollections(): Promise<InterCollection[]>;

  // Inter Bank Webhooks
  createInterWebhook(webhook: InsertInterWebhook): Promise<InterWebhook>;
  getActiveInterWebhook(): Promise<InterWebhook | undefined>;
  updateInterWebhook(id: number, updates: Partial<InsertInterWebhook>): Promise<InterWebhook>;
  deleteInterWebhook(id: number): Promise<void>;

  // Inter Bank Callbacks
  createInterCallback(callback: InsertInterCallback): Promise<InterCallback>;
  getUnprocessedInterCallbacks(): Promise<InterCallback[]>;
  markInterCallbackAsProcessed(id: number, erro?: string): Promise<void>;

  // User Sessions
  createSession(session: {
    id: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<void>;
  getUserSessions(userId: string): Promise<
    Record<string, unknown>[]>{
      id: string;
      userId: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: Date;
      expiresAt: Date;
      lastActivityAt: Date;
      isActive: boolean;
    }>
  >;
  deleteSession(sessionId: string): Promise<void>;
  deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<void>;
  updateSessionActivity(sessionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const _result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const _result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const _result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  async getUsersWithDetails(): Promise<any[]> {
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const _supabase = createServerSupabaseAdminClient();

    try {
      const { data: users, error } = await _supabase.from('profiles').select(`
  _id,
          full_name,
  _role,
          loja_id,
          auth_user:auth.users!inner(email),
          loja:lojas(id, nome_loja, parceiro_id, parceiro:parceiros(id, razao_social)),
          gerente_lojas(loja_id, loja:lojas(id, nome_loja, parceiro_id, parceiro:parceiros(id, razao_social)))
        `);

      if (error) {
        console.error('Database error in getUsersWithDetails:', error);
        throw new Error(`Erro ao buscar usuários: ${error.message}`);
      }

      return users || [];
    }
catch (error) {
      console.error('Critical error in getUsersWithDetails:', error);
      throw error;
    }
  }

  async getPropostas(): Promise<any[]> {
    // Using raw SQL to handle the actual database schema with JSONB fields
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const _supabase = createServerSupabaseAdminClient();

    const { data, error } = await supabase
      .from('propostas')
      .select(
        `
  _id,
  _status,
        cliente_data,
        condicoes_data,
        loja_id,
        created_at,
        lojas!inner (
  _id,
          nome_loja,
          parceiros!inner (
  _id,
            razao_social
          )
        )
      `
      )
      // .is('deleted_at', null)  // Filter out soft-deleted records - coluna não existe ainda
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching propostas:', error);
      throw error;
    }

    // Map the data to match the expected format, extracting from JSONB fields
    return (data || []).map((p) => {
      const _clienteData = p.cliente_data || {};
      const _condicoesData = p.condicoes_data || {};

      // Debug: log raw data for first few proposals
      if (data && data.indexOf(p) < 3) {
        console.log(`[DEBUG] Proposta ${p.id}:`, {
  _condicoesData,
          valorRaw: condicoesData.valor,
          valorParsed: parseFloat(condicoesData.valor) || 0,
        });
      }

      return {
        id: p.id,
        status: p.status,
        nomeCliente: clienteData.nome || 'Cliente não informado',
        cpfCliente: clienteData.cpf,
        emailCliente: clienteData.email,
        telefoneCliente: clienteData.telefone,
        valorSolicitado: parseFloat(condicoesData.valor) || 0,
        prazo: condicoesData.prazo,
        lojaId: p.loja_id,
        createdAt: p.created_at,
        updatedAt: p.created_at,
        loja:
          p.lojas && p.lojas[0]
            ? {
                id: p.lojas[0].id,
                nomeLoja: p.lojas[0].nome_loja,
              }
            : null,
        parceiro:
          p.lojas && p.lojas[0] && p.lojas[0].parceiros && p.lojas[0].parceiros[0]
            ? {
                id: p.lojas[0].parceiros[0].id,
                razaoSocial: p.lojas[0].parceiros[0].razao_social,
              }
            : null,
      };
    });
  }

  async getPropostaById(id): Promise<any | undefined> {
    // Using Supabase to handle JSONB fields properly
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const _supabase = createServerSupabaseAdminClient();

    const { data, error } = await supabase
      .from('propostas')
      .select(
        `
  _id,
  _status,
        cliente_data,
        condicoes_data,  
        loja_id,
        created_at,
        produto_id,
        tabela_comercial_id,
        user_id,
        ccb_documento_url,
        analista_id,
        data_analise,
        motivo_pendencia,
        lojas (
  _id,
          nome_loja,
          parceiros (
  _id,
            razao_social
          )
        ),
        produtos (
  _id,
          nome_produto,
          tac_valor,
          tac_tipo
        ),
        tabelas_comerciais (
  _id,
          nome_tabela,
          taxa_juros,
  _prazos,
          comissao
        )
      `
      )
      .eq('id', String(id))
      // .is('deleted_at', null)  // Filter out soft-deleted records - coluna não existe ainda
      .single();

    if (error || !data) {
      console.error('Error fetching proposta by id:', error);
      return undefined;
    }

    // Buscar documentos associados à proposta
    const { data: documentos, error: docsError } = await supabase
      .from('proposta_documentos')
      .select('*')
      .eq('proposta_id', String(id))
      .order('created_at', { ascending: false });

    // Formatear documentos para o frontend com URLs assinadas
    const _documentosAnexados = [];
    if (documentos && documentos.length > 0) {
      for (const doc of documentos) {
        try {
          // Construir o caminho do arquivo no storage: proposta-{id}/{timestamp}-{fileName}
          // A URL salva contém o caminho completo: https://xxx._supabase.co/storage/v1/object/public/documents/proposta-{id}/{fileName}
          // Extrair o caminho após '/documents/'
          const _documentsIndex = doc.url.indexOf('/documents/');
          let filePath;

          if (documentsIndex !== -1) {
            // Extrair caminho após '/documents/'
            filePath = doc.url.substring(documentsIndex + '/documents/'.length);
          }
else {
            // Fallback: tentar extrair filename e reconstruir
            const _urlParts = doc.url.split('/');
            const _fileName = urlParts[urlParts.length - 1];
            filePath = `proposta-${String(id)}/${fileName}`;
          }

          console.log(`[DEBUG] Gerando URL assinada para: ${filePath}`);

          // Gerar URL assinada temporária (válida por 1 hora)
          const { data: signedUrl, error: signError } = await _supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600); // 1 hora

          if (signError) {
            console.error(`[ERROR] Erro ao gerar URL assinada para ${filePath}:`, signError);
          }

          documentosAnexados.push({
            name: doc.nome_arquivo,
            url: signError ? doc.url : signedUrl.signedUrl, // Fallback para URL original se houver erro
            type: doc.tipo || 'application/octet-stream',
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.created_at,
            category: 'supporting',
          });
        }
catch (error) {
          console.error(`Erro ao gerar URL assinada para documento ${doc.nome_arquivo}:`, error);
          // Fallback para URL original
          documentosAnexados.push({
            name: doc.nome_arquivo,
            url: doc.url,
            type: doc.tipo || 'application/octet-stream',
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.created_at,
            category: 'supporting',
          });
        }
      }
    }

    // Return complete structured data for editing
    return {
      id: data.id,
      status: data.status,
      // Keep JSONB structure for editing
      clienteData: data.cliente_data || {},
      condicoesData: data.condicoes_data || {},
      // Additional fields for display and logic
      motivoPendencia: data.motivo_pendencia,
      documentosAnexados: documentosAnexados, // Now includes real documents
      produtoId: data.produto_id,
      tabelaComercialId: data.tabela_comercial_id,
      lojaId: data.loja_id,
      userId: data.user_id,
      createdAt: data.created_at,
      ccbDocumentoUrl: data.ccb_documento_url,
      analistaId: data.analista_id,
      dataAnalise: data.data_analise,
      // Related entities (handling Supabase responses)
      loja: data.lojas
        ? {
            id: (data.lojas as unknown).id,
            nomeLoja: (data.lojas as unknown).nome_loja,
          }
        : null,
      parceiro:
        data.lojas && (data.lojas as unknown).parceiros
          ? {
              id: (data.lojas as unknown).parceiros.id,
              razaoSocial: (data.lojas as unknown).parceiros.razao_social,
            }
          : null,
      produto: data.produtos
        ? {
            id: (data.produtos as unknown).id,
            nomeProduto: (data.produtos as unknown).nome_produto,
            tacValor: (data.produtos as unknown).tac_valor,
            tacTipo: (data.produtos as unknown).tac_tipo,
          }
        : null,
      tabelaComercial: data.tabelas_comerciais
        ? {
            id: (data.tabelas_comerciais as unknown).id,
            nomeTabela: (data.tabelas_comerciais as unknown).nome_tabela,
            taxaJuros: (data.tabelas_comerciais as unknown).taxa_juros,
            prazos: (data.tabelas_comerciais as unknown).prazos,
            comissao: (data.tabelas_comerciais as unknown).comissao,
          }
        : null,
    };
  }

  async getPropostasByStatus(status: string): Promise<Proposta[]> {
    return await db
      .select()
      .from(propostas)
      .where(
        and(
          eq(propostas.status, status as unknown),
          isNull(propostas.deletedAt) // Filter out soft-deleted records
        )
      )
      .orderBy(desc(propostas.createdAt));
  }

  async createProposta(proposta): Promise<unknown> {
    // Transform the normalized data to JSONB format for the real database schema
    const { createServerSupabaseAdminClient } = await import('./lib/supabase');
    const _supabase = createServerSupabaseAdminClient();

    // Use the JSONB objects directly from the incoming data
    const _clienteData = proposta.clienteData || {};
    const _condicoesData = proposta.condicoesData || {};

    // Insert with the real database schema
    // ⚡ PAM V1.0 CORREÇÃO - DUPLA ESCRITA: JSON + Colunas Relacionais
    const { data, error } = await supabase
      .from('propostas')
      .insert({
        id: proposta.id,
        status: proposta.status || 'rascunho',
        loja_id: proposta.lojaId,
        user_id: proposta.userId,
        produto_id: proposta.produtoId,
        tabela_comercial_id: proposta.tabelaComercialId,
        cliente_data: clienteData, // Mantém o JSON completo
        condicoes_data: condicoesData,

        // ⚡ CORREÇÃO CRÍTICA - Populando colunas relacionais dedicadas
        cliente_nome: proposta.clienteNome || clienteData.nome,
        cliente_cpf: proposta.clienteCpf || clienteData.cpf,
        cliente_email: proposta.clienteEmail || clienteData.email,
        cliente_telefone: proposta.clienteTelefone || clienteData.telefone,

        // 🔥 PAM V1.0 FIX CRÍTICO - DADOS FINANCEIROS AUSENTES
        // Corrigindo a CAUSA RAIZ identificada na auditoria forense
        valor: proposta.valorTotalFinanciado || proposta.valor || condicoesData.valor,
        prazo: proposta.prazo || condicoesData.prazo,
        valor_tac: proposta.valorTac || condicoesData.valorTac,
        valor_iof: proposta.valorIof || condicoesData.valorIof,
        valor_total_financiado:
          proposta.valorTotalFinanciado ||
          proposta.valor ||
          condicoesData.valorTotalFinanciado ||
          condicoesData.valor,
        finalidade: proposta.finalidade || condicoesData.finalidade,
        garantia: proposta.garantia || condicoesData.garantia,

        // Dados de pagamento também nas colunas dedicadas
        metodo_pagamento: proposta.metodo_pagamento,
        dados_pagamento_banco: proposta.dados_pagamento_banco,
        dados_pagamento_agencia: proposta.dados_pagamento_agencia,
        dados_pagamento_conta: proposta.dados_pagamento_conta,
        dados_pagamento_digito: proposta.dados_pagamento_digito,
        dados_pagamento_tipo: proposta.dados_pagamento_tipo,
        dados_pagamento_pix: proposta.dados_pagamento_pix,
        dados_pagamento_tipo_pix: proposta.dados_pagamento_tipo_pix,
        dados_pagamento_pix_banco: proposta.dados_pagamento_pix_banco,
        dados_pagamento_pix_nome_titular: proposta.dados_pagamento_pix_nome_titular,
        dados_pagamento_pix_cpf_titular: proposta.dados_pagamento_pix_cpf_titular,
        dados_pagamento_nome_titular: proposta.dados_pagamento_nome_titular,
        dados_pagamento_cpf_titular: proposta.dados_pagamento_cpf_titular,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating proposta:', error);
      throw error;
    }

    console.log(`[DEBUG] Proposta ${data.id} criada com sucesso`);
    console.log(`✅ [PAM V1.0] CORREÇÃO CRÍTICA EXECUTADA - DADOS FINANCEIROS PERSISTIDOS:`, {
      id: data.id,
      cliente_nome: data.cliente_nome,
      valor: data.valor,
      valor_total_financiado: data.valor_total_financiado,
      prazo: data.prazo,
      valor_tac: data.valor_tac,
      valor_iof: data.valor_iof,
      finalidade: data.finalidade,
      garantia: data.garantia,
      condicoes_data_valor: data.condicoes_data?.valor,
      condicoes_data_valorTotalFinanciado: data.condicoes_data?.valorTotalFinanciado,
    });

    // Documents will be uploaded and associated separately via /api/propostas/:id/documentos endpoint

    return data;
  }

  async updateProposta(id, proposta: UpdateProposta): Promise<Proposta> {
    // propostas.id is text field (UUID), not numeric
    const _propostaId = typeof id == 'number' ? id.toString() : id;

    // PAM V1.0 - Se houver mudança de status, usar FSM para validação
    if (proposta.status) {
      // Determinar contexto baseado no status
      let contexto: 'pagamentos' | 'cobrancas' | 'formalizacao' | 'geral' = 'geral';
      if (['pago', 'pagamento_autorizado', 'PAGAMENTO_CONFIRMADO'].includes(proposta.status)) {
        contexto = 'pagamentos';
      }
else if (['QUITADO', 'INADIMPLENTE', 'EM_DIA', 'VENCIDO'].includes(proposta.status)) {
        contexto = 'cobrancas';
      }
else if (['CCB_GERADA', 'CCB_ASSINADA', 'ASSINATURA_PENDENTE'].includes(proposta.status)) {
        contexto = 'formalizacao';
      }

      try {
        await transitionTo({
  _propostaId,
          novoStatus: proposta.status,
          userId: 'storage-service',
  _contexto,
          observacoes: 'Atualização via storage.updateProposta',
          metadata: { origem: 'storage-service' },
        });
      }
catch (error) {
        if (error instanceof InvalidTransitionError) {
          // Re-lançar com mensagem mais clara para storage
          throw new Error(`Transição de status inválida: ${error.message}`);
        }
        throw error;
      }

      // Atualizar outros campos se necessário
      const _otherFields = { ...proposta };
      delete otherFields.status;

      if (Object.keys(otherFields).length > 0) {
        const _updateResult = await db
          .update(propostas)
          .set(otherFields)
          .where(eq(propostas.id, propostaId))
          .returning();
        return updateResult[0];
      }

      // Retornar proposta atualizada
      const [updated] = await db.select().from(propostas).where(eq(propostas.id, propostaId));
      return updated;
    }

    // Se não houver mudança de status, fazer update normal
    const _result = await db
      .update(propostas)
      .set(proposta)
      .where(eq(propostas.id, propostaId))
      .returning();
    return result[0];
  }

  async deleteProposta(id, deletedBy?: string): Promise<void> {
    // propostas.id is text field (UUID), not numeric
    const _propostaId = typeof id == 'number' ? id.toString() : id;
    // Soft delete - set deleted_at timestamp
    await db.update(propostas).set({ deletedAt: new Date() }).where(eq(propostas.id, propostaId));
  }

  // Lojas CRUD implementation
  async getLojas(): Promise<Loja[]> {
    return await db
      .select()
      .from(lojas)
      .where(
        and(
          eq(lojas.isActive, true),
          isNull(lojas.deletedAt) // Exclude soft-deleted records
        )
      )
      .orderBy(lojas.nomeLoja);
  }

  async getLojaById(id: number): Promise<Loja | undefined> {
    const _result = await db
      .select()
      .from(lojas)
      .where(
        and(
          eq(lojas.id, id),
          eq(lojas.isActive, true),
          isNull(lojas.deletedAt) // Exclude soft-deleted records
        )
      )
      .limit(1);
    return result[0];
  }

  async createLoja(loja: InsertLoja): Promise<Loja> {
    const _result = await db.insert(lojas).values(loja).returning();
    return result[0];
  }

  async updateLoja(id: number, loja: UpdateLoja): Promise<Loja> {
    const _result = await db.update(lojas).set(loja).where(eq(lojas.id, id)).returning();
    return result[0];
  }

  async deleteLoja(id: number, deletedBy?: string): Promise<void> {
    // Soft delete - set both isActive to false AND deleted_at timestamp
    await db
      .update(lojas)
      .set({
        isActive: false,
        deletedAt: new Date(),
      })
      .where(eq(lojas.id, id));
  }

  async checkLojaDependencies(
    id: number
  ): Promise<{ hasUsers: boolean; hasPropostas: boolean; hasGerentes: boolean }> {
    try {
      // Check if there are proposals associated with this store (excluding soft-deleted)
      const _propostasCount = await db
        .select({ id: propostas.id })
        .from(propostas)
        .where(and(eq(propostas.lojaId, id), isNull(propostas.deletedAt)))
        .limit(1);

      // Check if there are manager-store relationships
      const _gerentesCount = await db
        .select({ id: gerenteLojas.gerenteId })
        .from(gerenteLojas)
        .where(eq(gerenteLojas.lojaId, id))
        .limit(1);

      return {
        hasUsers: false, // Users don't have direct loja association in our current schema
        hasPropostas: propostasCount.length > 0,
        hasGerentes: gerentesCount.length > 0,
      };
    }
catch (error) {
      console.error('Error checking loja dependencies:', error);
      return {
        hasUsers: false,
        hasPropostas: false,
        hasGerentes: false,
      };
    }
  }

  // Gerente-Lojas Relationships
  async getGerenteLojas(gerenteId: number): Promise<GerenteLojas[]> {
    return await db.select().from(gerenteLojas).where(eq(gerenteLojas.gerenteId, gerenteId));
  }

  async getLojasForGerente(gerenteId: number): Promise<number[]> {
    const _result = await db
      .select({ lojaId: gerenteLojas.lojaId })
      .from(gerenteLojas)
      .where(eq(gerenteLojas.gerenteId, gerenteId));
    return _result.map((r) => r.lojaId);
  }

  async getGerentesForLoja(lojaId: number): Promise<number[]> {
    const _result = await db
      .select({ gerenteId: gerenteLojas.gerenteId })
      .from(gerenteLojas)
      .where(eq(gerenteLojas.lojaId, lojaId));
    return _result.map((r) => r.gerenteId);
  }

  async addGerenteToLoja(relationship: InsertGerenteLojas): Promise<GerenteLojas> {
    const _result = await db.insert(gerenteLojas).values(relationship).returning();
    return result[0];
  }

  async removeGerenteFromLoja(gerenteId: number, lojaId: number): Promise<void> {
    await db
      .delete(gerenteLojas)
      .where(and(eq(gerenteLojas.gerenteId, gerenteId), eq(gerenteLojas.lojaId, lojaId)));
  }

  // ClickSign Integration Methods Implementation
  async getPropostaByClickSignKey(
    keyType: 'document' | 'list' | 'signer',
    key: string
  ): Promise<Proposta | undefined> {
    let whereCondition;

    switch (keyType) {
      case 'document': {
        whereCondition = eq(propostas.clicksignDocumentKey, key);
        break;
      case 'list': {
        whereCondition = eq(propostas.clicksignListKey, key);
        break;
      case 'signer': {
        whereCondition = eq(propostas.clicksignSignerKey, key);
        break;
      default:
        throw new Error(`Invalid keyType: ${keyType}`);
    }

    const _result = await db.select().from(propostas).where(whereCondition).limit(1);
    return result[0];
  }

  async getCcbUrl(propostaId: string): Promise<string | null> {
    try {
      const { createServerSupabaseAdminClient } = await import('./lib/supabase');
      const _supabase = createServerSupabaseAdminClient();

      // Get proposal to find CCB file path
      const _proposta = await this.getPropostaById(propostaId);
      if (!proposta || !proposta.caminhoCcbAssinado) {
        console.log(`[CLICKSIGN] No CCB path found for proposal: ${propostaId}`);
        return null;
      }

      // Generate signed URL for CCB document
      const { data: signedUrlData, error: signedUrlError } = await _supabase.storage
        .from('documents')
        .createSignedUrl(proposta.caminhoCcbAssinado, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error(`[CLICKSIGN] Error generating signed URL for CCB:`, signedUrlError);
        return null;
      }

      return signedUrlData.signedUrl;
    }
catch (error) {
      console.error(`[CLICKSIGN] Error getting CCB URL:`, error);
      return null;
    }
  }

  async createPropostaLog(log: {
    propostaId: string;
    autorId: string;
    statusAnterior?: string;
    statusNovo: string;
    observacao?: string;
  }): Promise<unknown> {
    const _result = await db
      .insert(propostaLogs)
      .values({
        propostaId: log.propostaId,
        autorId: log.autorId,
        statusAnterior: log.statusAnterior || null,
        statusNovo: log.statusNovo,
        observacao: log.observacao || null,
      })
      .returning();

    return result[0];
  }

  // ==== INTER BANK METHODS ====

  // Inter Bank Collections
  async createInterCollection(collection: InsertInterCollection): Promise<InterCollection> {
    const _result = await db.insert(interCollections).values(collection).returning();
    return result[0];
  }

  async getInterCollectionByProposalId(propostaId: string): Promise<InterCollection | undefined> {
    const _result = await db
      .select()
      .from(interCollections)
      .where(and(eq(interCollections.propostaId, propostaId), eq(interCollections.isActive, true)))
      .limit(1);
    return result[0];
  }

  async getInterCollectionsByProposalId(propostaId: string): Promise<InterCollection[]> {
    return await db
      .select()
      .from(interCollections)
      .where(and(eq(interCollections.propostaId, propostaId), eq(interCollections.isActive, true)))
      .orderBy(interCollections.dataVencimento);
  }

  async getInterCollectionByCodigoSolicitacao(
    codigoSolicitacao: string
  ): Promise<InterCollection | undefined> {
    const _result = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
      .limit(1);
    return result[0];
  }

  async updateInterCollection(
    codigoSolicitacao: string,
    updates: UpdateInterCollection
  ): Promise<InterCollection> {
    const _result = await db
      .update(interCollections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interCollections.codigoSolicitacao, codigoSolicitacao))
      .returning();
    return result[0];
  }

  async getInterCollections(): Promise<InterCollection[]> {
    return await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.isActive, true))
      .orderBy(desc(interCollections.id));
  }

  // Inter Bank Webhooks
  async createInterWebhook(webhook: InsertInterWebhook): Promise<InterWebhook> {
    // Deactivate existing webhooks first
    await db.update(interWebhooks).set({ isActive: false });

    const _result = await db.insert(interWebhooks).values(webhook).returning();
    return result[0];
  }

  async getActiveInterWebhook(): Promise<InterWebhook | undefined> {
    const _result = await db
      .select()
      .from(interWebhooks)
      .where(eq(interWebhooks.isActive, true))
      .limit(1);
    return result[0];
  }

  async updateInterWebhook(
    id: number,
    updates: Partial<InsertInterWebhook>
  ): Promise<InterWebhook> {
    const _result = await db
      .update(interWebhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interWebhooks.id, id))
      .returning();
    return result[0];
  }

  async deleteInterWebhook(id: number): Promise<void> {
    await db.update(interWebhooks).set({ isActive: false }).where(eq(interWebhooks.id, id));
  }

  // Inter Bank Callbacks
  async createInterCallback(callback: InsertInterCallback): Promise<InterCallback> {
    const _result = await db.insert(interCallbacks).values(callback).returning();
    return result[0];
  }

  async getUnprocessedInterCallbacks(): Promise<InterCallback[]> {
    return await db
      .select()
      .from(interCallbacks)
      .where(eq(interCallbacks.processado, false))
      .orderBy(desc(interCallbacks.id));
  }

  async markInterCallbackAsProcessed(id: number, erro?: string): Promise<void> {
    await db
      .update(interCallbacks)
      .set({
        processado: true,
        processedAt: new Date(),
        erro: erro || null,
      })
      .where(eq(interCallbacks.id, id));
  }

  // User Sessions Management
  async createSession(session: {
    id: string;
    userId: string;
    token: string;
    ipAddress?: string;
    userAgent?: string;
    device?: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.insert(userSessions).values({
      id: session.id,
      userId: session.userId,
      token: session.token,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      device: session.device || null,
      expiresAt: session.expiresAt,
      lastActivityAt: new Date(),
      isActive: true,
    });
  }

  async getUserSessions(userId: string): Promise<
    Record<string, unknown>[]>{
      id: string;
      userId: string;
      token: string;
      ipAddress: string | null;
      userAgent: string | null;
      device: string | null;
      createdAt: Date;
      expiresAt: Date;
      lastActivityAt: Date;
      isActive: boolean;
    }>
  > {
    const _sessions = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)))
      .orderBy(desc(userSessions.lastActivityAt));

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await db.update(userSessions).set({ isActive: false }).where(eq(userSessions.id, sessionId));
  }

  async deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    if (exceptSessionId) {
      // Delete all sessions except the specified one
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(
          and(
            eq(userSessions.userId, userId),
            eq(userSessions.isActive, true),
            not(eq(userSessions.id, exceptSessionId))
          )
        );
    }
else {
      // Delete all sessions
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)));
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.id, sessionId));
  }
}

export const _storage = new DatabaseStorage();
