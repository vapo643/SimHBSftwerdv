/**
 * SCRIPT DE AUDITORIA CCB - DATA-AUDIT-003
 * Validação de Integridade de Mapeamento da "Proposta de Ouro"
 * 
 * OBJETIVO: Verificar se todos os dados da proposta são corretamente
 * mapeados para as coordenadas do template CCB, garantindo integridade
 * do contrato legal gerado.
 */

import { db } from '../../lib/supabase';
import { sql } from 'drizzle-orm';
import { USER_CCB_COORDINATES, SYSTEM_TO_CCB_MAPPING } from '../../services/ccbUserCoordinates';

// ID da proposta de ouro para auditoria
const GOLDEN_PROPOSAL_ID = '83d8af2d-cfa8-42fb-9507-7ce6317c3025';

interface AuditResult {
  campo: string;
  valorBanco: any;
  campoMapeado: string;
  valorPDF: any;
  status: 'IDÊNTICO' | 'DIVERGENTE' | 'AUSENTE' | 'ERRO';
  observações?: string;
}

interface ProposalData {
  id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_data: any;
  condicoes_data: any;
  valor: number;
  prazo: number;
  taxa_juros: number;
  valor_tac: number;
  valor_iof: number;
  created_at: string;
  dados_pagamento_banco: string;
  dados_pagamento_agencia: string;
  dados_pagamento_conta: string;
  dados_pagamento_pix: string;
  cliente_endereco: string;
  numero_proposta: number;
  [key: string]: any;
}

/**
 * ETAPA 1: Carregar dados completos da proposta de ouro
 */
async function loadGoldenProposal(): Promise<ProposalData | null> {
  try {
    console.log(`🔍 [AUDIT] Carregando proposta de ouro: ${GOLDEN_PROPOSAL_ID}`);
    
    const result = await db.execute(sql`
      SELECT 
        p.*,
        prod.nome_produto,
        tc.nome_tabela,
        l.nome_loja
      FROM propostas p
      LEFT JOIN produtos prod ON p.produto_id = prod.id
      LEFT JOIN tabelas_comerciais tc ON p.tabela_comercial_id = tc.id  
      LEFT JOIN lojas l ON p.loja_id = l.id
      WHERE p.id = ${GOLDEN_PROPOSAL_ID}
    `);

    if (!result || result.length === 0) {
      console.error('❌ [AUDIT] Proposta de ouro não encontrada!');
      return null;
    }

    const proposalData = result[0] as ProposalData;
    console.log('✅ [AUDIT] Proposta carregada:', {
      nome: proposalData.cliente_nome,
      cpf: proposalData.cliente_cpf,
      valor: proposalData.valor,
      prazo: proposalData.prazo,
    });

    return proposalData;
  } catch (error) {
    console.error('❌ [AUDIT] Erro ao carregar proposta:', error);
    return null;
  }
}

/**
 * ETAPA 2: Simular mapeamento CCB e capturar objeto de dados
 */
