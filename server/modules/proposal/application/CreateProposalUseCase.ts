/**
 * Use Case: Criar Nova Proposta
 *
 * Orquestra a criação de uma nova proposta de crédito
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { Proposal } from '../domain/Proposal';
import { IProposalRepository } from '../domain/IProposalRepository';

export interface CreateProposalDTO {
  clienteNome: string;
  clienteCpf: string;
  clienteRg?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
  clienteCidade?: string;
  clienteEstado?: string;
  clienteCep?: string;
  clienteDataNascimento?: string;
  clienteRendaMensal?: number;
  clienteEmpregador?: string;
  clienteTempoEmprego?: string;
  clienteDividasExistentes?: number;
  valor: number;
  prazo: number;
  taxaJuros: number;
  produtoId?: number;
  lojaId?: number;
  atendenteId?: string;
}

export class CreateProposalUseCase {
  constructor(private repository: IProposalRepository) {}

  async execute(dto: CreateProposalDTO): Promise<{ id: string }> {
    // Mapear DTO para domínio
    const clienteData = {
      nome: dto.clienteNome,
      cpf: dto.clienteCpf,
      rg: dto.clienteRg,
      email: dto.clienteEmail,
      telefone: dto.clienteTelefone,
      endereco: dto.clienteEndereco,
      cidade: dto.clienteCidade,
      estado: dto.clienteEstado,
      cep: dto.clienteCep,
      data_nascimento: dto.clienteDataNascimento,
      renda_mensal: dto.clienteRendaMensal,
      empregador: dto.clienteEmpregador,
      tempo_emprego: dto.clienteTempoEmprego,
      dividas_existentes: dto.clienteDividasExistentes,
    };

    // Criar agregado usando factory method
    const proposal = Proposal.create(
      clienteData,
      dto.valor,
      dto.prazo,
      dto.taxaJuros,
      dto.produtoId,
      dto.lojaId,
      dto.atendenteId
    );

    // Persistir usando repositório
    await this.repository.save(proposal);

    // Retornar ID da proposta criada
    return { id: proposal.id };
  }
}
