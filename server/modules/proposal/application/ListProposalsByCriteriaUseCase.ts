/**
 * List Proposals by Criteria Use Case - P0.2 GREEN CORRECTION
 * Elimina violação DIP no controller.list()
 * 
 * Controller não deve resolver repository diretamente
 * Seguindo padrão arquitetural existente
 */

import { IProposalRepository } from '../domain/IProposalRepository';

export interface ListProposalsCriteria {
  status?: string;
  queue?: string;
  lojaId?: number;
  atendenteId?: string;
}

export interface ProposalListItem {
  id: string;
  status: string;
  nomeCliente: string;
  cpfCliente: string;
  emailCliente: string | null;
  telefoneCliente: string | null;
  valorSolicitado: string;
  prazo: number;
  taxaJuros: string;
  valorTac: string;
  valorIof: string;
  valorTotalFinanciado: string;
  finalidade: string | null;
  garantia: string | null;
  lojaId: number;
  parceiro: {
    id: number;
    razaoSocial: string;
  };
  loja: {
    id: number;
    nomeLoja: string;
  };
  createdAt: string;
  updatedAt: string;
}

export class ListProposalsByCriteriaUseCase {
  constructor(
    private readonly proposalRepository: IProposalRepository
  ) {}

  async execute(criteria: ListProposalsCriteria): Promise<ProposalListItem[]> {
    // 🏡 P0.2 - Delegar para repositório usando método lightweight
    const rawData = await this.proposalRepository.findByCriteriaLightweight(criteria);

    // Mapear para formato esperado pelo frontend
    return rawData.map((row: any) => ({
      id: row.id,
      status: row.status,
      nomeCliente: row.cliente_nome,
      cpfCliente: row.cliente_cpf,
      emailCliente: row.cliente_email || null,
      telefoneCliente: row.cliente_telefone || null,
      valorSolicitado: row.valor,
      prazo: row.prazo,
      taxaJuros: row.taxa_juros,
      valorTac: row.valor_tac,
      valorIof: row.valor_iof,
      valorTotalFinanciado: row.valor_total_financiado,
      finalidade: row.finalidade,
      garantia: row.garantia,
      lojaId: row.loja_id,
      parceiro: row.parceiro_id ? {
        id: row.parceiro_id,
        razaoSocial: row.parceiro_nome,
      } : null,
      loja: row.loja_id ? {
        id: row.loja_id,
        nomeLoja: row.loja_nome,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}