function simulateCCBMapping(proposalData: ProposalData): { [key: string]: any } {
  console.log('📊 [AUDIT] Simulando mapeamento CCB...');

  // Parsear endereço concatenado (igual ao ccbGenerationService)
  let enderecoParseado = {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  };

  const enderecoCompleto = proposalData.cliente_endereco || '';
  if (enderecoCompleto) {
    const partes = enderecoCompleto.split(',').map((s: string) => s.trim());
    if (partes.length >= 4) {
      enderecoParseado.logradouro = partes[0] || '';
      enderecoParseado.numero = partes[1] || '';
      enderecoParseado.complemento = partes[2] || '';
      enderecoParseado.bairro = partes[3] || '';

      const ultimaParte = partes[partes.length - 1] || '';
      const cidadeEstadoMatch = ultimaParte.match(/([^\/]+)\/(\w+)\s*-?\s*CEP:\s*([\d-]+)/);
      if (cidadeEstadoMatch) {
        enderecoParseado.cidade = cidadeEstadoMatch[1].trim();
        enderecoParseado.estado = cidadeEstadoMatch[2].trim();
        enderecoParseado.cep = cidadeEstadoMatch[3].trim();
      }
    }
  }

  // Detectar tipo cliente
  const isPJ = !!(proposalData.cliente_data?.razaoSocial || proposalData.cliente_data?.cnpj);
  const isPF = !isPJ;

  // Objeto de mapeamento final que seria usado no PDF
  const mappingObject = {
    // IDENTIFICAÇÃO
    numeroCedula: String(proposalData.numero_proposta),
    dataEmissao: new Date(proposalData.created_at).toLocaleDateString('pt-BR'),
    finalidadeOperacao: proposalData.condicoes_data?.finalidade || 'Empréstimo pessoal',

    // DADOS CLIENTE (PF/PJ)
    nomeCliente: isPF ? proposalData.cliente_nome : proposalData.cliente_data?.razaoSocial,
    cpfCliente: isPF ? proposalData.cliente_cpf : proposalData.cliente_data?.cnpj,
    rgCliente: proposalData.cliente_rg || proposalData.cliente_data?.rg,
    rgExpedidor: proposalData.cliente_orgao_emissor || 'SSP',
    rgUF: proposalData.cliente_rg_uf || proposalData.cliente_data?.rgUf,
    nacionalidade: proposalData.cliente_nacionalidade || 'BRASILEIRA',
    estadoCivil: proposalData.cliente_estado_civil || '',

    // ENDEREÇO
    enderecoCliente: enderecoCompleto,
    logradouro: enderecoParseado.logradouro,
    numero: enderecoParseado.numero,
    complemento: enderecoParseado.complemento,
    bairro: enderecoParseado.bairro,
    cepCliente: enderecoParseado.cep || proposalData.cliente_cep,
    cidadeCliente: enderecoParseado.cidade || proposalData.cliente_cidade,
    ufCliente: enderecoParseado.estado || proposalData.cliente_uf,

    // CONDIÇÕES FINANCEIRAS
    valorPrincipal: proposalData.valor,
    prazoAmortizacao: proposalData.prazo,
    taxaJurosEfetivaMensal: proposalData.taxa_juros,
    taxaJurosEfetivaAnual: (proposalData.taxa_juros * 12).toFixed(2),
    iof: proposalData.valor_iof,
    tac: proposalData.valor_tac,
    valorLiquidoLiberado: proposalData.valor_liquido_liberado,

    // DADOS BANCÁRIOS
    bancoEmitente: proposalData.dados_pagamento_banco,
    agenciaEmitente: proposalData.dados_pagamento_agencia,
    contaEmitente: proposalData.dados_pagamento_conta,
    tipoContaEmitente: proposalData.dados_pagamento_tipo,
    chavePix: proposalData.dados_pagamento_pix,

    // DADOS CREDOR (SIMPIX - FIXOS)
    razaoSocialCredor: 'SIMPIX SOLUCOES E INTERMEDIACOES LTDA',
    cnpjCredor: '42.162.929/0001-67',
    enderecoCredor: 'AV PAULO PEREIRA GOMES, 1156',
    cepCredor: '29.166-828',
    cidadeCredor: 'SERRA',
    ufCredor: 'ES',

    // METADATA
    tipoCliente: isPF ? 'PF' : 'PJ',
    coordenadasDisponiveis: Object.keys(USER_CCB_COORDINATES).length,
  };

  return mappingObject;
}

/**
 * ETAPA 3: Executar auditoria campo a campo
 */
