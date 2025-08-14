/**
 * Script de teste para webhook do Banco Inter
 * Simula payloads reais do webhook para validar a implementação
 */

const crypto = require('crypto');
const axios = require('axios');

// Configurações
const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/inter';
const WEBHOOK_SECRET = process.env.INTER_WEBHOOK_SECRET || 'test-secret-key';

// Payloads de exemplo baseados na API do Banco Inter
const SAMPLE_PAYLOADS = {
  PAGAMENTO_BOLETO: {
    codigoSolicitacao: 'test-codigo-123',
    situacao: 'PAGO',
    dataHora: '2025-08-14T15:30:00-03:00',
    nossoNumero: '12345678901',
    valorPago: 1500.00,
    dataPagamento: '2025-08-14',
    origemRecebimento: 'BOLETO',
    codigoBarras: '03399.99999.99999.999999.99999.999999.9.99999999999999',
    linhaDigitavel: '03399.99999 99999.999999 99999.999999 9 99999999999999'
  },
  
  PAGAMENTO_PIX: {
    codigoSolicitacao: 'test-codigo-456',
    situacao: 'PAGO',
    dataHora: '2025-08-14T15:35:00-03:00',
    valorPago: 750.50,
    dataPagamento: '2025-08-14',
    origemRecebimento: 'PIX',
    pixTxid: 'pix-transaction-789'
  },
  
  BOLETO_VENCIDO: {
    codigoSolicitacao: 'test-codigo-789',
    situacao: 'VENCIDO',
    dataHora: '2025-08-14T23:59:59-03:00',
    dataVencimento: '2025-08-13'
  },
  
  BOLETO_CANCELADO: {
    codigoSolicitacao: 'test-codigo-999',
    situacao: 'CANCELADO',
    dataHora: '2025-08-14T10:15:00-03:00'
  }
};

/**
 * Gera assinatura HMAC para o payload
 */
function generateHMAC(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Envia webhook de teste
 */
async function sendTestWebhook(name, payload, useSignature = true) {
  try {
    console.log(`\n🧪 [TESTE] Enviando webhook: ${name}`);
    console.log(`📤 [TESTE] Payload:`, JSON.stringify(payload, null, 2));
    
    const payloadString = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (useSignature) {
      headers['x-signature'] = generateHMAC(payloadString, WEBHOOK_SECRET);
      console.log(`🔐 [TESTE] Assinatura HMAC gerada`);
    }
    
    const response = await axios.post(WEBHOOK_URL, payloadString, { 
      headers,
      timeout: 10000 
    });
    
    console.log(`✅ [TESTE] Status: ${response.status}`);
    console.log(`📥 [TESTE] Resposta:`, response.data);
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.error(`❌ [TESTE] Erro no webhook ${name}:`, {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    return { success: false, error: error.message };
  }
}

/**
 * Testa webhook sem assinatura (deve falhar)
 */
async function testWithoutSignature() {
  console.log('\n🔒 [TESTE SEGURANÇA] Testando webhook sem assinatura');
  return await sendTestWebhook('SEM_ASSINATURA', SAMPLE_PAYLOADS.PAGAMENTO_BOLETO, false);
}

/**
 * Testa webhook com assinatura inválida
 */
async function testWithInvalidSignature() {
  console.log('\n🔒 [TESTE SEGURANÇA] Testando webhook com assinatura inválida');
  
  try {
    const payload = JSON.stringify(SAMPLE_PAYLOADS.PAGAMENTO_BOLETO);
    const response = await axios.post(WEBHOOK_URL, payload, { 
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'invalid-signature-12345'
      },
      timeout: 10000 
    });
    
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.log(`✅ [TESTE SEGURANÇA] Webhook rejeitado corretamente: ${error.response?.status}`);
    return { success: false, expectedFailure: true };
  }
}

/**
 * Função principal de teste
 */
async function runTests() {
  console.log('🚀 [TESTE] Iniciando testes do webhook Banco Inter');
  console.log(`🌐 [TESTE] URL: ${WEBHOOK_URL}`);
  console.log(`🔑 [TESTE] Secret configurado: ${WEBHOOK_SECRET ? 'SIM' : 'NÃO'}`);
  
  const results = [];
  
  // Teste 1: Pagamento por boleto
  results.push(await sendTestWebhook('PAGAMENTO_BOLETO', SAMPLE_PAYLOADS.PAGAMENTO_BOLETO));
  await sleep(1000);
  
  // Teste 2: Pagamento por PIX
  results.push(await sendTestWebhook('PAGAMENTO_PIX', SAMPLE_PAYLOADS.PAGAMENTO_PIX));
  await sleep(1000);
  
  // Teste 3: Boleto vencido
  results.push(await sendTestWebhook('BOLETO_VENCIDO', SAMPLE_PAYLOADS.BOLETO_VENCIDO));
  await sleep(1000);
  
  // Teste 4: Boleto cancelado
  results.push(await sendTestWebhook('BOLETO_CANCELADO', SAMPLE_PAYLOADS.BOLETO_CANCELADO));
  await sleep(1000);
  
  // Testes de segurança
  results.push(await testWithoutSignature());
  await sleep(1000);
  results.push(await testWithInvalidSignature());
  
  // Relatório final
  console.log('\n📊 [RELATÓRIO] Resultados dos testes:');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Sucessos: ${successful}/${total}`);
  
  if (successful === total - 2) { // -2 pois 2 testes de segurança devem falhar
    console.log('🎉 [SUCESSO] Todos os testes passaram! Webhook implementado corretamente.');
  } else {
    console.log('⚠️ [ATENÇÃO] Alguns testes falharam. Verificar implementação.');
  }
  
  return results;
}

/**
 * Utilitário para pausar execução
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Executar testes se chamado diretamente
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ [ERRO] Falha geral nos testes:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  sendTestWebhook,
  SAMPLE_PAYLOADS,
  generateHMAC
};