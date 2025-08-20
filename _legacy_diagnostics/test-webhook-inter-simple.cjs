/**
 * Script de teste simples para webhook do Banco Inter (sem HMAC)
 */

const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/inter';

const SAMPLE_PAYLOAD = {
  codigoSolicitacao: 'test-codigo-123',
  situacao: 'PAGO',
  dataHora: '2025-08-14T15:30:00-03:00',
  valorPago: 1500.00,
  dataPagamento: '2025-08-14',
  origemRecebimento: 'BOLETO'
};

async function testSimpleWebhook() {
  try {
    console.log('🧪 [TESTE SIMPLES] Enviando webhook sem assinatura...');
    console.log('📤 [PAYLOAD]', JSON.stringify(SAMPLE_PAYLOAD, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, SAMPLE_PAYLOAD, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ [SUCESSO] Status:', response.status);
    console.log('📥 [RESPOSTA]', response.data);
    
  } catch (error) {
    console.error('❌ [ERRO]', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
  }
}

testSimpleWebhook();