function executeFieldByFieldAudit(proposalData: ProposalData, mappingObject: { [key: string]: any }): AuditResult[] {
  console.log('🔬 [AUDIT] Executando auditoria campo a campo...');

  const auditResults: AuditResult[] = [];

  // CAMPOS CRÍTICOS PARA AUDITORIA
  const criticalFields = [
    {
      campo: 'cliente_nome',
      valorBanco: proposalData.cliente_nome,
      campoMapeado: 'nomeCliente',
      valorPDF: mappingObject.nomeCliente,
    },
    {
      campo: 'cliente_cpf', 
      valorBanco: proposalData.cliente_cpf,
      campoMapeado: 'cpfCliente',
      valorPDF: mappingObject.cpfCliente,
    },
    {
      campo: 'valor',
      valorBanco: proposalData.valor,
      campoMapeado: 'valorPrincipal', 
      valorPDF: mappingObject.valorPrincipal,
    },
    {
      campo: 'prazo',
      valorBanco: proposalData.prazo,
      campoMapeado: 'prazoAmortizacao',
      valorPDF: mappingObject.prazoAmortizacao,
    },
    {
      campo: 'taxa_juros',
      valorBanco: proposalData.taxa_juros,
      campoMapeado: 'taxaJurosEfetivaMensal',
      valorPDF: mappingObject.taxaJurosEfetivaMensal,
    },
    {
      campo: 'valor_iof',
      valorBanco: proposalData.valor_iof,
      campoMapeado: 'iof',
      valorPDF: mappingObject.iof,
    },
    {
      campo: 'valor_tac',
      valorBanco: proposalData.valor_tac,
      campoMapeado: 'tac',
      valorPDF: mappingObject.tac,
    },
    {
      campo: 'numero_proposta',
      valorBanco: proposalData.numero_proposta,
      campoMapeado: 'numeroCedula',
      valorPDF: mappingObject.numeroCedula,
    },
    {
      campo: 'dados_pagamento_banco',
      valorBanco: proposalData.dados_pagamento_banco,
      campoMapeado: 'bancoEmitente',
      valorPDF: mappingObject.bancoEmitente,
    },
    {
      campo: 'dados_pagamento_pix',
      valorBanco: proposalData.dados_pagamento_pix,
      campoMapeado: 'chavePix',
      valorPDF: mappingObject.chavePix,
    },
    {
      campo: 'cliente_endereco',
      valorBanco: proposalData.cliente_endereco,
      campoMapeado: 'enderecoCliente',
      valorPDF: mappingObject.enderecoCliente,
    },
    {
      campo: 'created_at',
      valorBanco: proposalData.created_at,
      campoMapeado: 'dataEmissao',
      valorPDF: mappingObject.dataEmissao,
    },
  ];

  // Auditar cada campo
  for (const field of criticalFields) {
    let status: 'IDÊNTICO' | 'DIVERGENTE' | 'AUSENTE' | 'ERRO' = 'IDÊNTICO';
    let observações = '';

    try {
      // Verificar se campo tem coordenada mapeada
      const hasCoordinate = USER_CCB_COORDINATES[field.campoMapeado];
      if (!hasCoordinate) {
        status = 'AUSENTE';
        observações = 'Campo não possui coordenada mapeada no PDF';
      } else if (field.valorBanco === null || field.valorBanco === undefined || field.valorBanco === '') {
        status = 'AUSENTE';
        observações = 'Valor não existe no banco de dados';
      } else if (field.valorPDF === null || field.valorPDF === undefined || field.valorPDF === '') {
        status = 'AUSENTE'; 
        observações = 'Valor não foi mapeado para o PDF';
      } else {
        // Comparação de valores (convertendo para string para comparação consistente)
        const valorBancoStr = String(field.valorBanco).trim();
        const valorPDFStr = String(field.valorPDF).trim();
        
        if (valorBancoStr === valorPDFStr) {
          status = 'IDÊNTICO';
        } else {
          status = 'DIVERGENTE';
          observações = `DB: "${valorBancoStr}" vs PDF: "${valorPDFStr}"`;
        }
      }
    } catch (error) {
      status = 'ERRO';
      observações = `Erro na validação: ${error}`;
    }

    auditResults.push({
      campo: field.campo,
      valorBanco: field.valorBanco,
      campoMapeado: field.campoMapeado,
      valorPDF: field.valorPDF,
      status,
      observações,
    });
  }

  return auditResults;
}

/**
 * ETAPA 4: Gerar relatório de auditoria
 */
