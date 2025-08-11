/**
 * MAPEAMENTO DE COORDENADAS MANUAIS DO USUÁRIO
 * Alinhado com os campos disponíveis no sistema
 * Baseado no documento anexado com coordenadas precisas
 */

export interface CCBCoordinate {
  x: number;
  y: number;
  fontSize: number;
  maxWidth?: number;
  page?: number;
}

export interface CCBUserMapping {
  [key: string]: CCBCoordinate;
}

/**
 * MAPEAMENTO COMPLETO: Campos do Sistema → Coordenadas do Usuário
 * Todos os campos que o sistema possui alinhados com as coordenadas manuais
 */
export const USER_CCB_COORDINATES: CCBUserMapping = {
  // ==========================================
  // PÁGINA 1 - IDENTIFICAÇÃO DA CCB
  // ==========================================

  // 🆔 IDENTIFICAÇÃO DA CCB (Y:735)
  numeroCedula: { x: 55, y: 735, fontSize: 11, page: 1 }, // ID da proposta formatado
  dataEmissao: { x: 255, y: 735, fontSize: 11, page: 1 }, // created_at ou ccb_gerado_em
  finalidadeOperacao: { x: 405, y: 735, fontSize: 11, page: 1 }, // condicoes_data.finalidade

  // 👤 DADOS DO EMITENTE/CLIENTE
  nomeCliente: { x: 55, y: 645, fontSize: 11, page: 1 }, // cliente_data.nome
  cpfCliente: { x: 405, y: 645, fontSize: 11, page: 1 }, // cliente_data.cpf
  rgCliente: { x: 50, y: 620, fontSize: 11, page: 1 }, // cliente_data.rg
  rgExpedidor: { x: 108, y: 620, fontSize: 9, page: 1 }, // cliente_data.orgaoEmissor
  rgUF: { x: 164, y: 620, fontSize: 9, page: 1 }, // Estado do órgão emissor
  rgEmissao: { x: 210, y: 620, fontSize: 8, page: 1 }, // Data emissão RG (se disponível)
  nacionalidade: { x: 270, y: 620, fontSize: 9, page: 1 }, // cliente_data.nacionalidade
  localNascimento: { x: 405, y: 620, fontSize: 10, page: 1 }, // cliente_data.cidade (nascimento)
  estadoCivil: { x: 90, y: 570, fontSize: 11, page: 1 }, // Estado Civil: X:90, Y:570, size:11

  // ENDEREÇO DO CLIENTE - TROCADO PARA Y:595
  enderecoCliente: { x: 55, y: 595, fontSize: 9, page: 1 }, // Endereço completo trocado para Y:595
  cepCliente: { x: 270, y: 570, fontSize: 9, page: 1 }, // CEP  
  cidadeCliente: { x: 380, y: 570, fontSize: 9, page: 1 }, // Cidade
  ufCliente: { x: 533, y: 570, fontSize: 9, page: 1 }, // UF

  // 🏢 DADOS DO CREDOR (EMPRESA)
  razaoSocialCredor: { x: 55, y: 465, fontSize: 10, page: 1 }, // loja_nome ou "SIMPIX LTDA"
  cnpjCredor: { x: 445, y: 465, fontSize: 9, page: 1 }, // CNPJ da loja
  enderecoCredor: { x: 50, y: 435, fontSize: 10, page: 1 }, // Endereço da loja
  cepCredor: { x: 175, y: 435, fontSize: 10, page: 1 }, // CEP da loja
  cidadeCredor: { x: 310, y: 435, fontSize: 10, page: 1 }, // Cidade da loja
  ufCredor: { x: 440, y: 435, fontSize: 10, page: 1 }, // UF da loja

  // 💰 CONDIÇÕES FINANCEIRAS (SEÇÃO III)
  valorPrincipal: { x: 50, y: 350, fontSize: 11, page: 1 }, // condicoes_data.valor
  dataEmissaoCond: { x: 180, y: 350, fontSize: 11, page: 1 }, // Data emissão (repetida)
  vencimentoParcela: { x: 300, y: 350, fontSize: 11, page: 1 }, // Primeiro vencimento
  vencimentoUltimaParcela: { x: 455, y: 344, fontSize: 9, page: 1 }, // Último vencimento calculado
  prazoAmortizacao: { x: 50, y: 300, fontSize: 11, page: 1 }, // condicoes_data.prazo
  percentualIndice: { x: 300, y: 300, fontSize: 10, page: 1 }, // Taxa ou índice

  // TAXAS E ENCARGOS
  taxaJurosEfetivaMensal: { x: 90, y: 245, fontSize: 10, page: 1 }, // 9. Taxa Juros Efetiva Mensal
  taxaJurosEfetivaAnual: { x: 230, y: 245, fontSize: 11, page: 1 }, // taxa_juros anual
  iof: { x: 300, y: 245, fontSize: 11, page: 1 }, // condicoes_data.valorIof
  pracaPagamento: { x: 490, y: 245, fontSize: 10, page: 1 }, // cidade_emissao

  // TARIFAS E CUSTOS
  tarifaTED: { x: 130, y: 180, fontSize: 8, page: 1 }, // Tarifa TED padrão
  tac: { x: 325, y: 220, fontSize: 10, page: 1 }, // condicoes_data.valorTac
  taxaCredito: { x: 400, y: 180, fontSize: 8, page: 1 }, // Taxa de crédito
  custoEfetivoTotal: { x: 460, y: 195, fontSize: 10, page: 1 }, // CET calculado
  dataLiberacaoRecurso: { x: 50, y: 150, fontSize: 10, page: 1 }, // Data liberação

  // VALORES LÍQUIDOS
  valorLiquidoLiberado: { x: 410, y: 166, fontSize: 9, page: 1 }, // 20. Valor líquido liberado
  valorLiquidoEmissor: { x: 475, y: 152, fontSize: 9, page: 1 }, // 20.a Valor Líquido Liberado ao Emissor

  // ==========================================
  // PÁGINA 2 - DADOS BANCÁRIOS E PARCELAS
  // ==========================================

  // 🏦 DADOS BANCÁRIOS PESSOA FÍSICA (Seção 22)
  bancoEmitente: { x: 170, y: 660, fontSize: 10, page: 2 }, // dados_pagamento_codigo_banco
  agenciaEmitente: { x: 290, y: 660, fontSize: 10, page: 2 }, // dados_pagamento_agencia
  contaEmitente: { x: 460, y: 675, fontSize: 7, page: 2 }, // Conta Nº
  tipoContaEmitente: { x: 482, y: 664, fontSize: 7, page: 2 }, // Tipo de Conta

  // DADOS BANCÁRIOS PESSOA JURÍDICA (Seções 23-24)
  razaoSocialEmitenteEmpresa: { x: 65, y: 630, fontSize: 10, page: 2 }, // cliente_data.razaoSocial
  cnpjEmitenteEmpresa: { x: 65, y: 610, fontSize: 10, page: 2 }, // cliente_data.cnpj
  bancoEmitenteEmpresa: { x: 170, y: 610, fontSize: 10, page: 2 }, // Banco PJ
  agenciaEmitenteEmpresa: { x: 290, y: 610, fontSize: 10, page: 2 }, // Agência PJ
  contaEmitenteEmpresa: { x: 460, y: 630, fontSize: 9, page: 2 }, // Conta PJ
  tipoContaEmitenteEmpresa: { x: 482, y: 617, fontSize: 9, page: 2 }, // Tipo conta PJ
  chavePix: { x: 110, y: 587, fontSize: 9, page: 2 }, // chave pix do pf ou pj - COORDENADAS ATUALIZADAS

  // 📅 FLUXO DE PAGAMENTO - PARCELAS (Página 2)
  // Parcela 1
  parcela1Numero: { x: 110, y: 460, fontSize: 10, page: 2 },
  parcela1Vencimento: { x: 270, y: 460, fontSize: 10, page: 2 },
  parcela1Valor: { x: 470, y: 460, fontSize: 10, page: 2 },

  // Parcela 2
  parcela2Numero: { x: 110, y: 440, fontSize: 10, page: 2 },
  parcela2Vencimento: { x: 270, y: 440, fontSize: 10, page: 2 },
  parcela2Valor: { x: 470, y: 440, fontSize: 10, page: 2 },

  // Parcela 3
  parcela3Numero: { x: 110, y: 420, fontSize: 10, page: 2 },
  parcela3Vencimento: { x: 270, y: 420, fontSize: 10, page: 2 },
  parcela3Valor: { x: 470, y: 420, fontSize: 10, page: 2 },

  // Parcela 4
  parcela4Numero: { x: 110, y: 400, fontSize: 10, page: 2 },
  parcela4Vencimento: { x: 270, y: 400, fontSize: 10, page: 2 },
  parcela4Valor: { x: 470, y: 400, fontSize: 10, page: 2 },

  // Parcela 5
  parcela5Numero: { x: 110, y: 380, fontSize: 10, page: 2 },
  parcela5Vencimento: { x: 270, y: 380, fontSize: 10, page: 2 },
  parcela5Valor: { x: 470, y: 380, fontSize: 10, page: 2 },

  // Parcela 6
  parcela6Numero: { x: 110, y: 360, fontSize: 10, page: 2 },
  parcela6Vencimento: { x: 270, y: 360, fontSize: 10, page: 2 },
  parcela6Valor: { x: 470, y: 360, fontSize: 10, page: 2 },

  // Parcela 7
  parcela7Numero: { x: 110, y: 340, fontSize: 10, page: 2 },
  parcela7Vencimento: { x: 270, y: 340, fontSize: 10, page: 2 },
  parcela7Valor: { x: 470, y: 340, fontSize: 10, page: 2 },

  // Parcela 8
  parcela8Numero: { x: 110, y: 320, fontSize: 10, page: 2 },
  parcela8Vencimento: { x: 270, y: 320, fontSize: 10, page: 2 },
  parcela8Valor: { x: 470, y: 320, fontSize: 10, page: 2 },

  // Parcela 9
  parcela9Numero: { x: 110, y: 300, fontSize: 10, page: 2 },
  parcela9Vencimento: { x: 270, y: 300, fontSize: 10, page: 2 },
  parcela9Valor: { x: 470, y: 300, fontSize: 10, page: 2 },

  // Parcela 10
  parcela10Numero: { x: 110, y: 280, fontSize: 10, page: 2 },
  parcela10Vencimento: { x: 270, y: 280, fontSize: 10, page: 2 },
  parcela10Valor: { x: 470, y: 280, fontSize: 10, page: 2 },

  // Parcela 11
  parcela11Numero: { x: 110, y: 260, fontSize: 10, page: 2 },
  parcela11Vencimento: { x: 270, y: 260, fontSize: 10, page: 2 },
  parcela11Valor: { x: 470, y: 260, fontSize: 10, page: 2 },

  // Parcela 12
  parcela12Numero: { x: 110, y: 240, fontSize: 10, page: 2 },
  parcela12Vencimento: { x: 270, y: 240, fontSize: 10, page: 2 },
  parcela12Valor: { x: 470, y: 240, fontSize: 10, page: 2 },

  // Parcela 13
  parcela13Numero: { x: 110, y: 220, fontSize: 10, page: 2 },
  parcela13Vencimento: { x: 270, y: 220, fontSize: 10, page: 2 },
  parcela13Valor: { x: 470, y: 220, fontSize: 10, page: 2 },

  // Parcela 14
  parcela14Numero: { x: 110, y: 200, fontSize: 10, page: 2 },
  parcela14Vencimento: { x: 270, y: 200, fontSize: 10, page: 2 },
  parcela14Valor: { x: 470, y: 200, fontSize: 10, page: 2 },

  // Parcela 15
  parcela15Numero: { x: 110, y: 180, fontSize: 10, page: 2 },
  parcela15Vencimento: { x: 270, y: 180, fontSize: 10, page: 2 },
  parcela15Valor: { x: 470, y: 180, fontSize: 10, page: 2 },

  // Parcela 16
  parcela16Numero: { x: 110, y: 160, fontSize: 10, page: 2 },
  parcela16Vencimento: { x: 270, y: 160, fontSize: 10, page: 2 },
  parcela16Valor: { x: 470, y: 160, fontSize: 10, page: 2 },

  // Parcela 17
  parcela17Numero: { x: 110, y: 140, fontSize: 10, page: 2 },
  parcela17Vencimento: { x: 270, y: 140, fontSize: 10, page: 2 },
  parcela17Valor: { x: 470, y: 140, fontSize: 10, page: 2 },

  // Parcela 18
  parcela18Numero: { x: 110, y: 120, fontSize: 10, page: 2 },
  parcela18Vencimento: { x: 270, y: 120, fontSize: 10, page: 2 },
  parcela18Valor: { x: 470, y: 120, fontSize: 10, page: 2 },

  // Parcela 19
  parcela19Numero: { x: 110, y: 100, fontSize: 10, page: 2 },
  parcela19Vencimento: { x: 270, y: 100, fontSize: 10, page: 2 },
  parcela19Valor: { x: 470, y: 100, fontSize: 10, page: 2 },

  // Parcela 20
  parcela20Numero: { x: 110, y: 80, fontSize: 10, page: 2 },
  parcela20Vencimento: { x: 270, y: 80, fontSize: 10, page: 2 },
  parcela20Valor: { x: 470, y: 80, fontSize: 10, page: 2 },

  // Parcela 21
  parcela21Numero: { x: 110, y: 60, fontSize: 10, page: 2 },
  parcela21Vencimento: { x: 270, y: 60, fontSize: 10, page: 2 },
  parcela21Valor: { x: 470, y: 60, fontSize: 10, page: 2 },

  // ==========================================
  // PÁGINA 3 - CONTINUAÇÃO PARCELAS
  // ==========================================

  // Parcela 22
  parcela22Numero: { x: 110, y: 770, fontSize: 10, page: 3 },
  parcela22Vencimento: { x: 270, y: 770, fontSize: 10, page: 3 },
  parcela22Valor: { x: 470, y: 770, fontSize: 10, page: 3 },

  // Parcela 23
  parcela23Numero: { x: 110, y: 750, fontSize: 10, page: 3 },
  parcela23Vencimento: { x: 270, y: 750, fontSize: 10, page: 3 },
  parcela23Valor: { x: 470, y: 750, fontSize: 10, page: 3 },

  // Parcela 24
  parcela24Numero: { x: 110, y: 730, fontSize: 10, page: 3 },
  parcela24Vencimento: { x: 270, y: 730, fontSize: 10, page: 3 },
  parcela24Valor: { x: 470, y: 730, fontSize: 10, page: 3 },
};

