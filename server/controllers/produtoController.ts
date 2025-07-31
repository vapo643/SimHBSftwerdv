
import { db } from '../lib/supabase';
import { produtos, tabelasComerciais, produtoTabelaComercial } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export const buscarTodosProdutos = async () => {
  const { isNull } = await import("drizzle-orm");
  return await db.query.produtos.findMany({
    where: isNull(produtos.deletedAt),
    orderBy: [desc(produtos.id)],
  });
};

export const criarProduto = async (data: { nome: string; status: 'Ativo' | 'Inativo' }) => {
  const [novoProduto] = await db.insert(produtos).values({
    nomeProduto: data.nome,
    isActive: data.status === 'Ativo',
  }).returning();
  return novoProduto;
};

export const atualizarProduto = async (id: string, data: { nome: string; status: 'Ativo' | 'Inativo' }) => {
  const [produtoAtualizado] = await db.update(produtos).set({
    nomeProduto: data.nome,
    isActive: data.status === 'Ativo',
  }).where(eq(produtos.id, parseInt(id))).returning();
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
        throw new Error('Este produto não pode ser excluído pois está a ser utilizado por uma ou mais Tabelas Comerciais.');
    }
    
    // Soft delete implementation - set deleted_at timestamp
    await db.update(produtos)
        .set({ deletedAt: new Date() })
        .where(eq(produtos.id, produtoId));
};
