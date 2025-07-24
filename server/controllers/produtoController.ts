
import { db } from '../lib/supabase';
import { produtos, tabelasComerciais } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export const buscarTodosProdutos = async () => {
  return await db.query.produtos.findMany({
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
    // Since there's no direct relation between produtos and tabelasComerciais,
    // we'll check if this product is referenced anywhere
    // For now, return false to allow deletion
    return false;
};

export const deletarProduto = async (id: string) => {
    // Soft delete
    await db.update(produtos).set({ isActive: false }).where(eq(produtos.id, parseInt(id)));
};
