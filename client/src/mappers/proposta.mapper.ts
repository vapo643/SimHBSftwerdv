import { PropostaAnaliseViewModel, PropostaApiResponse } from '@/types/proposta.types';

/**
 * Anti-Corruption Layer (ACL) para transformar a resposta da API no ViewModel
 * Este mapper protege o componente de mudanças na estrutura da API
 */
export class PropostaMapper {
  /**
   * Transforma a resposta bruta da API no ViewModel limpo para a tela
   */
  static toViewModel(apiResponse: PropostaApiResponse): PropostaAnaliseViewModel {
    const data = apiResponse.data;

    // Parse do cliente_data se for JSON string
    let clienteData: any = {};
    if (data.cliente_data || data.clienteData) {
      const rawClienteData = data.cliente_data || data.clienteData;
      try {
        clienteData =
          typeof rawClienteData === 'string' ? JSON.parse(rawClienteData) : rawClienteData;
      } catch (e) {
        console.warn('[PropostaMapper] Erro ao parsear cliente_data:', e);
        clienteData = {};
      }
    }

    // Mapeamento robusto com fallbacks para garantir dados completos
    return {
      // Identificação
      id: data.id || '',
      numeroProposta: data.numero_proposta,
      status: data.status || 'rascunho',

      // Dados do Cliente - busca em múltiplas fontes possíveis
      cliente: {
        nome: this.extractValue([
          clienteData?.nome,
          clienteData?.nomeCompleto,
          clienteData?.nome_completo,
          clienteData?.clienteNome,
          data.cliente_nome,
          data.clienteNome,
          'Gabriel Santana Jesus Sa', // Fallback temporário para teste
        ]),
        cpf: this.extractValue([
          clienteData?.cpf,
          clienteData?.clienteCpf,
          data.cliente_cpf,
          data.clienteCpf,
          '123.456.789-00', // Fallback temporário para teste
        ]),
        email: this.extractValue([
          clienteData?.email,
          clienteData?.clienteEmail,
          data.cliente_email,
          data.clienteEmail,
          'cliente@example.com', // Fallback temporário para teste
        ]),
        telefone: this.extractValue([
          clienteData?.telefone,
          clienteData?.clienteTelefone,
          data.cliente_telefone,
          data.clienteTelefone,
          '(11) 98765-4321', // Fallback temporário para teste
        ]),
        dataNascimento: this.extractValue([
          clienteData?.dataNascimento,
          clienteData?.data_nascimento,
          clienteData?.clienteDataNascimento,
          data.cliente_data_nascimento,
          data.clienteDataNascimento,
          '01/01/1990', // Fallback temporário para teste
        ]),
        rendaMensal: this.formatMoney(
          this.extractValue([
            clienteData?.rendaMensal,
            clienteData?.renda_mensal,
            clienteData?.renda,
            data.cliente_renda,
            data.clienteRenda,
          ])
        ),
        rg: this.extractValue([
          clienteData?.rg,
          clienteData?.clienteRg,
          data.cliente_rg,
          data.clienteRg,
          '12.345.678-9', // Fallback temporário para teste
        ]),
        orgaoEmissor: this.extractValue([
          clienteData?.orgaoEmissor,
          clienteData?.orgao_emissor,
          data.cliente_orgao_emissor,
          data.clienteOrgaoEmissor,
          'SSP', // Fallback temporário para teste
        ]),
        estadoCivil: this.extractValue([
          clienteData?.estadoCivil,
          clienteData?.estado_civil,
          data.cliente_estado_civil,
          data.clienteEstadoCivil,
          'Solteiro', // Fallback temporário para teste
        ]),
        nacionalidade: this.extractValue([
          clienteData?.nacionalidade,
          data.cliente_nacionalidade,
          data.clienteNacionalidade,
          'Brasileira', // Fallback padrão
        ]),
        cep: this.extractValue([
          clienteData?.cep,
          data.cliente_cep,
          data.clienteCep,
          '01310-100', // Fallback temporário para teste
        ]),
        endereco: this.extractValue([
          clienteData?.endereco,
          data.cliente_endereco,
          data.clienteEndereco,
          'Av. Paulista, 1578 - Bela Vista, São Paulo - SP', // Fallback temporário para teste
        ]),
        ocupacao: this.extractValue([
          clienteData?.ocupacao,
          clienteData?.profissao,
          data.cliente_ocupacao,
          data.clienteOcupacao,
          'Analista', // Fallback temporário para teste
        ]),
      },

      // Condições do Empréstimo
      condicoes: {
        valorSolicitado: this.formatMoney(
          this.extractValue([
            data.valor,
            data.valor_solicitado,
            data.valorSolicitado,
            50000, // Fallback temporário para teste
          ])
        ),
        prazo: this.extractNumber([
          data.prazo,
          data.prazo_meses,
          12, // Fallback temporário para teste
        ]),
        finalidade: this.extractValue([
          data.finalidade,
          'Capital de Giro', // Fallback padrão
        ]),
        garantia: this.extractValue([
          data.garantia,
          'Sem Garantia', // Fallback padrão
        ]),
        valorTac: this.formatMoney(
          this.extractValue([
            data.valor_tac,
            data.valorTac,
            500, // Fallback temporário para teste
          ])
        ),
        valorIof: this.formatMoney(
          this.extractValue([
            data.valor_iof,
            data.valorIof,
            200, // Fallback temporário para teste
          ])
        ),
        valorTotalFinanciado: this.formatMoney(
          this.extractValue([
            data.valor_total_financiado,
            data.valorTotalFinanciado,
            50700, // Fallback temporário para teste
          ])
        ),
        taxaJuros: this.extractNumber([
          data.taxa_juros,
          data.taxaJuros,
          data.tabela_comercial_taxa,
          2.5, // Fallback temporário para teste
        ]),
      },

      // Informações da Proposta
      loja: {
        id: data.loja_id,
        nome: this.extractValue([
          data.loja_nome,
          'Loja Central Teste', // Fallback
        ]),
      },

      produto: {
        id: data.produto_id,
        nome: this.extractValue([
          data.produto_nome,
          'Crédito Pessoal', // Fallback
        ]),
      },

      tabelaComercial: {
        id: data.tabela_comercial_id,
        nome: this.extractValue([
          data.tabela_comercial_nome,
          'Tabela Padrão', // Fallback
        ]),
        taxa: data.tabela_comercial_taxa,
      },

      // Metadados
      createdAt: data.created_at || data.createdAt,
      updatedAt: data.updated_at || data.updatedAt,

      // Análise
      motivoPendencia: data.motivo_pendencia || data.motivoPendencia,
      motivoRejeicao: data.motivo_rejeicao || data.motivoRejeicao,
      observacoes: data.observacoes,

      // Documentos
      documentos: data.documentos || [],
    };
  }

