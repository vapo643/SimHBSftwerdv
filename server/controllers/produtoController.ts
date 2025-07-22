// /server/controllers/produtoController.ts
import { db } from '../lib/supabase';
import { produtos, tabelasComerciais } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export const buscarTodosProdutos = async () => {
  return await db.query.produtos.findMany({
    where: eq(produtos.ativo, true),
    orderBy: [desc(produtos.id)],
  });
};

export const criarProduto = async (data: { nome: string; status: 'Ativo' | 'Inativo'; lojaId: number; taxaJuros: string; prazoMinimo: number; prazoMaximo: number; valorMinimo: string; valorMaximo: string; descricao?: string }) => {
  const [novoProduto] = await db.insert(produtos).values({
    nome: data.nome,
    ativo: data.status === 'Ativo',
    lojaId: data.lojaId,
    taxaJuros: data.taxaJuros,
    prazoMinimo: data.prazoMinimo,
    prazoMaximo: data.prazoMaximo,
    valorMinimo: data.valorMinimo,
    valorMaximo: data.valorMaximo,
    descricao: data.descricao,
  }).returning();
  return novoProduto;
};

export const atualizarProduto = async (id: string, data: { nome: string; status: 'Ativo' | 'Inativo'; lojaId: number; taxaJuros: string; prazoMinimo: number; prazoMaximo: number; valorMinimo: string; valorMaximo: string; descricao?: string }) => {
  const [produtoAtualizado] = await db.update(produtos).set({
    nome: data.nome,
    ativo: data.status === 'Ativo',
    lojaId: data.lojaId,
    taxaJuros: data.taxaJuros,
    prazoMinimo: data.prazoMinimo,
    prazoMaximo: data.prazoMaximo,
    valorMinimo: data.valorMinimo,
    valorMaximo: data.valorMaximo,
    descricao: data.descricao,
  }).where(eq(produtos.id, parseInt(id))).returning();
  return produtoAtualizado;
};

export const verificarProdutoEmUso = async (id: string) => {
    // Check if product is referenced in any proposals or commercial tables
    // For now, we'll implement a simple check - in real scenario this would check actual usage
    return false; // Placeholder - would implement actual usage check
};

export const deletarProduto = async (id: string) => {
    // Soft delete
    await db.update(produtos).set({ ativo: false }).where(eq(produtos.id, parseInt(id)));
};