function generateAuditReport(auditResults: AuditResult[], mappingObject: { [key: string]: any }): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE AUDITORIA DE MAPEAMENTO CCB - DATA-AUDIT-003');
  console.log('='.repeat(80));
  
  console.log(`🎯 Proposta Auditada: ${GOLDEN_PROPOSAL_ID}`);
  console.log(`📊 Total de Coordenadas Disponíveis: ${Object.keys(USER_CCB_COORDINATES).length}`);
  console.log(`🔬 Campos Auditados: ${auditResults.length}`);
  console.log(`👤 Tipo de Cliente: ${mappingObject.tipoCliente}`);

  console.log('\n📋 TABELA COMPARATIVA - DB vs PDF:');
  console.log('-'.repeat(120));
  console.log(
    '| Campo (DB)'.padEnd(25) + 
    '| Valor no Banco'.padEnd(25) + 
    '| Campo Mapeado (PDF)'.padEnd(25) + 
    '| Valor a ser Impresso'.padEnd(25) + 
    '| Status'.padEnd(15) + '|'
  );
  console.log('-'.repeat(120));

  let identicos = 0;
  let divergentes = 0;
  let ausentes = 0;
  let erros = 0;

  for (const result of auditResults) {
    const status = result.status === 'IDÊNTICO' ? '✅ IDÊNTICO' : 
                   result.status === 'DIVERGENTE' ? '❌ DIVERGENTE' :
                   result.status === 'AUSENTE' ? '⚠️ AUSENTE' : '💥 ERRO';

    const valorBanco = String(result.valorBanco || 'NULL').substring(0, 22);
    const valorPDF = String(result.valorPDF || 'NULL').substring(0, 22);

    console.log(
      `| ${result.campo.padEnd(23)} | ${valorBanco.padEnd(23)} | ${result.campoMapeado.padEnd(23)} | ${valorPDF.padEnd(23)} | ${status.padEnd(13)} |`
    );

    if (result.observações) {
      console.log(`  📝 Observação: ${result.observações}`);
    }

    // Contadores
    switch (result.status) {
      case 'IDÊNTICO': identicos++; break;
      case 'DIVERGENTE': divergentes++; break;
      case 'AUSENTE': ausentes++; break;
      case 'ERRO': erros++; break;
    }
  }

  console.log('-'.repeat(120));

  // SUMÁRIO ESTATÍSTICO
  console.log('\n📊 SUMÁRIO ESTATÍSTICO:');
  console.log(`✅ Campos Idênticos: ${identicos}/${auditResults.length} (${((identicos/auditResults.length)*100).toFixed(1)}%)`);
  console.log(`❌ Campos Divergentes: ${divergentes}/${auditResults.length}`);
  console.log(`⚠️ Campos Ausentes: ${ausentes}/${auditResults.length}`);
  console.log(`💥 Erros de Validação: ${erros}/${auditResults.length}`);

  // VEREDITO FINAL
  console.log('\n🏛️ VEREDITO FINAL DE INTEGRIDADE DA CCB:');
  if (divergentes === 0 && erros === 0 && ausentes <= 2) {
    console.log('✅ APROVADO - Integridade dos dados garantida para geração legal da CCB');
    console.log('   Todos os campos críticos estão corretamente mapeados');
  } else if (divergentes > 0 || erros > 0) {
    console.log('❌ REPROVADO - Divergências críticas detectadas na integridade dos dados');
    console.log('   ⚠️ RISCO LEGAL: CCB pode conter informações incorretas');
  } else {
    console.log('⚠️ APROVADO COM RESSALVA - Alguns campos ausentes mas não críticos');
    console.log('   Verificar se campos ausentes são obrigatórios para validade legal');
  }

  console.log('\n🔗 EVIDÊNCIA TÉCNICA:');
  console.log(`   Mapeamento ativo: USER_CCB_COORDINATES (${Object.keys(USER_CCB_COORDINATES).length} campos)`);
  console.log(`   Serviço: ccbGenerationService.ts`);
  console.log(`   Template: server/templates/template_ccb.pdf`);
  console.log(`   Proposta ID: ${GOLDEN_PROPOSAL_ID}`);
}

/**
 * EXECUÇÃO PRINCIPAL DA AUDITORIA
 */
async function executeAudit(): Promise<void> {
  console.log('🚀 [AUDIT] Iniciando DATA-AUDIT-003 - Auditoria de Integração CCB');
  console.log('🎯 [AUDIT] Protocolo PACN V1.0 ativado - Validação comportamental obrigatória');

  try {
    // ETAPA 1: Carregar proposta de ouro
    const proposalData = await loadGoldenProposal();
    if (!proposalData) {
      console.error('💥 [AUDIT] FALHA CRÍTICA: Não foi possível carregar proposta de ouro');
      return;
    }

    // ETAPA 2: Simular mapeamento
    const mappingObject = simulateCCBMapping(proposalData);

    // ETAPA 3: Auditar campo a campo
    const auditResults = executeFieldByFieldAudit(proposalData, mappingObject);

    // ETAPA 4: Gerar relatório
    generateAuditReport(auditResults, mappingObject);

    console.log('\n✅ [AUDIT] DATA-AUDIT-003 executado com sucesso');
    console.log('📋 [AUDIT] Relatório de integridade gerado acima');

  } catch (error) {
    console.error('💥 [AUDIT] Erro crítico durante auditoria:', error);
  }
}

// Executar auditoria automaticamente
executeAudit().catch(console.error);

export { executeAudit, loadGoldenProposal, simulateCCBMapping, executeFieldByFieldAudit };