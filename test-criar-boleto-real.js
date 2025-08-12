const https = require('https');
const fs = require('fs');

// Dados do boleto de teste
const boletoData = {
  seuNumero: `TEST-${Date.now()}`,
  valorNominal: 10.00,
  dataEmissao: new Date().toISOString().split('T')[0],
  dataVencimento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  numDiasAgenda: 5,
  pagador: {
    cpfCnpj: "20528464760",
    tipoPessoa: "FISICA",
    nome: "TESTE SISTEMA",
    endereco: "Rua Teste",
    numero: "123",
    bairro: "Centro",
    cidade: "Serra",
    uf: "ES",
    cep: "29165460",
    email: "teste@example.com",
    telefone: "27998538565"
  },
  mensagem: {
    linha1: "BOLETO DE TESTE - IGNORAR"
  },
  desconto1: {
    codigoDesconto: "NAOTEMDESCONTO",
    taxa: 0,
    valor: 0
  },
  multa: {
    codigoMulta: "NAOTEMMULTA",
    taxa: 0,
    valor: 0
  },
  mora: {
    codigoMora: "ISENTO",
    taxa: 0,
    valor: 0
  }
};

console.log('🚀 Tentando criar boleto real no Inter...');
console.log('📋 Dados:', JSON.stringify(boletoData, null, 2));

// Aqui seria a chamada real à API
console.log('⚠️ Script de teste preparado - integração com API Inter necessária');
