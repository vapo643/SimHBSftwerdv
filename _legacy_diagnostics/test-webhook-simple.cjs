/**
 * Teste Simples do Webhook ClickSign (sem HMAC)
 * Para verificar se a estrutura básica está funcionando
 */

const WEBHOOK_URL = 'http://localhost:5000/api/clicksign/webhook-test';

console.log('🧪 TESTE SIMPLES DO WEBHOOK CLICKSIGN');
console.log('====================================');

async function testBasicWebhook() {
  try {
    console.log('\n🎯 Teste: Evento auto_close (sem validação HMAC)');
    
    // Formato baseado na API v1/v2 do ClickSign (mais comum)
    const payload = {
      event: 'auto_close',
      data: {
        document: {
          key: 'test-document-123',
          filename: 'CCB_PROPOSTA_TEST_123.pdf'
        },
        list: {
          key: 'test-list-123',
          status: 'closed'
        }
      },
      occurred_at: new Date().toISOString()
    };

    console.log('   → Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClickSign-Webhook-Test/1.0'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    console.log(`   → Status: ${response.status}`);
    console.log(`   → Resposta: ${responseText}`);

    if (response.status === 404 && responseText.includes('Proposal not found')) {
      console.log('   ✅ Webhook funcionando! (Erro esperado: proposta não encontrada)');
    } else if (response.ok) {
      console.log('   ✅ Webhook processado com sucesso!');
    } else {
      console.log('   ❌ Erro no webhook');
    }

  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

// Executar teste
console.log(`🔗 URL: ${WEBHOOK_URL}`);
testBasicWebhook().then(() => {
  console.log('\n🏁 Teste concluído!');
});