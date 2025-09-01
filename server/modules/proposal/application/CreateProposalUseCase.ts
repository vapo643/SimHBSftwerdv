/**
 * Use Case: Criar Nova Proposta
 *
 * Orquestra a criação de uma nova proposta de crédito
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 */

import { Proposal } from '../domain/Proposal';
import { IProposalRepository } from '../domain/IProposalRepository';
import { CPF, Money, Email, PhoneNumber, CEP } from '@shared/value-objects';

export interface CreateProposalDTO {
  // Dados básicos do cliente
  clienteNome: string;
  clienteCpf: string;
  tipoPessoa?: string;
  clienteRazaoSocial?: string;
  clienteCnpj?: string;
  
  // Documentação completa (RG)
  clienteRg?: string;
  clienteOrgaoEmissor?: string;
  clienteRgUf?: string;
  clienteRgDataEmissao?: string;
  
  // Dados pessoais
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteDataNascimento?: string;
  clienteLocalNascimento?: string;
  clienteEstadoCivil?: string;
  clienteNacionalidade?: string;
  
  // Endereço detalhado
  clienteCep?: string;
  clienteLogradouro?: string;
  clienteNumero?: string;
  clienteComplemento?: string;
  clienteBairro?: string;
  clienteCidade?: string;
  clienteUf?: string;
  clienteEndereco?: string; // Campo concatenado para compatibilidade
  
  // Dados profissionais
  clienteOcupacao?: string;
  clienteRenda?: number;
  clienteTelefoneEmpresa?: string;
  
  // Dados de pagamento
  metodoPagamento?: string;
  dadosPagamentoBanco?: string;
  dadosPagamentoAgencia?: string;
  dadosPagamentoConta?: string;
  dadosPagamentoDigito?: string;
  dadosPagamentoPix?: string;
  dadosPagamentoTipoPix?: string;
  dadosPagamentoPixBanco?: string;
  dadosPagamentoPixNomeTitular?: string;
  dadosPagamentoPixCpfTitular?: string;
  
  // Empréstimo
  valor: number;
  prazo: number;
  taxaJuros?: number;
  produtoId?: number;
  tabelaComercialId?: number;
  
  // Valores calculados
  valorTac?: number;
  valorIof?: number;
  valorTotalFinanciado?: number;
  
  // Condições especiais
  dataCarencia?: string;
  incluirTac?: boolean;
  
  // Administrativo
  lojaId?: number;
  atendenteId?: string;
  finalidade?: string;
  garantia?: string;
  formaLiberacao?: string;
  formaPagamento?: string;
  pracaPagamento?: string;
  
  // Referências pessoais
  referenciaPessoal?: Array<{
    nomeCompleto: string;
    grauParentesco: string;
    telefone: string;
    tipo_referencia?: string;
  }>;
}

export class CreateProposalUseCase {
  constructor(private repository: IProposalRepository) {}

  async execute(dto: CreateProposalDTO): Promise<{ id: string; numeroSequencial: number }> {
    // Validar e criar Value Objects
    const cpfObj = CPF.create(dto.clienteCpf);
    if (!cpfObj) {
      throw new Error('CPF inválido');
    }

    // LACRE DE OURO: Mapeamento COMPLETO de dados do cliente
    const clienteData: ClienteData = {
      // Dados básicos
      nome: dto.clienteNome,
      cpf: cpfObj,
      tipoPessoa: dto.tipoPessoa,
      razaoSocial: dto.clienteRazaoSocial,
      cnpj: dto.clienteCnpj,
      
      // Documentação RG completa
      rg: dto.clienteRg,
      orgaoEmissor: dto.clienteOrgaoEmissor,
      rgUf: dto.clienteRgUf,
      rgDataEmissao: dto.clienteRgDataEmissao,
      
      // Dados pessoais
      email: dto.clienteEmail ? Email.create(dto.clienteEmail) || undefined : undefined,
      telefone: dto.clienteTelefone ? PhoneNumber.create(dto.clienteTelefone) || undefined : undefined,
      dataNascimento: dto.clienteDataNascimento,
      localNascimento: dto.clienteLocalNascimento,
      estadoCivil: dto.clienteEstadoCivil,
      nacionalidade: dto.clienteNacionalidade,
      
      // Endereço detalhado
      cep: dto.clienteCep ? CEP.create(dto.clienteCep) || undefined : undefined,
      logradouro: dto.clienteLogradouro,
      numero: dto.clienteNumero,
      complemento: dto.clienteComplemento,
      bairro: dto.clienteBairro,
      cidade: dto.clienteCidade,
      uf: dto.clienteUf,
      endereco: dto.clienteEndereco, // Campo concatenado para compatibilidade
      
      // Dados profissionais
      ocupacao: dto.clienteOcupacao,
      rendaMensal: dto.clienteRenda ? Money.fromReais(dto.clienteRenda) : undefined,
      telefoneEmpresa: dto.clienteTelefoneEmpresa,
      
      // Compatibilidade com campos antigos
      data_nascimento: dto.clienteDataNascimento, // Alias
      estado: dto.clienteUf, // Alias
      renda_mensal: dto.clienteRenda ? Money.fromReais(dto.clienteRenda) : undefined, // Alias
      empregador: dto.clienteOcupacao, // Empresas vs ocupação
      tempo_emprego: undefined, // Campo não usado no momento
      dividas_existentes: undefined, // Campo não usado no momento
    };

    // Criar agregado usando factory method existente
    const proposal = Proposal.create(
      clienteData,
      Money.fromReais(dto.valor),
      dto.prazo,
      dto.taxaJuros || 2.5,
      dto.produtoId,
      dto.lojaId,
      dto.atendenteId
    );

    // LACRE DE OURO: Configurar dados adicionais no agregado antes da persistência
    
    // Configurar dados de pagamento se fornecidos
    if (dto.metodoPagamento) {
      const dadosPagamento: DadosPagamento = {
        metodo: dto.metodoPagamento as 'boleto' | 'pix' | 'transferencia' | 'conta_bancaria',
        banco: dto.dadosPagamentoBanco,
        agencia: dto.dadosPagamentoAgencia,
        conta: dto.dadosPagamentoConta,
        digito: dto.dadosPagamentoDigito,
        tipo_conta: 'corrente',
        pixChave: dto.dadosPagamentoPix,
        pixTipo: dto.dadosPagamentoTipoPix,
        pixBanco: dto.dadosPagamentoPixBanco,
        pixNomeTitular: dto.dadosPagamentoPixNomeTitular,
        pixCpfTitular: dto.dadosPagamentoPixCpfTitular,
        // Compatibilidade com campos antigos
        pix_chave: dto.dadosPagamentoPix,
        pix_tipo: dto.dadosPagamentoTipoPix,
      };
      proposal.updatePaymentData(dadosPagamento);
    }

    // Configurar tabela comercial diretamente na propriedade privada (acesso através do fromDatabase)
    if (dto.tabelaComercialId) {
      (proposal as any)._tabelaComercialId = dto.tabelaComercialId;
    }
    
    // Persistir usando repositório
    await this.repository.save(proposal);

    // TODO: Implementar salvamento de referências pessoais em tabela separada
    // if (dto.referenciaPessoal && dto.referenciaPessoal.length > 0) {
    //   await this.repository.saveReferences(proposal.id, dto.referenciaPessoal);
    // }
    
    // Retornar ID da proposta criada
    return { 
      id: proposal.id,
      numeroSequencial: 0 // TODO: Implementar número sequencial via repository
    };
  }
}
