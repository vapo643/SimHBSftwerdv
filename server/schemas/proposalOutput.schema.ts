import { z } from 'zod';

/**
 * Schema de validação para a resposta da API de proposta
 * Garante que o backend cumpre o contrato estabelecido
 */
export const ProposalOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    numero_proposta: z.number().optional(),
    status: z.string(),

    // Dados do cliente - JSON aninhado
    cliente_data: z.any(), // Pode ser string JSON ou objeto
    clienteData: z.any(), // Duplicado para compatibilidade

    // Dados financeiros
    valor: z.any(),
    prazo: z.any(),
    taxa_juros: z.any().optional(),
    taxaJuros: z.any().optional(),
    valor_tac: z.any().optional(),
    valor_iof: z.any().optional(),
    valor_total_financiado: z.any().optional(),
    finalidade: z.string().optional(),
    garantia: z.string().optional(),

    // Dados relacionados
    loja_id: z.number().optional(),
    loja_nome: z.string().optional(),
    produto_id: z.number().optional(),
    produto_nome: z.string().optional(),
    tabela_comercial_id: z.number().optional(),
    tabela_comercial_nome: z.string().optional(),
    tabela_comercial_taxa: z.number().optional(),

    // Metadados
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
    updated_at: z.string().optional(),
    updatedAt: z.string().optional(),
    motivo_pendencia: z.string().optional(),
    motivoPendencia: z.string().optional(),
    motivo_rejeicao: z.string().optional(),
    motivoRejeicao: z.string().optional(),
    observacoes: z.string().optional(),

    // Campos calculados
    valor_parcela: z.number().optional(),
    valor_total: z.number().optional(),

    // Outros
    atendente_id: z.string().optional(),
    dados_pagamento: z.any().optional(),
    ccb_url: z.string().optional(),
    ccbUrl: z.string().optional(),
    documentos: z.array(z.any()).optional(),
  }),
});

export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;
