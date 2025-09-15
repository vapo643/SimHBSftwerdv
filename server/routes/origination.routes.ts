import { Router } from 'express';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { AuthenticatedRequest } from '../../shared/types/express';
import { db } from '../lib/supabase';
import { eq, and, isNull } from 'drizzle-orm';
import {
  produtos,
  tabelasComerciais,
  lojas,
  parceiros,
  users,
  produtoTabelaComercial,
} from '@shared/schema';
import { getFromCache, setToCache } from '../services/cacheService';

const router = Router();

interface OriginationContext {
  atendente: {
    id: string;
    nome: string;
    loja: {
      id: number;
      nome: string;
      parceiro: {
        id: number;
        razaoSocial: string;
        cnpj: string;
      };
    } | null; // PAM V1.0: Allow null for ADMINISTRADOR role
  };
  produtos: Array<{
    id: number;
    nome: string;
    tacValor: string;
    tacTipo: string;
    tabelasDisponiveis: Array<{
      id: number;
      nomeTabela: string;
      taxaJuros: string;
      prazos: number[];
      comissao: string;
      tipo: 'personalizada' | 'geral';
    }>;
  }>;
  documentosObrigatorios: string[];
  limites: {
    valorMinimo: number;
    valorMaximo: number;
    prazoMinimo: number;
    prazoMaximo: number;
  };
}

