#!/usr/bin/env tsx

/**
 * PAM V1.0 - OPERAÇÃO BANDEIRA FALSA
 * Script de Simulação de Webhook ClickSign
 * 
 * OBJETIVO: Simular um webhook real da ClickSign para validar
 * o sistema end-to-end sem depender de assinatura real
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

interface ClickSignWebhookPayload {
  event: string;
  data: {
    document?: {
      key: string;
      status: string;
      filename: string;
    };
    envelope?: {
      id: string;
      status: string;
      finished_at: string;
    };
    signer?: {
      email: string;
      name?: string;
    };
  };
  occurred_at?: string;
  hmac?: string;
}

class WebhookSimulator {
  private readonly webhookSecret: string;
  private readonly webhookUrl: string;
  private readonly testDocumentKey: string;

  constructor() {
    // Configurações de teste
    this.webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET || 'test-secret-key';
    this.webhookUrl = 'http://localhost:5000/api/clicksign/webhook';
    this.testDocumentKey = 'test-document-key-123'; // Document key que existe no banco
  }

  /**
   * Gerar assinatura HMAC-SHA256 conforme especificação ClickSign
   * Formato: HMAC-SHA256(timestamp + '.' + payload)
   */
  private generateHmacSignature(payload: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(message, 'utf8')
      .digest('hex');
  }

  /**
   * Criar payload realista baseado na documentação ClickSign
   */
  private createDocumentClosePayload(): ClickSignWebhookPayload {
    const now = new Date().toISOString();
    
    return {
      event: 'document.close',
      data: {
        document: {
          key: this.testDocumentKey,
          status: 'closed',
          filename: 'CCB_TESTE_WEBHOOK.pdf'
        },
        signer: {
          email: 'cliente.teste@simpix.com.br',
          name: 'Cliente Teste'
        }
      },
      occurred_at: now
    };
  }

  /**
   * Criar payload de signer finalizado (formato v1/v2)
   */
  private createSignerFinishedPayload(): ClickSignWebhookPayload {
    const now = new Date().toISOString();
    
    return {
      event: 'signer.sign',
      data: {
        document: {
          key: this.testDocumentKey,
          status: 'signed',
          filename: 'CCB_TESTE_WEBHOOK.pdf'
        },
        signer: {
          email: 'cliente.teste@simpix.com.br',
          name: 'Cliente Teste'
        }
      },
      occurred_at: now
    };
  }

  /**
   * Enviar webhook simulado para o endpoint
   */
  private async sendWebhook(payload: ClickSignWebhookPayload): Promise<void> {
    const payloadString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString(); // Unix timestamp
    const signature = this.generateHmacSignature(payloadString, timestamp);

    console.log('🎯 [SIMULAÇÃO] Enviando webhook para:', this.webhookUrl);
    console.log('📋 [PAYLOAD]', JSON.stringify(payload, null, 2));
    console.log('🔐 [SIGNATURE]', signature);
    console.log('⏰ [TIMESTAMP]', timestamp);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clicksign-signature': signature,
          'x-clicksign-timestamp': timestamp,
          'User-Agent': 'ClickSign-Webhook-Test/1.0'
        },
        body: payloadString
      });

      console.log('📡 [RESPONSE] Status:', response.status);
      console.log('📡 [RESPONSE] Headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ [SUCESSO] Webhook processado com sucesso!');
        console.log('📄 [RESPONSE] Body:', responseData || 'Empty response');
        return;
      } else {
        const errorData = await response.text();
        console.error('❌ [FALHA] Webhook rejeitado pelo servidor');
        console.error('📄 [ERROR] Body:', errorData);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.error('💥 [ERRO] Falha na requisição:', error);
      throw error;
    }
  }

  /**
   * Executar bateria de testes de webhook
   */
  async runTestSuite(): Promise<void> {
    console.log('🧪 [OPERAÇÃO BANDEIRA FALSA] Iniciando simulação de webhooks ClickSign');
    console.log('🎯 [CONFIG] URL:', this.webhookUrl);
    console.log('🔑 [CONFIG] Secret configurado:', this.webhookSecret ? 'SIM' : 'NÃO');
    console.log('📄 [CONFIG] Document Key:', this.testDocumentKey);
    console.log('');

    const tests = [
      {
        name: 'document.close',
        description: 'Simula finalização de documento assinado',
        payload: this.createDocumentClosePayload()
      },
      {
        name: 'signer.sign',
        description: 'Simula assinatura de documento finalizada',
        payload: this.createSignerFinishedPayload()
      }
    ];

    let successCount = 0;
    let failureCount = 0;

    for (const test of tests) {
      console.log(`🧪 [TESTE] ${test.name}: ${test.description}`);
      try {
        await this.sendWebhook(test.payload);
        successCount++;
        console.log(`✅ [${test.name}] SUCESSO`);
      } catch (error) {
        failureCount++;
        console.error(`❌ [${test.name}] FALHA:`, error instanceof Error ? error.message : error);
      }
      console.log(''); // Separador
    }

    // Relatório final
    console.log('📊 [RELATÓRIO FINAL]');
    console.log(`   - Total de testes: ${tests.length}`);
    console.log(`   - Sucessos: ${successCount}`);
    console.log(`   - Falhas: ${failureCount}`);
    console.log(`   - Taxa de sucesso: ${((successCount / tests.length) * 100).toFixed(1)}%`);

    if (failureCount === 0) {
      console.log('🎉 [RESULTADO] OPERAÇÃO BANDEIRA FALSA: SUCESSO TOTAL!');
      console.log('✅ [VALIDAÇÃO] Sistema de webhooks funcionando corretamente');
    } else {
      console.log('⚠️ [RESULTADO] OPERAÇÃO BANDEIRA FALSA: FALHAS DETECTADAS');
      console.log('❌ [VALIDAÇÃO] Sistema precisa de correções');
    }
  }
}

// Executar simulação se chamado diretamente
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const simulator = new WebhookSimulator();
  simulator.runTestSuite()
    .then(() => {
      console.log('🚀 [CONCLUÍDO] Simulação executada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 [FALHA CRÍTICA] Erro durante simulação:', error);
      process.exit(1);
    });
}

export { WebhookSimulator };