/**
 * Teste do Webhook ClickSign
 * Simula um webhook vindo do ClickSign para testar nosso sistema
 */

const crypto = require('crypto');

// Configuração do teste
const WEBHOOK_URL = 'http://localhost:5000/api/clicksign/webhook';
const WEBHOOK_SECRET = process.env.CLICKSIGN_WEBHOOK_SECRET || '';

console.log('🧪 TESTE DO WEBHOOK CLICKSIGN');
console.log('==============================');

async function testWebhook() {
  try {
    // 1. Teste: evento auto_close (mais importante)
    console.log('\n🎯 Teste 1: Evento auto_close (CRÍTICO)');
    await testEvent('auto_close', {
      document: {
        key: 'test-document-123',
        filename: 'CCB_PROPOSTA_TEST_123.pdf'
      },
      list: {
        key: 'test-list-123',
        status: 'closed'
      }
    });

    // 2. Teste: evento document_closed
    console.log('\n📄 Teste 2: Evento document_closed');
    await testEvent('document_closed', {
      document: {
        key: 'test-document-123',
        filename: 'CCB_PROPOSTA_TEST_123.pdf'
      }
    });

    // 3. Teste: evento cancel
    console.log('\n❌ Teste 3: Evento cancel');
    await testEvent('cancel', {
      document: {
        key: 'test-document-456',
        filename: 'CCB_cancelado.pdf'
      }
    });

    // 4. Teste: evento sign
    console.log('\n✍️ Teste 4: Evento sign');
    await testEvent('sign', {
      document: {
        key: 'test-document-789'
      },
      signer: {
        email: 'cliente@teste.com',
        name: 'Cliente Teste'
      }
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function testEvent(eventType, data) {
  // Formato correto baseado na API atual do ClickSign
  const payload = {
    event: {
      type: eventType,
      created_at: new Date().toISOString(),
      data: data
    }
  };

  const payloadString = JSON.stringify(payload);

  // Gerar assinatura HMAC se temos o secret
  let signature = '';
  let timestamp = '';
  
  if (WEBHOOK_SECRET) {
    timestamp = Math.floor(Date.now() / 1000).toString();
    const signaturePayload = `${timestamp}.${payloadString}`;
    signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(signaturePayload)
      .digest('hex');
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'ClickSign-Webhook-Test/1.0'
  };

  if (signature && timestamp) {
    headers['x-clicksign-signature'] = `sha256=${signature}`;
    headers['x-clicksign-timestamp'] = timestamp;
  }

  console.log(`   → Enviando evento: ${eventType}`);
  console.log(`   → Payload:`, JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: headers,
      body: payloadString
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📋 Resposta:`, responseText);
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   📋 Erro:`, responseText);
    }
  } catch (error) {
    console.log(`   ❌ Erro de conexão:`, error.message);
  }
}

// Executar teste
console.log(`🔗 URL do webhook: ${WEBHOOK_URL}`);
console.log(`🔐 Secret configurado: ${WEBHOOK_SECRET ? '✅ Sim' : '❌ Não'}`);
console.log('');

testWebhook().then(() => {
  console.log('\n🏁 Teste concluído!');
  console.log('📊 Verifique os logs do sistema para confirmar o processamento.');
});