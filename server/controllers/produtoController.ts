
import { db } from '../lib/supabase';
import { produtos, tabelasComerciais } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export const buscarTodosProdutos = async () => {
  return await db.query.produtos.findMany({
    where: eq(produtos.ativo, true),
    orderBy: [desc(produtos.id)],
  });
};

export const criarProduto = async (data: { nome: string; status: 'Ativo' | 'Inativo' }) => {
  const [novoProduto] = await db.insert(produtos).values({
    nome: data.nome,
    ativo: data.status === 'Ativo',
    lojaId: 1, // TODO: Get from user context
    taxaJuros: "0.00", // TODO: Add to form
    prazoMinimo: 12, // TODO: Add to form
    prazoMaximo: 60, // TODO: Add to form
    valorMinimo: "1000.00", // TODO: Add to form
    valorMaximo: "100000.00", // TODO: Add to form
  }).returning();
  return novoProduto;
};

export const atualizarProduto = async (id: string, data: { nome: string; status: 'Ativo' | 'Inativo' }) => {
  const [produtoAtualizado] = await db.update(produtos).set({
    nome: data.nome,
    ativo: data.status === 'Ativo',
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
    await db.update(produtos).set({ ativo: false }).where(eq(produtos.id, parseInt(id)));
};
