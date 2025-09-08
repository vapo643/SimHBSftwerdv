import { db } from '../lib/supabase';
import { produtos, tabelasComerciais, produtoTabelaComercial } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

// PAM V4.2 PERF-F3-001: Cache-aside pattern implementation
export const buscarTodosProdutos = async () => {
  const { CachedQueries } = await import('../lib/cache-manager');

  console.log('🔍 [PAM V4.2] Buscando produtos com cache-aside pattern...');

  return await CachedQueries.getProducts(async () => {
    console.log('🔍 [PAM V4.2] CACHE MISS - Buscando produtos no banco de dados...');
    const { isNull } = await import('drizzle-orm');
    const result = await db.query.produtos.findMany({
      where: isNull(produtos.deletedAt),
      orderBy: [desc(produtos.id)],
    });
    console.log(`🔍 [PAM V4.2] Produtos carregados do banco: ${result.length} registros`);
    return result;
  });
};

export const criarProduto = async (data: {
  nome: string;
  status: 'Ativo' | 'Inativo';
  tacValor?: number;
  tacTipo?: 'fixo' | 'percentual';
  tacAtivaParaClientesExistentes?: boolean;
}) => {
  const [novoProduto] = await db
    .insert(produtos)
    .values({
      nomeProduto: data.nome,
      isActive: data.status === 'Ativo',
      tacValor: data.tacValor !== undefined ? data.tacValor.toString() : '0',
      tacTipo: data.tacTipo || 'fixo',
      tacAtivaParaClientesExistentes: data.tacAtivaParaClientesExistentes ?? true,
    })
    .returning();

  // PAM V4.2 PERF-F3-001: Cache invalidation após escrita
  const cacheManager = await import('../lib/cache-manager');
  await cacheManager.default.invalidate('products:all', 'products');
  console.log('🔥 [PAM V4.2] CACHE INVALIDATED: products após criação');

  return novoProduto;
};

export const atualizarProduto = async (
  id: string,
  data: {
    nome: string;
    status: 'Ativo' | 'Inativo';
    tacValor?: number;
    tacTipo?: 'fixo' | 'percentual';
    tacAtivaParaClientesExistentes?: boolean;
  }
) => {
  const [produtoAtualizado] = await db
    .update(produtos)
    .set({
      nomeProduto: data.nome,
      isActive: data.status === 'Ativo',
      tacValor: data.tacValor !== undefined ? data.tacValor.toString() : '0',
      tacTipo: data.tacTipo || 'fixo',
      tacAtivaParaClientesExistentes: data.tacAtivaParaClientesExistentes ?? true,
    })
    .where(eq(produtos.id, parseInt(id)))
    .returning();

  // PAM V4.2 PERF-F3-001: Cache invalidation após atualização
  const cacheManager = await import('../lib/cache-manager');
  await cacheManager.default.invalidate('products:all', 'products');
  console.log('🔥 [PAM V4.2] CACHE INVALIDATED: products após atualização');

  return produtoAtualizado;
};

export const verificarProdutoEmUso = async (id: string) => {
  const produtoId = parseInt(id);

  // Check if product is referenced in produto_tabela_comercial junction table
  const dependencias = await db.query.produtoTabelaComercial.findMany({
    where: eq(produtoTabelaComercial.produtoId, produtoId),
  });

  return dependencias.length > 0;
};

export const deletarProduto = async (id: string, deletedBy?: string) => {
  const produtoId = parseInt(id);

  // Check for dependencies first
  const emUso = await verificarProdutoEmUso(id);
  if (emUso) {
    throw new Error(
      'Este produto não pode ser excluído pois está a ser utilizado por uma ou mais Tabelas Comerciais.'
    );
  }

  // Soft delete implementation - set deleted_at timestamp
  await db.update(produtos).set({ deletedAt: new Date() }).where(eq(produtos.id, produtoId));

  // PAM V4.2 PERF-F3-001: Cache invalidation após exclusão
  const cacheManager = await import('../lib/cache-manager');
  await cacheManager.default.invalidate('products:all', 'products');
  console.log('🔥 [PAM V4.2] CACHE INVALIDATED: products após exclusão');
};
