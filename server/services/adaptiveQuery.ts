import { getCapabilities, hasColumn, getSafeColumns, type DatabaseCapabilities } from '../lib/dbCapabilities';
import { logInfo, logWarn } from '../lib/logger';

export interface AdaptiveQueryResult {
  data: any[];
  warnings: string[];
  fallbacksUsed: string[];
}

export interface PropostaFilters {
  status?: string[];
  userId?: string;
  lojaId?: number;
  role?: string;
}

export class AdaptiveQueryBuilder {
  private capabilities: DatabaseCapabilities | null = null;

  async initialize(): Promise<void> {
    this.capabilities = await getCapabilities();
  }

  private ensureInitialized(): DatabaseCapabilities {
    if (!this.capabilities) {
      throw new Error('AdaptiveQueryBuilder not initialized. Call initialize() first.');
    }
    return this.capabilities;
  }

  /**
   * Build adaptive query for formalization screen
   * Handles missing columns and relations gracefully
   */
  async buildFormalizacaoQuery(supabase: any, filters: PropostaFilters): Promise<AdaptiveQueryResult> {
    const caps = this.ensureInitialized();
    const warnings: string[] = [];
    const fallbacks: string[] = [];

    // Define ideal columns for formalization screen
    const idealColumns = [
      'id', 'codigo_identificacao', 'nome_cliente', 'cpf_cnpj',
      'valor_emprestimo', 'numero_parcelas', 'status', 'observacao_status',
      'created_at', 'updated_at', 'loja_id'
    ];

    // Get columns that actually exist
    let safeColumns = getSafeColumns(caps, 'propostas', idealColumns);
    const missingColumns = idealColumns.filter(col => !safeColumns.includes(col));

    if (missingColumns.length > 0) {
      warnings.push(`Missing columns in propostas table: ${missingColumns.join(', ')}`);
      fallbacks.push('column_fallback');
    }

    // CRITICAL: Ensure we never have empty select clause
    if (safeColumns.length === 0) {
      logWarn('🚨 [ADAPTIVE_QUERY] No safe columns found for formalization, using minimal fallback');
      safeColumns = ['id']; // Ultimate fallback
      fallbacks.push('columns_completely_unknown');
      warnings.push('Using minimal column selection due to schema detection failure');
    }

    // Build base query with guaranteed non-empty select
    let query = supabase.from('propostas').select(safeColumns.join(', '));

    // Add status filters for formalization
    const formalizationStatuses = [
      'aprovado', 'aceito_atendente', 'documentos_enviados',
      'CCB_GERADA', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_PENDENTE', 'ASSINATURA_CONCLUIDA'
    ];
    
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    } else {
      query = query.in('status', formalizationStatuses);
    }

    // Apply role-based filtering
    if (filters.role === 'ATENDENTE' && filters.userId) {
      if (hasColumn(caps, 'propostas', 'user_id')) {
        query = query.eq('user_id', filters.userId);
      } else {
        warnings.push('user_id column not found - role-based filtering unavailable');
        fallbacks.push('role_filter_unavailable');
      }
    } else if (filters.role === 'GERENTE' && filters.lojaId) {
      if (hasColumn(caps, 'propostas', 'loja_id')) {
        query = query.eq('loja_id', filters.lojaId);
      } else {
        warnings.push('loja_id column not found - store-based filtering unavailable');
        fallbacks.push('store_filter_unavailable');
      }
    }

    // CRITICAL: Add defensive ordering - check column availability first
    if (hasColumn(caps, 'propostas', 'updated_at')) {
      query = query.order('updated_at', { ascending: false });
    } else if (hasColumn(caps, 'propostas', 'created_at')) {
      query = query.order('created_at', { ascending: false });
      fallbacks.push('order_fallback_created_at');
    } else if (hasColumn(caps, 'propostas', 'id')) {
      query = query.order('id', { ascending: false });
      fallbacks.push('order_fallback_id');
    } else {
      // No ordering if no safe columns available
      fallbacks.push('no_ordering_available');
      warnings.push('No safe ordering column found - results may be unpredictable');
    }

