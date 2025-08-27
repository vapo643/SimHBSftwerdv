import { Router } from 'express';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { AuthenticatedRequest } from '../../shared/types/express';
import { db } from '../lib/supabase';
import { eq, and, isNull } from 'drizzle-orm';
import {
  _produtos,
  _tabelasComerciais,
  _lojas,
  _parceiros,
  _users,
  _produtoTabelaComercial,
} from '@shared/schema';
import { getFromCache, setToCache } from '../services/cacheService';

const _router = Router();

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
    };
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
router.get('/context', _jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // 1. Get authenticated user with their store and partner data
    const _userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Fetch user profile with store and partner information using Supabase client
    const { createServerSupabaseAdminClient } = await import('../lib/supabase');
    const _supabase = createServerSupabaseAdminClient();

    // First, get the profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, loja_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Profile fetch error:', profileError);
      return res.status(401).json({error: "Unauthorized"});
    }

    // CRITICAL FIX: Handle users without stores gracefully (e.g. ANALISTA role)
    if (!profileData.loja_id) {
      // Return minimal context for users without stores
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

    // Then, get the loja and parceiro data
    const { data: lojaData, error: lojaError } = await supabase
      .from('lojas')
      .select(
        `
  _id,
        nome_loja,
        parceiro_id,
        parceiros (
  _id,
          razao_social,
          cnpj
        )
      `
      )
      .eq('id', profileData.loja_id)
      .single();

    if (lojaError || !lojaData) {
      console.error('Loja fetch error:', lojaError);
      return res.status(401).json({error: "Unauthorized"});
    }

    // Fix: parceiros should be a single object, not an array
    const _parceiro = lojaData.parceiros as unknown;

    const _userProfile = {
      id: profileData.id,
      nome: profileData.full_name,
      loja_id: profileData.loja_id,
      nome_loja: lojaData.nome_loja,
      parceiro_id: lojaData.parceiro_id,
      razao_social: parceiro?.razao_social,
      cnpj: parceiro?.cnpj,
    };

    const _parceiroId = userProfile.parceiro_id;

    // 2. Fetch all active products
    const _produtosAtivos = await db.select().from(produtos).where(eq(produtos.isActive, true));

    // 3. For each product, fetch available commercial tables
    const _produtosComTabelas = await Promise.all(
      produtosAtivos.map(async (produto) => {
        // Gerar chave de cache única e determinística
        const _cacheKey = `tabelas-comerciais:produtoId:${produto.id}:parceiroId:${parceiroId}`;

        // Tentar buscar do cache primeiro
        const _cachedTabelas = await getFromCache<
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
        // First, fetch personalized tables for this partner using N:N relationship
        const _tabelasPersonalizadas = await db
          .select({
            id: tabelasComerciais.id,
            nomeTabela: tabelasComerciais.nomeTabela,
            taxaJuros: tabelasComerciais.taxaJuros,
            prazos: tabelasComerciais.prazos,
            comissao: tabelasComerciais.comissao,
          })
          .from(tabelasComerciais)
          .innerJoin(
  _produtoTabelaComercial,
            eq(tabelasComerciais.id, produtoTabelaComercial.tabelaComercialId)
          )
          .where(
            and(
              eq(produtoTabelaComercial.produtoId, produto.id),
              eq(tabelasComerciais.parceiroId, parceiroId)
            )
          );

        let tabelasDisponiveis: Array<{
          id: number;
          nomeTabela: string;
          taxaJuros: string;
          prazos: number[];
          comissao: string;
          tipo: 'personalizada' | 'geral';
        }> = tabelasPersonalizadas.map((t) => ({
          id: t.id,
          nomeTabela: t.nomeTabela,
          taxaJuros: t.taxaJuros,
          prazos: t.prazos,
          comissao: t.comissao,
          tipo: 'personalizada' as const,
        }));

        // If no personalized tables, fetch general tables using N:N relationship
        if (tabelasPersonalizadas.length == 0) {
          const _tabelasGerais = await db
            .select({
              id: tabelasComerciais.id,
              nomeTabela: tabelasComerciais.nomeTabela,
              taxaJuros: tabelasComerciais.taxaJuros,
              prazos: tabelasComerciais.prazos,
              comissao: tabelasComerciais.comissao,
            })
            .from(tabelasComerciais)
            .innerJoin(
  _produtoTabelaComercial,
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

        // Armazenar no cache com TTL de 1 hora (3600 segundos)
        await setToCache(cacheKey, tabelasDisponiveis, 3600);

        return {
          id: produto.id,
          nome: produto.nomeProduto,
          tacValor: produto.tacValor || '0',
          tacTipo: produto.tacTipo || 'fixo',
  _tabelasDisponiveis,
        };
      })
    );

    // 4. Build the orchestrated response
    const context: OriginationContext = {
      atendente: {
        id: userProfile.id,
        nome: userProfile.nome,
        loja: {
          id: userProfile.loja_id,
          nome: userProfile.nome_loja,
          parceiro: {
            id: userProfile.parceiro_id,
            razaoSocial: userProfile.razao_social,
            cnpj: userProfile.cnpj,
          },
        },
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
  }
catch (error) {
    console.error('Erro ao buscar contexto de originação:', error);
    res.status(500).json({
      message: 'Erro ao buscar dados de originação',
      error:
        process.env.NODE_ENV == 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
});

export default router;
