import { createServerSupabaseAdminClient } from '../lib/supabase';
import { getBrasiliaDate, formatBrazilianDate } from '../lib/timezone';
import fs from 'fs';
import path from 'path';

interface ClientData {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  rg?: string;
  orgaoEmissor?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  cep?: string;
  endereco?: string;
  ocupacao?: string;
  rendaMensal?: number;
  localNascimento?: string;
}

interface CondicoesData {
  valor: number;
  prazo: number;
  finalidade?: string;
  valorTac?: number;
  valorIof?: number;
  valorTotalFinanciado?: number;
  parcela?: number;
  taxaJuros?: number;
  taxaJurosAnual?: number;
  cet?: number;
  dataVencimentoPrimeira?: string;
  dataVencimentoUltima?: string;
}

export async function generateCCBFromTemplate(propostaId: string, templatePath: string): Promise<string> {
  try {
    console.log(`🎯 [Template CCB] Iniciando geração com template para proposta ${propostaId}`);
    
    // Verificar se template existe
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template PDF não encontrado em: ${templatePath}`);
    }
    
    const supabase = createServerSupabaseAdminClient();
    
    // Buscar dados da proposta
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select(`
        *,
        lojas (
          id,
          nome_loja,
          parceiros (
            id,
            razao_social,
            cnpj
          )
        )
      `)
      .eq('id', propostaId)
      .single();
    
    if (propostaError || !proposta) {
      throw new Error(`Proposta ${propostaId} não encontrada`);
    }
    
    const clienteData = proposta.cliente_data as ClientData;
    const condicoesData = proposta.condicoes_data as CondicoesData;
    
    // Preparar campos para preenchimento
    const ccbFields = prepareCCBFields(propostaId, clienteData, condicoesData);
    
    // TODO: Implementar preenchimento real do PDF quando template for fornecido
    // Por enquanto, usar gerador atual como fallback
    const { generateCCB } = await import('./ccbGenerator');
    return await generateCCB(propostaId);
    
  } catch (error) {
    console.error('❌ [Template CCB] Erro:', error);
    throw error;
  }
}

function prepareCCBFields(propostaId: string, clienteData: ClientData, condicoesData: CondicoesData): CCBFields {
  const hoje = getBrasiliaDate();
  
  return {
    // Cabeçalho
    cedulaNumero: propostaId,
    dataEmissao: formatBrazilianDate(hoje),
    finalidade: 'Empréstimo Pessoal',
    
    // Emitente (Cliente)
    emitenteNome: clienteData.nome || '',
    emitenteCpf: clienteData.cpf || '',
    emitenteRg: clienteData.rg || '',
    emitenteOrgaoEmissor: clienteData.orgaoEmissor || '',
    emitenteEstadoCivil: clienteData.estadoCivil || '',
    emitenteNacionalidade: clienteData.nacionalidade || 'Brasileiro',
    emitenteEndereco: clienteData.endereco || '',
    emitenteCep: clienteData.cep || '',
    
    // Credor (Sempre SIMPIX)
    credorRazaoSocial: 'SIMPIX - Seu crédito rápido',
    credorCnpj: '', // Será preenchido quando tiver o CNPJ
    credorEndereco: '', // Endereço da Simpix
    credorCep: '', // CEP da Simpix
    
    // Condições
    valorPrincipal: `R$ ${(condicoesData.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    prazoAmortizacao: `${condicoesData.prazo || 0} mês(es)`,
    taxaJuros: `${(condicoesData.taxaJuros || 0).toFixed(2)}%`,
    taxaJurosAnual: `${(condicoesData.taxaJurosAnual || 0).toFixed(2)}%`,
    valorIof: `R$ ${(condicoesData.valorIof || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    valorTac: `R$ ${(condicoesData.valorTac || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    valorLiquido: `R$ ${((condicoesData.valor || 0) - (condicoesData.valorTac || 0) - (condicoesData.valorIof || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    cet: `${(condicoesData.cet || 0).toFixed(2)}%`,
    
    // Datas de vencimento
    vencimentoPrimeira: condicoesData.dataVencimentoPrimeira || '01/01/0001',
    vencimentoUltima: condicoesData.dataVencimentoUltima || '01/01/0001',
    
    // Fluxo de pagamento (parcelas)
    parcelas: generateParcelas(condicoesData.prazo || 12, condicoesData.parcela || 0)
  };
}

function generateParcelas(numeroParcelas: number, valorParcela: number) {
  const parcelas = [];
  for (let i = 1; i <= numeroParcelas; i++) {
    parcelas.push({
      numero: i,
      vencimento: '', // Será calculado baseado na data de aprovação + meses
      valor: `R$ ${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    });
  }
  
  return parcelas;
}

// Campos que precisarão ser preenchidos no template:
interface CCBFields {
  // Cabeçalho
  cedulaNumero: string;
  dataEmissao: string;
  finalidade: string;
  
  // Emitente (Cliente)
  emitenteNome: string;
  emitenteCpf: string;
  emitenteRg: string;
  emitenteOrgaoEmissor: string;
  emitenteEstadoCivil: string;
  emitenteNacionalidade: string;
  emitenteEndereco: string;
  emitenteCep: string;
  
  // Credor (Sempre SIMPIX)
  credorRazaoSocial: string; // "SIMPIX - Seu crédito rápido"
  credorCnpj: string;
  credorEndereco: string;
  credorCep: string;
  
  // Condições
  valorPrincipal: string;
  prazoAmortizacao: string;
  taxaJuros: string;
  taxaJurosAnual: string;
  valorIof: string;
  valorTac: string;
  valorLiquido: string;
  cet: string;
  
  // Datas de vencimento
  vencimentoPrimeira: string;
  vencimentoUltima: string;
  
  // Fluxo de pagamento (parcelas)
  parcelas: Array<{
    numero: number;
    vencimento: string;
    valor: string;
  }>;
}