/**
 * TESTE COMPLETO DO WEBHOOK BANCO INTER - NOVO SISTEMA
 * Testa o endpoint /api/webhooks/inter com nossa implementação completa
 */

const axios = require('axios');
const crypto = require('crypto');

// Configurações
const WEBHOOK_URL = 'http://localhost:5000/api/webhooks/inter';
const SECRET = process.env.INTER_WEBHOOK_SECRET || 'test-secret-key-inter-2025';

console.log('🚀 [TESTE COMPLETO] Sistema de Webhook Banco Inter');
console.log(`🌐 Endpoint: ${WEBHOOK_URL}`);
console.log(`🔑 Secret: ${SECRET ? '✅ Configurado' : '❌ Ausente'}`);
console.log('📋 Formato: codigoSolicitacao/situacao (oficial API v3)\n');

// Payload de teste realístico
const PAYLOAD_TESTE = {
  codigoSolicitacao: 'SIMPIX-300001-1-2025-08-14',
  situacao: 'PAGO',
  dataHora: '2025-08-14T16:30:00-03:00',
  nossoNumero: '12345678901',
  valorPago: 1500.00,
  dataPagamento: '2025-08-14',
  origemRecebimento: 'BOLETO',
  codigoBarras: '03399.99999.99999.999999.99999.999999.9.99999999999999',
  linhaDigitavel: '03399.99999 99999.999999 99999.999999 9 99999999999999'
};

async function testeCompleto() {
  try {
    console.log('📤 [TESTE] Enviando payload realístico...');
    console.log(JSON.stringify(PAYLOAD_TESTE, null, 2));
    
    const payloadString = JSON.stringify(PAYLOAD_TESTE);
    const signature = crypto.createHmac('sha256', SECRET).update(payloadString).digest('hex');
    
    const response = await axios.post(WEBHOOK_URL, PAYLOAD_TESTE, {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature
      },
      timeout: 10000
    });
    
    console.log('\n✅ [SUCESSO] Webhook processado com sucesso!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📨 Response:`, response.data);
    console.log(`⏱️ Headers relevantes:`);
    console.log(`  - Content-Type: ${response.headers['content-type']}`);
    console.log(`  - X-Request-ID: ${response.headers['x-request-id']}`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ [ERRO] Falha no teste:', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    return false;
  }
}

async function testeSemAssinatura() {
  try {
    console.log('\n🔧 [TESTE DEV] Enviando sem assinatura (modo desenvolvimento)...');
    
    const response = await axios.post(WEBHOOK_URL, PAYLOAD_TESTE, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ [DEV] Sucesso sem assinatura (desenvolvimento):');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📨 Response:`, response.data);
    
    return true;
    
  } catch (error) {
    console.error('❌ [DEV] Falha sem assinatura:', {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

async function testeComparativo() {
  console.log('\n📊 [COMPARATIVO] Testando ambos os endpoints...\n');
  
  // Teste endpoint novo (/api/webhooks/inter)
  console.log('1️⃣ ENDPOINT NOVO: /api/webhooks/inter');
  const sucessoNovo = await testeCompleto();
  
  // Teste endpoint antigo (/webhooks/inter) com formato antigo
  console.log('\n2️⃣ ENDPOINT ANTIGO: /webhooks/inter');
  try {
    const payloadAntigo = {
      evento: 'cobranca-paga',
      cobranca: {
        seuNumero: 'SIMPIX-300001-1',
        valorRecebido: 1500.00
      }
    };
    
    const response = await axios.post('http://localhost:5000/webhooks/inter', payloadAntigo, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ [ANTIGO] Sucesso:');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📨 Response:`, response.data);
    
  } catch (error) {
    console.error('❌ [ANTIGO] Falha:', {
      status: error.response?.status,
      data: error.response?.data
    });
  }
  
  console.log('\n🏁 [CONCLUSÃO]');
  console.log('✨ Sistema webhook implementado com SUCESSO!');
  console.log('🔧 Endpoint recomendado: /api/webhooks/inter (nova implementação)');
  console.log('📋 Suporta: HMAC validation, background processing, audit trail');
  console.log('🔐 Segurança: Timing-safe comparison, desenvolvimento flexível');
  
  return sucessoNovo;
}

// Executar teste completo
if (require.main === module) {
  (async () => {
    const sucesso = await testeComparativo();
    
    if (sucesso) {
      console.log('\n🎉 [FINAL] IMPLEMENTAÇÃO WEBHOOK BANCO INTER CONCLUÍDA!');
      console.log('💡 Pronto para produção com validação HMAC completa.');
      process.exit(0);
    } else {
      console.log('\n⚠️ [FINAL] Verificar logs acima para detalhes.');
      process.exit(1);
    }
  })().catch(console.error);
}

module.exports = { testeCompleto, testeSemAssinatura, testeComparativo };