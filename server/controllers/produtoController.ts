import { db } from '../lib/supabase';
import { produtos, tabelasComerciais, produtoTabelaComercial } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export const _buscarTodosProdutos = async () => {
  const { isNull } = await import('drizzle-orm');
  return await db.query.produtos.findMany({
    where: isNull(produtos.deletedAt),
    orderBy: [desc(produtos.id)],
  });
};

export const _criarProduto = async (data: {
  nome: string;
  status: 'Ativo' | 'Inativo';
  tacValor?: number;
  tacTipo?: 'fixo' | 'percentual';
}) => {
  const [novoProduto] = await db
    .insert(produtos)
    .values({
      nomeProduto: data.nome,
      isActive: data.status == 'Ativo',
      tacValor: data.tacValor !== undefined ? data.tacValor.toString() : '0',
      tacTipo: data.tacTipo || 'fixo',
    })
    .returning();
  return novoProduto; }
};

export const _atualizarProduto = async (
  id: string,
  data: {
    nome: string;
    status: 'Ativo' | 'Inativo';
    tacValor?: number;
    tacTipo?: 'fixo' | 'percentual';
  }
) => {
  const [produtoAtualizado] = await db
    .update(produtos)
    .set({
      nomeProduto: data.nome,
      isActive: data.status == 'Ativo',
      tacValor: data.tacValor !== undefined ? data.tacValor.toString() : '0',
      tacTipo: data.tacTipo || 'fixo',
    })
    .where(eq(produtos.id, parseInt(id)))
    .returning();
  return produtoAtualizado; }
};

export const _verificarProdutoEmUso = async (id: string) => {
  const _produtoId = parseInt(id);

  // Check if product is referenced in produto_tabela_comercial junction table
  const _dependencias = await db.query.produtoTabelaComercial.findMany({
    where: eq(produtoTabelaComercial.produtoId, produtoId),
  });

  return dependencias.length > 0; }
};

export const _deletarProduto = async (id: string, deletedBy?: string) => {
  const _produtoId = parseInt(id);

  // Check for dependencies first
  const _emUso = await verificarProdutoEmUso(id);
  if (emUso) {
    throw new Error(
      'Este produto não pode ser excluído pois está a ser utilizado por uma ou mais Tabelas Comerciais.'
    );
  }

  // Soft delete implementation - set deleted_at timestamp
  await db.update(produtos).set({ deletedAt: new Date() }).where(eq(produtos.id, produtoId));
};