    try {
      const { data, error } = await query;

      if (error) {
        logWarn('🔄 [ADAPTIVE_QUERY] Primary formalization query failed, trying minimal fallback', error);
        return await this.buildMinimalPropostasQuery(supabase, formalizationStatuses, filters);
      }

      // Try to enrich with loja data if relation exists
      let enrichedData = data || [];
      if (caps.relations.propostas_lojas && caps.lojas.exists) {
        enrichedData = await this.enrichWithLojaData(supabase, data || [], caps);
      } else {
        fallbacks.push('loja_relation_unavailable');
        warnings.push('Loja names will not be displayed - relation unavailable');
      }

      logInfo('✅ [ADAPTIVE_QUERY] Formalization query completed', {
        count: enrichedData.length,
        fallbacks: fallbacks.length,
        warnings: warnings.length
      });

      return {
        data: enrichedData,
        warnings,
        fallbacksUsed: fallbacks
      };

    } catch (error) {
      logWarn('🔄 [ADAPTIVE_QUERY] Formalization query exception, using minimal fallback', error);
      return await this.buildMinimalPropostasQuery(supabase, formalizationStatuses, filters);
    }
  }

  /**
   * Build adaptive query for analysis queue screen
   */
  async buildAnaliseQuery(supabase: any, filters: PropostaFilters): Promise<AdaptiveQueryResult> {
    const caps = this.ensureInitialized();
    const warnings: string[] = [];
    const fallbacks: string[] = [];

    // Define analysis columns - more focused than select('*')
    const analysisColumns = [
      'id', 'status', 'created_at', 'updated_at',
      'valor_solicitado', 'prazo_meses', 'loja_id', 'user_id',
      'cliente_data', 'condicoes_data'
    ];

    let safeColumns = getSafeColumns(caps, 'propostas', analysisColumns);
    const missingColumns = analysisColumns.filter(col => !safeColumns.includes(col));

    if (missingColumns.length > 0) {
      warnings.push(`Analysis columns not available: ${missingColumns.join(', ')}`);
      fallbacks.push('analysis_columns_limited');
    }

    // CRITICAL: Ensure we never have empty select clause
    if (safeColumns.length === 0) {
      logWarn('🚨 [ADAPTIVE_QUERY] No safe columns found for analysis, using minimal fallback');
      safeColumns = ['id']; // Ultimate fallback
      fallbacks.push('columns_completely_unknown');
      warnings.push('Using minimal column selection due to schema detection failure');
    }

    // Build query with guaranteed non-empty select
    let query = supabase.from('propostas').select(safeColumns.join(', '));

    // Analysis statuses
    const analysisStatuses = [
      'EM_ANALISE', 'AGUARDANDO_ANALISE',
      'em_analise', 'aguardando_analise'
    ];

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    } else {
      query = query.in('status', analysisStatuses);
    }

    // Apply role-based filtering with fallbacks
    if (filters.role === 'ATENDENTE' && filters.userId) {
      if (hasColumn(caps, 'propostas', 'user_id')) {
        query = query.eq('user_id', filters.userId);
      } else {
        fallbacks.push('user_filter_unavailable');
      }
    } else if (filters.role === 'GERENTE' && filters.lojaId) {
      if (hasColumn(caps, 'propostas', 'loja_id')) {
        query = query.eq('loja_id', filters.lojaId);
      } else {
        fallbacks.push('loja_filter_unavailable');
      }
    }

    // CRITICAL: Add defensive ordering - check column availability first
    if (hasColumn(caps, 'propostas', 'created_at')) {
      query = query.order('created_at', { ascending: false });
    } else if (hasColumn(caps, 'propostas', 'updated_at')) {
      query = query.order('updated_at', { ascending: false });
      fallbacks.push('order_fallback_updated_at');
    } else if (hasColumn(caps, 'propostas', 'id')) {
      query = query.order('id', { ascending: false });
      fallbacks.push('order_fallback_id');
    } else {
      // No ordering if no safe columns available
      fallbacks.push('no_ordering_available');
      warnings.push('No safe ordering column found - results may be unpredictable');
    }

    try {
      const { data, error } = await query;

      if (error) {
        logWarn('🔄 [ADAPTIVE_QUERY] Analysis query failed, using minimal fallback', error);
        return await this.buildMinimalPropostasQuery(supabase, analysisStatuses, filters);
      }

      // Post-process data to handle JSONB fields safely
      const processedData = (data || []).map((proposta: any) => this.processPropostaData(proposta, safeColumns));

      logInfo('✅ [ADAPTIVE_QUERY] Analysis query completed', {
        count: processedData.length,
        fallbacks: fallbacks.length
      });

      return {
        data: processedData,
        warnings,
        fallbacksUsed: fallbacks
      };

    } catch (error) {
      logWarn('🔄 [ADAPTIVE_QUERY] Analysis query exception, using minimal fallback', error);
      return await this.buildMinimalPropostasQuery(supabase, analysisStatuses, filters);
    }
  }

  /**
   * Build adaptive dashboard aggregations
   */
  async buildDashboardQuery(supabase: any, filters: PropostaFilters): Promise<AdaptiveQueryResult> {
    const caps = this.ensureInitialized();
    const warnings: string[] = [];
    const fallbacks: string[] = [];

    // Try different aggregation approaches based on capabilities
    try {
      // Attempt to get status counts
      const basicColumns = getSafeColumns(caps, 'propostas', ['id', 'status', 'created_at']);
      
      // CRITICAL: Ensure we never have empty select clause
      if (basicColumns.length === 0) {
        logWarn('🚨 [ADAPTIVE_QUERY] No safe columns found for dashboard, using minimal fallback');
        fallbacks.push('dashboard_columns_unknown');
        return {
          data: [],
          warnings: ['Dashboard temporarily unavailable - schema detection failed'],
          fallbacksUsed: fallbacks
        };
      }
      
      let query = supabase.from('propostas').select(basicColumns.join(', '));

      // Apply role-based filtering if available
      if (filters.role === 'ATENDENTE' && filters.userId && hasColumn(caps, 'propostas', 'user_id')) {
        query = query.eq('user_id', filters.userId);
      } else if (filters.role === 'GERENTE' && filters.lojaId && hasColumn(caps, 'propostas', 'loja_id')) {
        query = query.eq('loja_id', filters.lojaId);
      }

      const { data, error } = await query;

      if (error) {
        logWarn('🔄 [ADAPTIVE_QUERY] Dashboard query failed', error);
        fallbacks.push('dashboard_minimal');
        return {
          data: [],
          warnings: ['Dashboard data unavailable due to query errors'],
          fallbacksUsed: fallbacks
        };
      }

      // Process data into dashboard-friendly format
      const statusCounts = this.aggregateStatusCounts(data || []);
      
      return {
        data: statusCounts,
        warnings,
        fallbacksUsed: fallbacks
      };

    } catch (error) {
      logWarn('🔄 [ADAPTIVE_QUERY] Dashboard query exception', error);
      return {
        data: [],
        warnings: ['Dashboard temporarily unavailable'],
        fallbacksUsed: ['dashboard_exception']
      };
    }
  }

  /**
   * Minimal fallback query for when everything else fails
   */
  private async buildMinimalPropostasQuery(supabase: any, statuses: string[], filters: PropostaFilters): Promise<AdaptiveQueryResult> {
    const warnings = ['Using minimal query fallback - limited data available'];
    const fallbacks = ['minimal_query'];

    try {
      // Try the absolute minimum: just id and status
      // CRITICAL: Verify basic columns exist before building query
      const caps = this.capabilities;
      const absoluteMinimal = ['id'];
      
      // Try to add status if it exists
      if (caps && hasColumn(caps, 'propostas', 'status')) {
        absoluteMinimal.push('status');
      }
      
      if (absoluteMinimal.length === 0) {
        // This should never happen but guard against it
        logWarn('🚨 [ADAPTIVE_QUERY] Cannot even determine id column - complete failure');
        return {
          data: [],
          warnings: ['Complete database introspection failure'],
          fallbacksUsed: ['introspection_failure']
        };
      }
      
      let query = supabase.from('propostas').select(absoluteMinimal.join(', '));
      
      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        logWarn('🚨 [ADAPTIVE_QUERY] Even minimal query failed', error);
        return {
          data: [],
          warnings: ['Database query failed - no data available'],
          fallbacksUsed: ['total_failure']
        };
      }

      return {
        data: data || [],
        warnings,
        fallbacksUsed: fallbacks
      };

    } catch (error) {
      logWarn('🚨 [ADAPTIVE_QUERY] Minimal query exception', error);
      return {
        data: [],
        warnings: ['Complete query failure'],
        fallbacksUsed: ['exception_fallback']
      };
    }
  }

  /**
   * Enrich propostas with loja data using secondary queries
   */
  private async enrichWithLojaData(supabase: any, propostas: any[], caps: DatabaseCapabilities): Promise<any[]> {
    if (!propostas.length || !caps.lojas.exists) {
      return propostas;
    }

    try {
      // Get unique loja IDs
      const lojaIds = [...new Set(propostas.map(p => p.loja_id).filter(Boolean))];
      
      if (lojaIds.length === 0) {
        return propostas;
      }

      // Fetch loja data
      const lojaColumns = getSafeColumns(caps, 'lojas', ['id', 'nome', 'nome_loja']);
      
      // CRITICAL: Ensure we never have empty select clause
      if (lojaColumns.length === 0) {
        logWarn('⚠️ [ADAPTIVE_QUERY] No safe loja columns found, skipping enrichment');
        return propostas;
      }
      
      const { data: lojas } = await supabase
        .from('lojas')
        .select(lojaColumns.join(', '))
        .in('id', lojaIds);

      if (!lojas) {
        return propostas;
      }

      // Create lookup map
      const lojaMap = new Map(lojas.map((loja: any) => [loja.id, loja]));

      // Enrich propostas
      return propostas.map(proposta => ({
        ...proposta,
        loja: lojaMap.get(proposta.loja_id) || null
      }));

    } catch (error) {
      logWarn('⚠️ [ADAPTIVE_QUERY] Failed to enrich with loja data', error);
      return propostas;
    }
  }

  /**
   * Safely process proposta data, handling JSONB fields
   */
  private processPropostaData(proposta: any, availableColumns: string[]): any {
    const processed = { ...proposta };

    // Handle cliente_data JSONB field if available
    if (availableColumns.includes('cliente_data') && proposta.cliente_data) {
      try {
        const clienteData = typeof proposta.cliente_data === 'string' 
          ? JSON.parse(proposta.cliente_data)
          : proposta.cliente_data;
        
        // Add commonly needed fields to top level for frontend compatibility
        processed.clienteNome = clienteData.nome || 'Nome não informado';
        processed.clienteCpf = clienteData.cpf;
        processed.clienteEmail = clienteData.email;
      } catch (error) {
        logWarn(`Failed to parse cliente_data for proposta ${proposta.id}`, error);
        processed.clienteNome = 'Nome não informado';
      }
    }

    // Handle condicoes_data JSONB field if available
    if (availableColumns.includes('condicoes_data') && proposta.condicoes_data) {
      try {
        const condicoesData = typeof proposta.condicoes_data === 'string'
          ? JSON.parse(proposta.condicoes_data)
          : proposta.condicoes_data;
        
        processed.valorSolicitado = condicoesData.valorSolicitado || proposta.valor_emprestimo;
        processed.prazoMeses = condicoesData.prazoMeses || proposta.numero_parcelas;
      } catch (error) {
        logWarn(`Failed to parse condicoes_data for proposta ${proposta.id}`, error);
      }
    }

    return processed;
  }

  /**
   * Aggregate status counts for dashboard
   */
  private aggregateStatusCounts(propostas: any[]): any[] {
    const counts = new Map<string, number>();
    
    propostas.forEach(proposta => {
      const status = proposta.status || 'unknown';
      counts.set(status, (counts.get(status) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: propostas.length > 0 ? Math.round((count / propostas.length) * 100) : 0
    }));
  }
}

// Singleton instance for reuse
let adaptiveQueryBuilder: AdaptiveQueryBuilder | null = null;

export async function getAdaptiveQueryBuilder(): Promise<AdaptiveQueryBuilder> {
  if (!adaptiveQueryBuilder) {
    adaptiveQueryBuilder = new AdaptiveQueryBuilder();
    await adaptiveQueryBuilder.initialize();
  }
  return adaptiveQueryBuilder;
}