// GET /api/origination/context - Orchestrator endpoint for T-01
router.get('/context', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // 1. Get authenticated user with their store and partner data
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // PAM V1.3: Enhanced Supabase client with production-specific error handling
    const { createServerSupabaseAdminClient, db } = await import('../lib/supabase');
    const supabase = createServerSupabaseAdminClient();
    
    // PAM V1.3: Validate client creation success
    if (!supabase) {
      console.error('[ORIGINATION-001] ERRO CRÍTICO: Supabase admin client não pôde ser criado');
      return res.status(500).json({ 
        message: 'Erro de configuração do sistema. Contate o administrador.',
        code: 'SUPABASE_CLIENT_CREATION_FAILED'
      });
    }

    console.log(`[ORIGINATION-002] Iniciando busca de perfil para userId: ${userId}`);
    
    // PAM V1.3: Test client connectivity before main query
    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
        
      if (testError) {
        console.error('[ORIGINATION-003] Teste de conectividade falhou:', testError);
        // Continue with fallback instead of failing immediately
      } else {
        console.log('[ORIGINATION-004] Teste de conectividade bem-sucedido');
      }
    } catch (connectivityError) {
      console.error('[ORIGINATION-005] Erro de conectividade:', connectivityError);
    }

    // PAM V1.3: Primary profile fetch with enhanced error handling
    let profileData = null;
    let profileError = null;
    
    try {
      const result = await supabase
        .from('profiles')
        .select('id, full_name, loja_id')
        .eq('id', userId)
        .single();
        
      profileData = result.data;
      profileError = result.error;
      
      console.log(`[ORIGINATION-006] Query result - Data: ${profileData ? 'FOUND' : 'NULL'}, Error: ${profileError ? 'YES' : 'NO'}`);
      
      if (profileError) {
        console.error('[ORIGINATION-007] Profile fetch error details:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code
        });
      }
    } catch (queryError) {
      console.error('[ORIGINATION-008] Query execution error:', queryError);
      profileError = { message: 'Query execution failed', details: queryError };
    }

    // PAM V1.3: Fallback to Drizzle if Supabase fails (production-specific)
    if ((profileError || !profileData) && process.env.NODE_ENV === 'production') {
      console.log('[ORIGINATION-009] Supabase falhou, tentando fallback via Drizzle...');
      
      try {
        if (db) {
          const drizzleResult = await db.query.profiles.findFirst({
            where: (profiles, { eq }) => eq(profiles.id, userId),
            columns: {
              id: true,
              full_name: true,
              loja_id: true
            }
          });
          
          if (drizzleResult) {
            console.log('[ORIGINATION-010] Fallback Drizzle bem-sucedido');
            profileData = {
              id: drizzleResult.id,
              full_name: drizzleResult.full_name,
              loja_id: drizzleResult.loja_id
            };
            profileError = null; // Clear error since we got data
          }
        }
      } catch (drizzleError) {
        console.error('[ORIGINATION-011] Fallback Drizzle também falhou:', drizzleError);
      }
    }

    if (profileError || !profileData) {
      console.error('[ORIGINATION-012] FALHA TOTAL - Nem Supabase nem Drizzle funcionaram');
      console.error('Profile fetch error:', profileError);
      return res.status(404).json({ 
        message: 'Perfil do usuário não encontrado',
        code: 'PROFILE_FETCH_FAILED',
        debug: process.env.NODE_ENV === 'development' ? profileError : undefined
      });
    }
    
    console.log(`[ORIGINATION-013] Perfil encontrado: ${profileData.full_name || 'sem nome'}`);

    // PAM V1.0: Get user role for admin privilege check
    const userRole = req.user?.role;

    // CRITICAL FIX: Handle users without stores gracefully (e.g. ANALISTA role)
    // EXCEPTION: ADMINISTRADOR role gets full access regardless of loja_id
    if (userRole !== 'ADMINISTRADOR' && !profileData.loja_id) {
      // Return minimal context for non-admin users without stores
      return res.json({
        atendente: {
          id: userId,
          nome: profileData.full_name || 'Usuário',
          loja: null,
        },
        produtos: [],
        documentosObrigatorios: [],
        limites: {
          valorMinimo: 1000,
          valorMaximo: 50000,
          prazoMinimo: 6,
          prazoMaximo: 48,
        },
      });
    }

    // PAM V1.0: Handle loja/parceiro data conditionally for ADMINISTRADOR
    let userProfile: any;
    let parceiroId: number | null = null;

    if (profileData.loja_id) {
      // PAM V1.3: Enhanced loja fetch with fallback handling
      let lojaData = null;
      let lojaError = null;
      
      try {
        const result = await supabase
          .from('lojas')
          .select(
            `
            id,
            nome_loja,
            parceiro_id,
            parceiros (
              id,
              razao_social,
              cnpj
            )
          `
          )
          .eq('id', profileData.loja_id)
          .single();
          
        lojaData = result.data;
        lojaError = result.error;
        
        console.log(`[ORIGINATION-014] Loja query - Data: ${lojaData ? 'FOUND' : 'NULL'}, Error: ${lojaError ? 'YES' : 'NO'}`);
      } catch (lojaQueryError) {
        console.error('[ORIGINATION-015] Loja query execution error:', lojaQueryError);
        lojaError = { message: 'Loja query execution failed', details: lojaQueryError };
      }
      
      // PAM V1.3: Fallback to Drizzle for loja data if needed
      if ((lojaError || !lojaData) && process.env.NODE_ENV === 'production' && db) {
        console.log('[ORIGINATION-016] Tentando fallback Drizzle para dados da loja...');
        
        try {
          const drizzleLojaResult = await db.query.lojas.findFirst({
            where: (lojas, { eq }) => eq(lojas.id, profileData.loja_id),
            with: {
              parceiro: {
                columns: {
                  id: true,
                  razaoSocial: true,
                  cnpj: true
                }
              }
            }
          });
          
          if (drizzleLojaResult) {
            console.log('[ORIGINATION-017] Fallback Drizzle para loja bem-sucedido');
            lojaData = {
              id: drizzleLojaResult.id,
              nome_loja: drizzleLojaResult.nomeLoja,
              parceiro_id: drizzleLojaResult.parceiroId,
              parceiros: drizzleLojaResult.parceiro ? {
                id: drizzleLojaResult.parceiro.id,
                razao_social: drizzleLojaResult.parceiro.razaoSocial,
                cnpj: drizzleLojaResult.parceiro.cnpj
              } : null
            };
            lojaError = null;
          }
        } catch (drizzleLojaError) {
          console.error('[ORIGINATION-018] Fallback Drizzle para loja falhou:', drizzleLojaError);
        }
      }

      if (lojaError || !lojaData) {
        console.error('[ORIGINATION-019] Loja fetch error:', lojaError);
        return res.status(404).json({ 
          message: 'Loja não encontrada',
          code: 'LOJA_FETCH_FAILED',
          debug: process.env.NODE_ENV === 'development' ? lojaError : undefined
        });
      }

      // Fix: parceiros should be a single object, not an array
      const parceiro = lojaData.parceiros as any;

      userProfile = {
        id: profileData.id,
        nome: profileData.full_name,
        loja_id: profileData.loja_id,
        nome_loja: lojaData.nome_loja,
        parceiro_id: lojaData.parceiro_id,
        razao_social: parceiro?.razao_social,
        cnpj: parceiro?.cnpj,
      };

      parceiroId = userProfile.parceiro_id;
    } else {
      // PAM V1.0: ADMINISTRADOR without store - create minimal profile
      userProfile = {
        id: profileData.id,
        nome: profileData.full_name,
        loja_id: null,
        nome_loja: 'Administração Global',
        parceiro_id: null,
        razao_social: 'Sistema Administrativo',
        cnpj: null,
      };
      parceiroId = null; // No partner filtering for global admin
    }

    // 2. Fetch all active products
    const produtosAtivos = await db.select().from(produtos).where(eq(produtos.isActive, true));

    // 3. For each product, fetch available commercial tables
    const produtosComTabelas = await Promise.all(
      produtosAtivos.map(async (produto) => {
        // Gerar chave de cache única e determinística
        const cacheKey = `tabelas-comerciais:produtoId:${produto.id}:parceiroId:${parceiroId}`;

        // Tentar buscar do cache primeiro
        const cachedTabelas = await getFromCache<
          Array<{
            id: number;
            nomeTabela: string;
            taxaJuros: string;
            prazos: number[];
            comissao: string;
            tipo: 'personalizada' | 'geral';
          }>
        >(cacheKey);

        if (cachedTabelas) {
          // Cache hit - retornar dados do cache
          return {
            id: produto.id,
            nome: produto.nomeProduto,
            tacValor: produto.tacValor || '0',
            tacTipo: produto.tacTipo || 'fixo',
            tabelasDisponiveis: cachedTabelas,
          };
        }

        // Cache miss - buscar do banco de dados
        let tabelasDisponiveis: Array<{
          id: number;
          nomeTabela: string;
          taxaJuros: string;
          prazos: number[];
          comissao: string;
          tipo: 'personalizada' | 'geral';
        }> = [];

        if (parceiroId === null) {
          // PAM V1.0: ADMINISTRADOR - fetch ALL tables for this product (personalized + general)
          const todasTabelas = await db
            .select({
              id: tabelasComerciais.id,
              nomeTabela: tabelasComerciais.nomeTabela,
              taxaJuros: tabelasComerciais.taxaJuros,
              prazos: tabelasComerciais.prazos,
              comissao: tabelasComerciais.comissao,
              parceiroId: tabelasComerciais.parceiroId,
            })
            .from(tabelasComerciais)
            .innerJoin(
              produtoTabelaComercial,
              eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
            )
            .where(eq(produtoTabelaComercial.produtoId, produto.id));

          tabelasDisponiveis = todasTabelas.map((t) => ({
            id: t.id,
            nomeTabela: t.nomeTabela,
            taxaJuros: t.taxaJuros,
            prazos: t.prazos,
            comissao: t.comissao,
            tipo: t.parceiroId ? ('personalizada' as const) : ('geral' as const),
          }));
        } else {
          // Standard flow: fetch personalized tables for this partner first
          const tabelasPersonalizadas = await db
            .select({
              id: tabelasComerciais.id,
              nomeTabela: tabelasComerciais.nomeTabela,
              taxaJuros: tabelasComerciais.taxaJuros,
              prazos: tabelasComerciais.prazos,
              comissao: tabelasComerciais.comissao,
            })
            .from(tabelasComerciais)
            .innerJoin(
              produtoTabelaComercial,
              eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
            )
            .where(
              and(
                eq(produtoTabelaComercial.produtoId, produto.id),
                eq(tabelasComerciais.parceiroId, parceiroId)
              )
            );

          tabelasDisponiveis = tabelasPersonalizadas.map((t) => ({
            id: t.id,
            nomeTabela: t.nomeTabela,
            taxaJuros: t.taxaJuros,
            prazos: t.prazos,
            comissao: t.comissao,
            tipo: 'personalizada' as const,
          }));

          // If no personalized tables, fetch general tables using N:N relationship
          if (tabelasPersonalizadas.length === 0) {
            const tabelasGerais = await db
              .select({
                id: tabelasComerciais.id,
                nomeTabela: tabelasComerciais.nomeTabela,
                taxaJuros: tabelasComerciais.taxaJuros,
                prazos: tabelasComerciais.prazos,
                comissao: tabelasComerciais.comissao,
              })
              .from(tabelasComerciais)
              .innerJoin(
                produtoTabelaComercial,
                eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
              )
              .where(
                and(
                  eq(produtoTabelaComercial.produtoId, produto.id),
                  isNull(tabelasComerciais.parceiroId)
                )
              );

            tabelasDisponiveis = tabelasGerais.map((t) => ({
              id: t.id,
              nomeTabela: t.nomeTabela,
              taxaJuros: t.taxaJuros,
              prazos: t.prazos,
              comissao: t.comissao,
              tipo: 'geral' as 'personalizada' | 'geral',
            }));
          }
        }

        // Armazenar no cache com TTL de 1 hora (3600 segundos)
        await setToCache(cacheKey, tabelasDisponiveis, 3600);

        return {
          id: produto.id,
          nome: produto.nomeProduto,
          tacValor: produto.tacValor || '0',
          tacTipo: produto.tacTipo || 'fixo',
          tabelasDisponiveis,
        };
      })
    );

    // 4. Build the orchestrated response
    const context: OriginationContext = {
      atendente: {
        id: userProfile.id,
        nome: userProfile.nome,
        loja: userProfile.loja_id ? {
          id: userProfile.loja_id,
          nome: userProfile.nome_loja,
          parceiro: {
            id: userProfile.parceiro_id,
            razaoSocial: userProfile.razao_social,
            cnpj: userProfile.cnpj,
          },
        } : null, // PAM V1.0: Handle null loja for ADMINISTRADOR
      },
      produtos: produtosComTabelas,
      documentosObrigatorios: [
        'Documento de Identidade (RG ou CNH)',
        'CPF',
        'Comprovante de Residência',
        'Comprovante de Renda',
        'Extrato Bancário (últimos 3 meses)',
      ],
      limites: {
        valorMinimo: 1000,
        valorMaximo: 50000,
        prazoMinimo: 6,
        prazoMaximo: 48,
      },
    };

    console.log(
      `[Origination Context] Retornando contexto para atendente ${userProfile.nome} da loja ${userProfile.nome_loja}`
    );
    res.json(context);
  } catch (error) {
    console.error('Erro ao buscar contexto de originação:', error);
    res.status(500).json({
      message: 'Erro ao buscar dados de originação',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
});

export default router;