/**
 * Mapeamento de campos do sistema para coordenadas da CCB
 * Conecta os dados disponíveis no banco com as posições no PDF
 */
export const SYSTEM_TO_CCB_MAPPING = {
  // IDENTIFICAÇÃO
  "propostas.id": "numeroCedula",
  "propostas.created_at": "dataEmissao",
  "condicoes_data.finalidade": "finalidadeOperacao",

  // DADOS DO CLIENTE
  "cliente_data.nome": "nomeCliente",
  "cliente_data.cpf": "cpfCliente",
  "cliente_data.rg": "rgCliente",
  "cliente_data.orgaoEmissor": "rgExpedidor",
  "cliente_data.nacionalidade": "nacionalidade",
  "cliente_data.estadoCivil": "estadoCivil",
  "cliente_data.endereco": "enderecoCliente",
  "cliente_data.cep": "cepCliente",
  "cliente_data.cidade": "cidadeCliente",
  "cliente_data.estado": "ufCliente",

  // DADOS DO CREDOR
  loja_nome: "razaoSocialCredor",
  loja_cnpj: "cnpjCredor",

  // CONDIÇÕES FINANCEIRAS
  "condicoes_data.valor": "valorPrincipal",
  "condicoes_data.prazo": "prazoAmortizacao",
  "condicoes_data.taxa_juros": "taxaJurosEfetivaMensal",
  "condicoes_data.valorIof": "iof",
  "condicoes_data.valorTac": "tac",

  // DADOS BANCÁRIOS
  dados_pagamento_codigo_banco: "bancoEmitente",
  dados_pagamento_agencia: "agenciaEmitente",
  dados_pagamento_conta: "contaEmitente",
  dados_pagamento_tipo: "tipoContaEmitente",
  dados_pagamento_pix: "chavePix",

  // DADOS PJ (quando aplicável)
  "cliente_data.razaoSocial": "razaoSocialEmitenteEmpresa",
  "cliente_data.cnpj": "cnpjEmitenteEmpresa",
};

/**
 * Função helper para obter coordenada por campo do sistema
 */
export function getCoordinateForSystemField(systemField: string): CCBCoordinate | null {
  const ccbField = SYSTEM_TO_CCB_MAPPING[systemField as keyof typeof SYSTEM_TO_CCB_MAPPING];
  if (!ccbField) return null;

  return USER_CCB_COORDINATES[ccbField] || null;
}

/**
 * Função para obter todas as coordenadas de uma página específica
 */
export function getCoordinatesForPage(pageNumber: number): { [key: string]: CCBCoordinate } {
  const pageCoords: { [key: string]: CCBCoordinate } = {};

  Object.entries(USER_CCB_COORDINATES).forEach(([field, coord]) => {
    if ((coord.page || 1) === pageNumber) {
      pageCoords[field] = coord;
    }
  });

  return pageCoords;
}
