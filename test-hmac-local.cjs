/**
 * Teste local da lógica HMAC - Validação da implementação
 * PAM V1.0 - Teste unitário
 */

const crypto = require('crypto');

// Simular a função de validação
function validateInterWebhookHMAC(payload, signature, secret) {
  if (!secret) {
    console.error("❌ Secret not configured");
    return false;
  }

  // Remover prefixos possíveis
  const cleanSignature = signature.replace(/^(sha256=|SHA256=)?/, '');
  
  // Gerar assinatura esperada
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  console.log(`🔐 Signature received (clean): ${cleanSignature.substring(0, 20)}...`);
  console.log(`🔐 Signature expected: ${expectedSignature.substring(0, 20)}...`);

  try {
    // Garantir que ambas as strings tenham o mesmo tamanho
    if (cleanSignature.length !== expectedSignature.length) {
      console.error(`❌ Signature length mismatch: received ${cleanSignature.length}, expected ${expectedSignature.length}`);
      return false;
    }

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'), 
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error(`❌ Error comparing signatures:`, error);
    return false;
  }
}

// Executar testes
console.log('🔐 ===== TESTE LOCAL DA LÓGICA HMAC =====\n');

const SECRET = 'test-secret-key';
const payload = JSON.stringify({
  evento: 'cobranca-paga',
  cobranca: {
    seuNumero: 'SIMPIX-TEST-001',
    valorRecebido: 100.50
  }
});

// TESTE 1: Assinatura válida
console.log('📋 TESTE 1: Assinatura válida');
const validSignature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const test1 = validateInterWebhookHMAC(payload, validSignature, SECRET);
console.log(test1 ? '✅ PASSOU - Assinatura válida aceita\n' : '❌ FALHOU - Assinatura válida rejeitada\n');

// TESTE 2: Assinatura inválida
console.log('📋 TESTE 2: Assinatura inválida');
const invalidSignature = crypto.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
const test2 = validateInterWebhookHMAC(payload, invalidSignature, SECRET);
console.log(!test2 ? '✅ PASSOU - Assinatura inválida rejeitada\n' : '❌ FALHOU - Assinatura inválida aceita\n');

// TESTE 3: Assinatura com prefixo sha256=
console.log('📋 TESTE 3: Assinatura com prefixo sha256=');
const signatureWithPrefix = 'sha256=' + validSignature;
const test3 = validateInterWebhookHMAC(payload, signatureWithPrefix, SECRET);
console.log(test3 ? '✅ PASSOU - Prefixo removido corretamente\n' : '❌ FALHOU - Prefixo não removido\n');

// TESTE 4: Assinatura com prefixo SHA256= (maiúsculo)
console.log('📋 TESTE 4: Assinatura com prefixo SHA256=');
const signatureWithPrefixUpper = 'SHA256=' + validSignature;
const test4 = validateInterWebhookHMAC(payload, signatureWithPrefixUpper, SECRET);
console.log(test4 ? '✅ PASSOU - Prefixo maiúsculo removido\n' : '❌ FALHOU - Prefixo maiúsculo não removido\n');

// TESTE 5: Assinatura vazia
console.log('📋 TESTE 5: Assinatura vazia');
const test5 = validateInterWebhookHMAC(payload, '', SECRET);
console.log(!test5 ? '✅ PASSOU - Assinatura vazia rejeitada\n' : '❌ FALHOU - Assinatura vazia aceita\n');

// Resumo
const totalTests = 5;
const passedTests = [test1, !test2, test3, test4, !test5].filter(Boolean).length;
console.log(`\n📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);

if (passedTests === totalTests) {
  console.log('🎉 TODOS OS TESTES PASSARAM! Lógica HMAC funcionando corretamente.');
} else {
  console.log('⚠️ Alguns testes falharam. Verificar implementação.');
}