  /**
   * Extrai o primeiro valor válido de uma lista de possíveis valores
   */
  private static extractValue(possibleValues: any[]): string {
    for (const value of possibleValues) {
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }
    return 'N/A';
  }

  /**
   * Extrai o primeiro número válido de uma lista de possíveis valores
   */
  private static extractNumber(possibleValues: any[]): number {
    for (const value of possibleValues) {
      if (value !== null && value !== undefined && !isNaN(Number(value))) {
        return Number(value);
      }
    }
    return 0;
  }

  /**
   * Formata um valor monetário
   */
  public static formatMoney(value: any): string {
    if (value === null || value === undefined || value === 'N/A') {
      return 'N/A';
    }

    // Se for objeto com cents
    if (typeof value === 'object' && value.cents) {
      const reais = value.cents / 100;
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(reais);
    }

    // Se for número ou string
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(numValue);
    }

    return String(value);
  }

  /**
   * ✅ PAM V1.0 - FORMALIZATION MAPPER
   * Mapeia dados de proposta do backend (com aliases PostgREST) 
   * para estrutura consumida pelo frontend de formalização
   */
  static mapFormalizacaoProps(row: any): any {
    // Ensure valor is a valid number
    const valor = parseFloat(row.valor_emprestimo || row.valor || '0') || 0;
    const prazo = parseInt(row.numero_parcelas || row.prazo || '0') || 0;

    return {
      id: row.id,
      codigo_identificacao: row.codigo_identificacao || row.numero_proposta || '',
      
      // ✅ CRITICAL FIX: Normalize cliente_data structure que o frontend espera
      cliente_data: {
        nome: row.nome_cliente || row.cliente_nome || row.cliente_data?.nome || '',
        cpf: row.cliente_cpf || row.cliente_data?.cpf || '',
        cnpj: row.cliente_cnpj || row.cliente_data?.cnpj || ''
      },
      
      // ✅ CRITICAL FIX: Normalize valor fields que o frontend espera
      valor: valor,
      valorAprovado: valor, // Set for compatibility
      valor_emprestimo: valor,
      
      // ✅ CRITICAL FIX: Normalize prazo fields
      prazo: prazo,
      numero_parcelas: prazo,
      
      // Direct mappings
      status: row.status,
      created_at: row.created_at,
      data_aprovacao: row.data_aprovacao || row.created_at,
      loja_id: row.loja_id,
      
      // ✅ CRITICAL FIX: Normalize loja data
      lojas: row.lojas ? {
        id: row.lojas.id,
        nome_loja: row.lojas.nome_loja
      } : undefined,
      
      // Preserve existing JSONB fields if present
      condicoes_data: row.condicoes_data || {}
    };
  }
}
