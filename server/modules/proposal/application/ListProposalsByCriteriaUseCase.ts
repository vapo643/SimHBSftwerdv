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
    console.log('🚨 [USE CASE ENTRY] ListProposalsByCriteriaUseCase.execute STARTED');
    // 🏡 P0.2 - Delegar para repositório usando método lightweight
    const rawData = await this.proposalRepository.findByCriteriaLightweight(criteria);
    console.log('🚨 [USE CASE REPO] Repository returned data - Count:', rawData?.length || 0);

    // PAM V1.0 DEBUG: Log dos dados que chegam do repositório
    console.log('🔍 [USE CASE DEBUG] Dados do repositório:', rawData.length);
    if (rawData.length > 0) {
      console.log('🔍 [USE CASE DEBUG] Primeiro item:', JSON.stringify({
        parceiro: rawData[0].parceiro,
        loja: rawData[0].loja
      }));
    }

    console.log('🚨 [USE CASE MAPPING] Starting mapping of', rawData.length, 'items');
    
    // PAM V1.0 CORREÇÃO: Use Case deve usar dados já mapeados pelo repositório
    // Repositório agora retorna DTOs estruturados, não dados raw
    const result = rawData.map((row: any) => ({
      id: row.id,
      status: row.status,
      nomeCliente: row.nomeCliente, // ← Repositório já converte snake_case → camelCase
      cpfCliente: row.cpfCliente,   // ← Repositório já converte snake_case → camelCase  
      emailCliente: row.emailCliente || null,
      telefoneCliente: row.telefoneCliente || null,
      valorSolicitado: row.valor,
      prazo: row.prazo,
      taxaJuros: row.taxaJuros,     // ← Repositório já converte snake_case → camelCase
      valorTac: row.valorTac,       // ← Repositório já converte snake_case → camelCase
      valorIof: row.valorIof,       // ← Repositório já converte snake_case → camelCase
      valorTotalFinanciado: row.valorTotalFinanciado, // ← Repositório já converte
      finalidade: row.finalidade,
      garantia: row.garantia,
      lojaId: row.lojaId,           // ← Repositório já converte loja_id → lojaId
      // PAM V1.0 CORREÇÃO CRÍTICA: Usar dados estruturados do repositório
      parceiro: row.parceiro,       // ← JÁ ESTRUTURADO: { id: 1, razaoSocial: '...' }
      loja: row.loja,               // ← JÁ ESTRUTURADO: { id: 1, nomeLoja: '...' }
      createdAt: row.createdAt,     // ← Repositório já converte snake_case → camelCase
      updatedAt: row.updatedAt,     // ← Repositório já converte snake_case → camelCase
    }));
    
    console.log('🚨 [USE CASE RETURN] Returning', result.length, 'mapped items');
    return result;
  }
}