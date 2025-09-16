import { createServerSupabaseAdminClient } from './supabase';
import { logInfo, logError } from './logger';

export interface TableCapabilities {
  tableName: string;
  columns: string[];
  exists: boolean;
}

export interface DatabaseCapabilities {
  propostas: TableCapabilities;
  lojas: TableCapabilities;
  parceiros: TableCapabilities;
  profiles: TableCapabilities;
  relations: {
    propostas_lojas: boolean;
    propostas_profiles: boolean;
    lojas_parceiros: boolean;
  };
  lastChecked: Date;
}

// Cache capabilities for 15 minutes to avoid repeated database introspection
let capabilitiesCache: DatabaseCapabilities | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function getCapabilities(): Promise<DatabaseCapabilities> {
  const now = Date.now();
  
  // Return cached result if still valid
  if (capabilitiesCache && (now - lastCacheTime) < CACHE_DURATION) {
    return capabilitiesCache;
  }

  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    logInfo('🔍 [DB_CAPABILITIES] Starting database introspection...');

    // Probe core tables and their columns
    const capabilities: DatabaseCapabilities = {
      propostas: await probeTable(supabase, 'propostas'),
      lojas: await probeTable(supabase, 'lojas'),
      parceiros: await probeTable(supabase, 'parceiros'),
      profiles: await probeTable(supabase, 'profiles'),
      relations: {
        propostas_lojas: false,
        propostas_profiles: false,
        lojas_parceiros: false,
      },
      lastChecked: new Date(),
    };

    // Check if foreign key relations work
    if (capabilities.propostas.exists && capabilities.lojas.exists) {
      capabilities.relations.propostas_lojas = await testRelation(
        supabase,
        'propostas',
        'lojas!loja_id'
      );
    }

    if (capabilities.propostas.exists && capabilities.profiles.exists) {
      capabilities.relations.propostas_profiles = await testRelation(
        supabase,
        'propostas',
        'profiles!user_id'
      );
    }

    if (capabilities.lojas.exists && capabilities.parceiros.exists) {
      capabilities.relations.lojas_parceiros = await testRelation(
        supabase,
        'lojas',
        'parceiros!parceiro_id'
      );
    }

    // Cache the results
    capabilitiesCache = capabilities;
    lastCacheTime = now;

    logInfo('✅ [DB_CAPABILITIES] Database introspection completed', {
      propostas_columns: capabilities.propostas.columns.length,
      lojas_exists: capabilities.lojas.exists,
      relations_working: Object.values(capabilities.relations).filter(Boolean).length,
    });

    return capabilities;

  } catch (error) {
    logError('❌ [DB_CAPABILITIES] Failed to probe database capabilities', error);
    
    // Return minimal fallback capabilities
    const fallback: DatabaseCapabilities = {
      propostas: { tableName: 'propostas', columns: ['id', 'status'], exists: true },
      lojas: { tableName: 'lojas', columns: [], exists: false },
      parceiros: { tableName: 'parceiros', columns: [], exists: false },
      profiles: { tableName: 'profiles', columns: [], exists: false },
      relations: {
        propostas_lojas: false,
        propostas_profiles: false,
        lojas_parceiros: false,
      },
      lastChecked: new Date(),
    };

    capabilitiesCache = fallback;
    lastCacheTime = now;
    
    return fallback;
  }
}

async function probeTable(supabase: any, tableName: string): Promise<TableCapabilities> {
  try {
    // First, check if table exists by attempting a simple query
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      logInfo(`🔍 [DB_CAPABILITIES] Table '${tableName}' not accessible: ${error.message}`);
      return {
        tableName,
        columns: [],
        exists: false,
      };
    }

    // If we got data or an empty result, table exists
    // Extract column names from the response structure
    let columns: string[] = [];
    
    if (data && data.length > 0) {
      // Extract columns from first row
      columns = Object.keys(data[0]);
    } else {
      // Try to get columns from information_schema
      try {
        const { data: schemaData } = await supabase.rpc('get_table_columns', {
          table_name: tableName
        });
        
        if (schemaData) {
          columns = schemaData.map((col: any) => col.column_name);
        }
      } catch {
        // If RPC fails, use common columns for known tables
        columns = getCommonColumns(tableName);
      }
    }

    // CRITICAL: Final safety check - ensure we always have at least 'id'
    if (columns.length === 0) {
      logInfo(`🔧 [DB_CAPABILITIES] No columns detected for '${tableName}', using safe fallback: ['id']`);
      columns = ['id'];
    }

    logInfo(`✅ [DB_CAPABILITIES] Table '${tableName}' found with ${columns.length} columns`);
    
    return {
      tableName,
      columns,
      exists: true,
    };

  } catch (error) {
    logError(`❌ [DB_CAPABILITIES] Failed to probe table '${tableName}'`, error);
    return {
      tableName,
      columns: [],
      exists: false,
    };
  }
}

async function testRelation(supabase: any, fromTable: string, relationSyntax: string): Promise<boolean> {
  try {
    // Test if the relation syntax works by attempting a simple query
    const { error } = await supabase
      .from(fromTable)
      .select(`id, ${relationSyntax}(id)`)
      .limit(1);

    const works = !error;
    logInfo(`🔗 [DB_CAPABILITIES] Relation '${fromTable} -> ${relationSyntax}': ${works ? 'WORKS' : 'FAILED'}`);
    
    return works;
  } catch {
    return false;
  }
}

function getCommonColumns(tableName: string): string[] {
  // Fallback column lists for known tables
  const commonColumns: Record<string, string[]> = {
    propostas: [
      'id', 'status', 'created_at', 'updated_at',
      'valor_solicitado', 'prazo_meses', 'loja_id', 'user_id',
      'cliente_data', 'condicoes_data', 'codigo_identificacao',
      'nome_cliente', 'cpf_cnpj', 'valor_emprestimo', 'numero_parcelas'
    ],
    lojas: [
      'id', 'nome', 'parceiro_id', 'nome_loja', 'endereco', 'is_active'
    ],
    parceiros: [
      'id', 'razao_social', 'cnpj', 'comissao_padrao'
    ],
    profiles: [
      'id', 'full_name', 'role', 'loja_id'
    ],
  };

  return commonColumns[tableName] || ['id'];
}

// Utility function to check if a specific column exists
export function hasColumn(capabilities: DatabaseCapabilities, tableName: keyof DatabaseCapabilities, columnName: string): boolean {
  const table = capabilities[tableName];
  if (typeof table === 'object' && 'columns' in table) {
    return table.columns.includes(columnName);
  }
  return false;
}

// Utility function to get safe column selection
export function getSafeColumns(capabilities: DatabaseCapabilities, tableName: keyof DatabaseCapabilities, desiredColumns: string[]): string[] {
  const table = capabilities[tableName];
  if (typeof table === 'object' && 'columns' in table && table.exists) {
    const filteredColumns = desiredColumns.filter(col => table.columns.includes(col));
    // CRITICAL: Always return at least ['id'] even if table exists but no desired columns found
    if (filteredColumns.length === 0) {
      // Try to use 'id' if it exists in table columns, otherwise use first available column
      if (table.columns.includes('id')) {
        return ['id'];
      } else if (table.columns.length > 0) {
        return [table.columns[0]]; // Use first available column as fallback
      } else {
        return ['id']; // Ultimate fallback even if table.columns is somehow empty
      }
    }
    return filteredColumns;
  }
  return ['id']; // Always try to include id as minimum
}