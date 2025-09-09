/**
 * Proposals Generator - Gerador de propostas de empréstimo
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { faker } from '@faker-js/faker';
import { ClientGenerator } from './clients.js';

export class ProposalGenerator {
  
  constructor() {
    faker.setLocale('pt_BR');
    this.clientGenerator = new ClientGenerator();
  }

  /**
   * Gera uma proposta completa com dados do cliente
   */
  generateProposal(analystId, status = 'rascunho') {
    const clientData = this.clientGenerator.generateClientData();
    const valor = faker.number.float({ min: 5000, max: 50000, precision: 0.01 });
    const prazo = faker.helpers.arrayElement([6, 12, 18, 24, 36, 48]);
    const taxaJuros = faker.number.float({ min: 2.5, max: 8.5, precision: 0.01 });
    
    // Cálculos básicos
    const valorTac = valor * 0.03; // 3% do valor
    const valorIof = valor * 0.0082; // 0.82% IOF
    const valorTotalFinanciado = valor + valorTac + valorIof;
    const valorLiquidoLiberado = valor - valorTac;
    
    return {
      // Dados do cliente (incorporados na proposta)
      ...clientData,
      
      // Dados do empréstimo
      valor: valor.toString(),
      prazo: prazo,
      finalidade: faker.helpers.arrayElement([
        'Capital de giro', 'Quitação de dívidas', 'Reforma da casa', 
        'Investimento no negócio', 'Despesas pessoais'
      ]),
      garantia: faker.helpers.arrayElement(['Sem garantia', 'Avalista', 'Penhor']),
      
      // Valores calculados
      valorTac: valorTac.toString(),
      valorIof: valorIof.toString(),
      valorTotalFinanciado: valorTotalFinanciado.toString(),
      valorLiquidoLiberado: valorLiquidoLiberado.toString(),
      
      // Dados financeiros
      jurosModalidade: 'pre_fixado',
      periodicidadeCapitalizacao: 'mensal',
      taxaJurosAnual: taxaJuros.toString(),
      pracaPagamento: 'São Paulo',
      formaPagamento: faker.helpers.arrayElement(['boleto', 'pix', 'debito']),
      anoBase: 365,
      tarifaTed: '10.00',
      taxaCredito: null,
      dataLiberacao: null,
      formaLiberacao: 'deposito',
      calculoEncargos: null,
      
      // Status e análise
      status: status,
      analistaId: analystId,
      dataAnalise: this.getStatusDate(status),
      motivoPendencia: status === 'pendente' ? faker.helpers.arrayElement([
        'Documentação incompleta', 'Renda insuficiente', 'Score baixo',
        'Informações inconsistentes'
      ]) : null,
      valorAprovado: status === 'aprovado' ? valor.toString() : null,
      taxaJuros: taxaJuros.toString(),
      observacoes: status !== 'rascunho' ? faker.lorem.sentence() : null,
      
      // Documentos
      documentos: this.generateDocumentList(),
      ccbDocumentoUrl: faker.internet.url() + '/ccb.pdf',
      
      // Formalização
      dataAprovacao: status === 'aprovado' ? faker.date.recent({ days: 7 }) : null,
      documentosAdicionais: [],
      contratoGerado: status === 'aprovado' ? faker.datatype.boolean() : false,
      contratoAssinado: false,
      dataAssinatura: null,
      dataPagamento: null,
      observacoesFormalização: null,
      
      // CCB fields
      ccbGerado: false,
      caminhoCcb: null,
      ccbGeradoEm: null,
      assinaturaEletronicaConcluida: false,
      biometriaConcluida: false,
      caminhoCcbAssinado: null,
      
      // ClickSign fields
      clicksignDocumentKey: null,
      clicksignSignerKey: null,
      clicksignListKey: null,
      clicksignStatus: null,
      clicksignSignUrl: null,
      clicksignSentAt: null,
      clicksignSignedAt: null,
      
      // Dados de pagamento
      ...this.generatePaymentData(),
      
      // Tracking fields
      interBoletoGerado: false,
      interBoletoGeradoEm: null,
      
      // Campos legados
      clienteData: null,
      condicoesData: null,
      
      // Comprovante
      urlComprovantePagamento: null,
      
      // Auditoria
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  /**
   * Gera lista de documentos típica
   */
  generateDocumentList() {
    return [
      'rg', 'cpf', 'comprovante_residencia', 'comprovante_renda'
    ];
  }

  /**
   * Gera dados de pagamento (conta bancária + PIX)
   */
  generatePaymentData() {
    const bancos = [
      { nome: 'Banco do Brasil', codigo: '001' },
      { nome: 'Bradesco', codigo: '237' },
      { nome: 'Itaú', codigo: '341' },
      { nome: 'Santander', codigo: '033' },
      { nome: 'Caixa Econômica', codigo: '104' },
    ];
    
    const banco = faker.helpers.arrayElement(bancos);
    const metodoPagamento = faker.helpers.arrayElement(['conta_bancaria', 'pix']);
    
    const baseData = {
      // Dados bancários
      dadosPagamentoBanco: banco.nome,
      dadosPagamentoCodigoBanco: banco.codigo,
      dadosPagamentoAgencia: faker.number.int({ min: 1000, max: 9999 }).toString(),
      dadosPagamentoConta: faker.number.int({ min: 10000, max: 99999 }).toString(),
      dadosPagamentoDigito: faker.number.int({ min: 1, max: 9 }).toString(),
      dadosPagamentoTipo: faker.helpers.arrayElement(['conta_corrente', 'conta_poupanca']),
      dadosPagamentoNomeTitular: faker.person.fullName(),
      dadosPagamentoCpfTitular: faker.helpers.replaceSymbols('###.###.###-##'),
      metodoPagamento: metodoPagamento,
    };
    
    // Dados PIX se necessário
    if (metodoPagamento === 'pix') {
      return {
        ...baseData,
        dadosPagamentoPix: faker.helpers.replaceSymbols('###.###.###-##'), // CPF como chave PIX
        dadosPagamentoTipoPix: 'CPF',
        dadosPagamentoPixBanco: banco.nome,
        dadosPagamentoPixNomeTitular: baseData.dadosPagamentoNomeTitular,
        dadosPagamentoPixCpfTitular: baseData.dadosPagamentoCpfTitular,
      };
    }
    
    return {
      ...baseData,
      dadosPagamentoPix: null,
      dadosPagamentoTipoPix: null,
      dadosPagamentoPixBanco: null,
      dadosPagamentoPixNomeTitular: null,
      dadosPagamentoPixCpfTitular: null,
    };
  }

  /**
   * Retorna data adequada baseada no status
   */
  getStatusDate(status) {
    if (status === 'rascunho') return null;
    
    return faker.date.recent({ days: 15 });
  }
}