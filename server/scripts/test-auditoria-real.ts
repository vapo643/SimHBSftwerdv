/**
 * Teste Real da Auditoria - Funcionalidades Prorrogar Vencimento e Desconto de Quitação
 * Executa operações reais e captura logs de auditoria completos
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

console.log('🔍 ==== TESTE REAL DE AUDITORIA ====\n');

async function fazerLogin(): Promise<string> {
  try {
    console.log('🔐 Fazendo login como administrador...');

    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@simpix.com', // Sem .br
      password: 'admin123', // Senha simples que funciona
    });

    if (response.data.token) {
      console.log('✅ Login realizado com sucesso!\n');
      return response.data.token;
    }
else {
      throw new Error('Token não retornado');
    }
  }
catch (error) {
    console.log('❌ Erro no login, tentando criar usuário admin...\n');

    // Tentar criar usuário admin se não existir
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'admin@simpix.com',
        password: 'admin123',
        nome: 'Administrador',
        role: 'ADMINISTRADOR',
      });

      console.log('✅ Usuário admin criado, fazendo login...');

      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@simpix.com',
        password: 'admin123',
      });

      return loginResponse.data.token;
    }
catch (createError) {
      console.error('❌ Erro ao criar usuário admin:', createError);
      throw new Error('Não foi possível autenticar');
    }
  }
}

async function buscarPropostaComBoletos(
  token: string
): Promise<{ propostaId: string; codigoSolicitacao: string }> {
  try {
    console.log('📋 Buscando proposta com boletos ativos...');

    // Buscar primeira proposta com boletos ativos
    const response = await axios.get(`${API_URL}/inter/collections/list`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `jwt=${token}`,
      },
    });

    const collections = response.data.collections || [];
    const boletoAtivo = collections.find((c) => c.isActive && c.situacao == 'A_RECEBER');

    if (!boletoAtivo) {
      throw new Error('Nenhum boleto ativo encontrado');
    }

    console.log(`✅ Boleto encontrado: ${boletoAtivo.codigoSolicitacao}\n`);

    return {
      propostaId: boletoAtivo.propostaId,
      codigoSolicitacao: boletoAtivo.codigoSolicitacao,
    };
  }
catch (error) {
    console.error('❌ Erro ao buscar boletos:', error);
    throw error;
  }
}

async function testarProrrogacaoComAuditoria(token: string, codigoSolicitacao: string) {
  console.log('🚀 TESTE 1: PRORROGAÇÃO DE VENCIMENTO COM AUDITORIA');
  console.log('==================================\n');

  try {
    // Calcular nova data (30 dias a mais)
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    const novaData = hoje.toISOString().split('T')[0];

    console.log(`📅 Prorrogando boleto ${codigoSolicitacao} para ${novaData}...\n`);

    const response = await axios.patch(
      `${API_URL}/inter/collections/batch-extend`,
      {
        codigosSolicitacao: [codigoSolicitacao],
        novaDataVencimento: novaData,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `jwt=${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ RESPOSTA DA PRORROGAÇÃO:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n');

    return true;
  }
catch (error) {
    console.error('❌ Erro na prorrogação:', error.response?.data || error.message);
    return false;
  }
}

async function testarDescontoComAuditoria(token: string, propostaId: string) {
  console.log('🚀 TESTE 2: DESCONTO DE QUITAÇÃO COM AUDITORIA');
  console.log('================================\n');

  try {
    // Buscar informações da proposta
    const proposalResponse = await axios.get(
      `${API_URL}/inter/collections/proposal/${propostaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `jwt=${token}`,
        },
      }
    );

    const { valorRestante } = proposalResponse.data;

    if (!valorRestante || valorRestante <= 0) {
      console.log('❌ Valor restante não encontrado ou inválido');
      return false;
    }

    // Aplicar desconto de 30%
    const desconto = valorRestante * 0.3;
    const novoValorTotal = valorRestante - desconto;

    // Criar 2 novas parcelas
    const hoje = new Date();
    const parcela1Data = new Date(hoje);
    parcela1Data.setDate(parcela1Data.getDate() + 30);
    const parcela2Data = new Date(hoje);
    parcela2Data.setDate(parcela2Data.getDate() + 60);

    const novasParcelas = [
      { valor: novoValorTotal / 2, dataVencimento: parcela1Data.toISOString().split('T')[0] },
      { valor: novoValorTotal / 2, dataVencimento: parcela2Data.toISOString().split('T')[0] },
    ];

    console.log(`💰 Aplicando desconto de quitação:`);
    console.log(`   • Valor original: R$ ${valorRestante.toFixed(2)}`);
    console.log(`   • Desconto: R$ ${desconto.toFixed(2)} (30%)`);
    console.log(`   • Novo valor: R$ ${novoValorTotal.toFixed(2)}`);
    console.log(`   • 2 parcelas de R$ ${(novoValorTotal / 2).toFixed(2)}\n`);

    const response = await axios.post(
      `${API_URL}/inter/collections/settlement-discount`,
      {
        propostaId,
        desconto,
        novasParcelas,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `jwt=${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ RESPOSTA DO DESCONTO:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n');

    return true;
  }
catch (error) {
    console.error('❌ Erro no desconto:', error.response?.data || error.message);
    return false;
  }
}

// Executar todos os testes
async function executarTestes() {
  try {
    const token = await fazerLogin();
    const { propostaId, codigoSolicitacao } = await buscarPropostaComBoletos(token);

    console.log('📊 DADOS PARA TESTE:');
    console.log(`   • Proposta ID: ${propostaId}`);
    console.log(`   • Código Solicitação: ${codigoSolicitacao}\n`);

    const resultadoProrrogacao = await testarProrrogacaoComAuditoria(token, codigoSolicitacao);

    // Aguardar um pouco entre os testes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const resultadoDesconto = await testarDescontoComAuditoria(token, propostaId);

    console.log('🏁 ==== RELATÓRIO FINAL ====');
    console.log(`✅ Prorrogação: ${resultadoProrrogacao ? 'SUCESSO' : 'FALHA'}`);
    console.log(`✅ Desconto: ${resultadoDesconto ? 'SUCESSO' : 'FALHA'}`);
    console.log('\n🔍 Verifique os logs do servidor para ver a auditoria completa!');
    console.log('==== FIM DOS TESTES ====\n');
  }
catch (error) {
    console.error('❌ Erro geral nos testes:', error);
  }
}

// Aguardar servidor estar pronto
setTimeout(() => {
  executarTestes().catch (console.error);
}, 2000);
