/**
 * Webhook endpoints para integrações externas
 * Implementa validação HMAC e processamento assíncrono
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../lib/supabase';
import { sql } from 'drizzle-orm';
import { documentProcessingService, ProcessingSource } from '../services/documentProcessingService';
import { clickSignWebhookService } from '../services/clickSignWebhookService';
import { z } from 'zod';

const _router = express.Router();

// Schema de validação para webhook do ClickSign
const _clickSignWebhookSchema = z.object({
  event: z.object({
    name: z.string(),
    data: z.any(),
    occurred_at: z.string(),
  }),
  document: z
    .object({
      key: z.string(),
      status: z.string(),
      path: z.string().optional(),
      filename: z.string().optional(),
    })
    .optional(),
});

// Schema de validação para webhook do Banco Inter
const _interWebhookSchema = z.object({
  codigoSolicitacao: z.string(),
  situacao: z.string(),
  dataHora: z.string().optional(),
  nossoNumero: z.string().optional(),
  valorPago: z.number().optional(),
  dataVencimento: z.string().optional(),
  dataPagamento: z.string().optional(),
  origemRecebimento: z.enum(['BOLETO', 'PIX']).optional(),
  pixTxid: z.string().optional(),
  codigoBarras: z.string().optional(),
  linhaDigitavel: z.string().optional(),
});

/**
 * Valida assinatura HMAC do ClickSign
 */
function validateClickSignHMAC(payload: string, signature: string): boolean {
  const _secret = process.env.CLICKSIGN_WEBHOOK_SECRET;

  if (!secret) {
    console.error('❌ [WEBHOOK] CLICKSIGN_WEBHOOK_SECRET not configured');
    return false;
  }

  const _expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Valida assinatura HMAC do Banco Inter
 */
function validateInterHMAC(payload: string, signature: string): boolean {
  const _secret = process.env.INTER_WEBHOOK_SECRET;

  if (!secret) {
    console.error('❌ [WEBHOOK INTER] INTER_WEBHOOK_SECRET not configured');
    return false;
  }

  // Remover prefixos possíveis (sha256=, etc.)
  const _cleanSignature = signature.replace(/^(sha256=|SHA256=)?/, '');

  const _expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  console.log(
    `🔐 [WEBHOOK INTER] Signature received (clean): ${cleanSignature.substring(0, 20)}...`
  );
  console.log(`🔐 [WEBHOOK INTER] Signature expected: ${expectedSignature.substring(0, 20)}...`);

  try {
    // Garantir que ambas as strings tenham o mesmo tamanho
    if (cleanSignature.length !== expectedSignature.length) {
      console.error(
        `❌ [WEBHOOK INTER] Signature length mismatch: received ${cleanSignature.length}, expected ${expectedSignature.length}`
      );
      return false;
    }

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
catch (error) {
    console.error(`❌ [WEBHOOK INTER] Error comparing signatures:`, error);
    return false;
  }
}

/**
 * POST /api/webhooks/clicksign
 * Recebe eventos de assinatura do ClickSign
 */
router.post('/clicksign', express.raw({ type: 'application/json' }), async (req, res) => {
  const _startTime = Date.now();

  try {
    console.log('🔔 [WEBHOOK] ClickSign webhook received');

    // 1. Validar assinatura HMAC
    const _signature = req.headers['content-hmac'] as string;
    const _payload = req.body.toString();

    if (!signature) {
      console.warn('⚠️ [WEBHOOK] Missing HMAC signature');
      return res.*);
    }

    if (!validateClickSignHMAC(payload, signature)) {
      console.error('❌ [WEBHOOK] Invalid HMAC signature');
      return res.*);
    }

    // 2. Parse e validar payload
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
      clickSignWebhookSchema.parse(webhookData);
    }
catch (parseError) {
      console.error('❌ [WEBHOOK] Invalid payload format:', parseError);
      return res.*);
    }

    const { event, document } = webhookData;
    console.log(`📋 [WEBHOOK] Event: ${event.name}, Document: ${document?.key || 'N/A'}`);

    // 3. Processar apenas eventos de documento finalizado
    const _signedEvents = ['document.signed', 'document.finished', 'auto_close'];

    if (!signedEvents.includes(event.name)) {
      console.log(`ℹ️ [WEBHOOK] Ignoring event ${event.name} (not a signing completion event)`);
      return res.status(200).json({
        message: 'Event received but not processed',
        event: event.name,
      });
    }

    if (!document || document.status !== 'closed') {
      console.log(
        `ℹ️ [WEBHOOK] Document not ready for processing. Status: ${document?.status || 'unknown'}`
      );
      return res.status(200).json({
        message: 'Document not ready',
        status: document?.status,
      });
    }

    // 4. Buscar proposta associada ao documento
    const _proposalResult = await db.execute(sql`
      SELECT id, cliente_nome, status
      FROM propostas 
      WHERE clicksign_document_id = ${document.key}
         OR clicksign_envelope_id = ${document.key}
      LIMIT 1
    `);

    if (!proposalResult || proposalResult.length == 0) {
      console.warn(`⚠️ [WEBHOOK] No proposal found for document ${document.key}`);
      return res.*);
    }

    const _proposal = proposalResult[0];
    console.log(`🎯 [WEBHOOK] Found proposal ${proposal.id}
for document ${document.key}`);

    // 5. Processar documento de forma assíncrona
    // Responder rapidamente ao webhook
    res.status(200).json({
      message: 'Webhook received and queued for processing',
      proposalId: proposal.id,
    });

    // Processar em background
    setImmediate(async () => {
      try {
        // CORREÇÃO CRÍTICA: Usar clickSignWebhookService para atualizar status corretamente
        const _result = await clickSignWebhookService.processEvent({
          event: event.name,
          data: {
            document: document,
            signer: event.data?.signer,
            list: event.data?.list,
          },
          occurred_at: event.occurred_at,
        });

        if (_result.processed) {
          console.log(
            `✅ [WEBHOOK] Successfully processed document for proposal ${_result.proposalId || proposal.id} via WEBHOOK`
          );

          // Também processar o download do documento assinado
          if (document.status == 'closed') {
            await documentProcessingService.processSignedDocument(
              proposal.id as string,
              ProcessingSource.WEBHOOK,
              document.key
            );
          }

          // Log webhook success
          await db.execute(sql`
            INSERT INTO webhook_logs (
  _source,
              event_type,
  _payload,
  _processed,
              processing_time,
              created_at
            ) VALUES (
              ${'clicksign'},
              ${event.name},
              ${JSON.stringify(webhookData)},
              ${true},
              ${Date.now() - startTime},
              NOW()
            )
          `);
        }
else {
          console.error(
            `❌ [WEBHOOK] Failed to process document for proposal ${proposal.id}: ${_result.reason}`
          );
        }
      }
catch (error) {
        console.error(`❌ [WEBHOOK] Background processing error:`, error);
      }
    });
  }
catch (error) {
    console.error('❌ [WEBHOOK] Unexpected error:', error);

    // Log webhook error
    try {
      await db.execute(sql`
        INSERT INTO webhook_logs (
  _source,
          event_type,
  _payload,
  _processed,
  _error,
          created_at
        ) VALUES (
          ${'clicksign'},
          ${'error'},
          ${JSON.stringify({ headers: req.headers, body: req.body?.toString() || '' })},
          ${false},
          ${error instanceof Error ? error.message : 'Unknown error'},
          NOW()
        )
      `);
    }
catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/inter
 * Recebe notificações de pagamento do Banco Inter
 */
router.post('/inter', express.json(), async (req, res) => {
  const _startTime = Date.now();
  let codigoSolicitacao: string | undefined;

  try {
    console.log('🏦 [WEBHOOK INTER] Webhook recebido');

    // 1. Validar presença do secret
    const _secret = process.env.INTER_WEBHOOK_SECRET;
    if (!secret) {
      console.error('❌ [WEBHOOK INTER] INTER_WEBHOOK_SECRET não configurado');
      return res.*);
    }

    // 2. Validar assinatura HMAC (o header exato pode variar)
    const _signature =
      req.headers['x-signature'] || req.headers['x-inter-signature'] || req.headers['signature'];
    const _payload = JSON.stringify(req.body);

    console.log(
      `🔐 [WEBHOOK INTER] Headers recebidos:`,
      Object.keys(req.headers).filter((h) => h.includes('sig'))
    );
    console.log(`🔐 [WEBHOOK INTER] Signature header: ${signature ? 'presente' : 'ausente'}`);

    // Em desenvolvimento, permitir webhooks sem assinatura para testes
    const _isDevelopment = process.env.NODE_ENV == 'development';

    if (signature) {
      if (!validateInterHMAC(payload, signature as string)) {
        console.error('❌ [WEBHOOK INTER] Assinatura HMAC inválida');
        return res.*);
      }
      console.log('✅ [WEBHOOK INTER] Assinatura HMAC válida');
    }
else if (!isDevelopment) {
      console.warn('⚠️ [WEBHOOK INTER] Assinatura ausente em produção');
      return res.*);
    }
else {
      console.log('🔧 [WEBHOOK INTER] Modo desenvolvimento - assinatura não obrigatória');
    }

    // 3. Usar payload já parseado pelo express.json()
    const _webhookData = req.body;

    // 4. Validar schema
    const _validationResult = interWebhookSchema.safeParse(webhookData);
    if (!validationResult.success) {
      console.warn(
        '⚠️ [WEBHOOK INTER] Schema inválido, processando mesmo assim:',
        validationResult.error.errors
      );
    }

    codigoSolicitacao = webhookData.codigoSolicitacao;
    const _situacao = webhookData.situacao;

    console.log(
      `🏦 [WEBHOOK INTER] Evento para codigoSolicitacao: ${codigoSolicitacao}, situacao: ${situacao}`
    );

    // 5. Salvar callback na tabela inter_callbacks
    await db.execute(sql`
      INSERT INTO inter_callbacks (
        codigo_solicitacao,
  _evento,
  _payload,
  _processado,
        created_at
      ) VALUES (
        ${codigoSolicitacao},
        ${situacao},
        ${payload},
        ${false},
        NOW()
      )
    `);

    // 6. Responder rapidamente ao webhook
    res.status(200).json({
      message: 'Webhook recebido e será processado',
      codigoSolicitacao: codigoSolicitacao,
    });

    // 7. Processar em background
    setImmediate(async () => {
      try {
        await processInterWebhookEvent(codigoSolicitacao!, webhookData, startTime);
      }
catch (error) {
        console.error(`❌ [WEBHOOK INTER] Erro no processamento em background:`, error);

        // Marcar como erro no banco
        await db.execute(sql`
          UPDATE inter_callbacks 
          SET erro = ${error instanceof Error ? error.message : 'Unknown error'} 
          WHERE codigo_solicitacao = ${codigoSolicitacao} 
          AND created_at >= NOW() - INTERVAL '1 minute'
        `);
      }
    });
  }
catch (error) {
    console.error('❌ [WEBHOOK INTER] Erro inesperado:', error);

    // Salvar erro se conseguimos extrair o codigoSolicitacao
    if (codigoSolicitacao) {
      try {
        await db.execute(sql`
          INSERT INTO inter_callbacks (
            codigo_solicitacao,
  _evento,
  _payload,
  _processado,
  _erro,
            created_at
          ) VALUES (
            ${codigoSolicitacao},
            ${'error'},
            ${JSON.stringify(req.body) || ''},
            ${false},
            ${error instanceof Error ? error.message : 'Unknown error'},
            NOW()
          )
        `);
      }
catch (logError) {
        console.error('❌ [WEBHOOK INTER] Falha ao salvar erro:', logError);
      }
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Processa evento do webhook do Banco Inter em background
 */
async function processInterWebhookEvent(
  codigoSolicitacao: string,
  webhookData: unknown,
  startTime: number
) {
  console.log(`🔄 [WEBHOOK INTER] Processando evento para ${codigoSolicitacao}`);

  const _situacao = webhookData.situacao;
  const _valorPago = webhookData.valorPago || webhookData.valorTotalRecebido;
  const _dataPagamento = webhookData.dataPagamento;
  const _origemRecebimento = webhookData.origemRecebimento;

  // PAM V1.0 - TRANSAÇÃO ATÔMICA: Envolver todas as operações de escrita em uma única transação
  await db.transaction(async (tx) => {
    // Atualizar registro na tabela inter_collections
    const _updateResult = await tx.execute(sql`
      UPDATE inter_collections 
      SET 
        situacao = ${situacao},
        data_situacao = ${dataPagamento || 'NOW()'},
        valor_total_recebido = ${valorPago || null},
        origem_recebimento = ${origemRecebimento || null},
        updated_at = NOW()
      WHERE codigo_solicitacao = ${codigoSolicitacao}
      RETURNING id
    `);

    if (updateResult.length == 0) {
      console.warn(
        `⚠️ [WEBHOOK INTER] Nenhum registro encontrado para codigoSolicitacao: ${codigoSolicitacao}`
      );
    }
else {
      console.log(`✅ [WEBHOOK INTER] Status atualizado para ${codigoSolicitacao}: ${situacao}`);
    }

    // Buscar proposta relacionada para atualizações adicionais
    const _collection = await tx.execute(sql`
      SELECT ic.proposta_id, ic.numero_parcela, ic.total_parcelas, p.status as proposta_status
      FROM inter_collections ic
      JOIN propostas p ON p.id = ic.proposta_id
      WHERE ic.codigo_solicitacao = ${codigoSolicitacao}
      LIMIT 1
    `);

    if (collection.length > 0) {
      const { proposta_id, numero_parcela, total_parcelas, proposta_status } =
        collection[0] as unknown;

      // Se foi pago, verificar se todas as parcelas foram pagas
      if (situacao == 'PAGO' || situacao == 'RECEBIDO') {
        // PAM V1.0 - RECONCILIAÇÃO CRÍTICA: Sincronizar status entre inter_collections e parcelas
        // Esta é a ponte que falta para unificar nossa fonte da verdade
        console.log(
          `🔄 [RECONCILIAÇÃO PAM V1.0] Sincronizando pagamento para parcela ${numero_parcela} da proposta ${proposta_id}`
        );

        // Atualizar o status da parcela correspondente para 'pago'
        const _updateParcelaResult = await tx.execute(sql`
          UPDATE parcelas 
          SET 
            status = 'pago',
            data_pagamento = ${dataPagamento || 'NOW()'},
            updated_at = NOW()
          WHERE proposta_id = ${proposta_id}
          AND numero_parcela = ${numero_parcela}
          RETURNING id
        `);

        if (updateParcelaResult.length > 0) {
          console.log(
            `✅ [RECONCILIAÇÃO PAM V1.0] Parcela ${numero_parcela} da proposta ${proposta_id} marcada como PAGA na tabela parcelas`
          );
        }
else {
          console.error(
            `❌ [RECONCILIAÇÃO PAM V1.0] ERRO CRÍTICO: Não foi possível atualizar parcela ${numero_parcela} da proposta ${proposta_id}`
          );
        }

        const _allPaid = await tx.execute(sql`
          SELECT COUNT(*) as total_paid
          FROM inter_collections 
          WHERE proposta_id = ${proposta_id}
          AND (situacao = 'PAGO' OR situacao = 'RECEBIDO')
        `);

        const _totalPaidCount = (allPaid[0] as unknown)?.total_paid || 0;

        // Se todas as parcelas foram pagas, atualizar status da proposta
        if (totalPaidCount == total_parcelas) {
          await tx.execute(sql`
            UPDATE propostas 
            SET status = 'pago', updated_at = NOW()
            WHERE id = ${proposta_id}
          `);

          console.log(`🎉 [WEBHOOK INTER] Proposta ${proposta_id} totalmente paga!`);
        }
      }
    }

    // Marcar callback como processado
    await tx.execute(sql`
      UPDATE inter_callbacks 
      SET 
        processado = ${true},
        processed_at = NOW()
      WHERE codigo_solicitacao = ${codigoSolicitacao}
      AND created_at >= NOW() - INTERVAL '1 minute'
    `);
  });

  console.log(
    `✅ [WEBHOOK INTER] Processamento concluído para ${codigoSolicitacao} em ${Date.now() - startTime}ms`
  );
}

/**
 * GET /api/webhooks/health
 * Health check para verificar se o serviço de webhooks está ativo
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'webhooks',
    timestamp: new Date().toISOString(),
  });
});

export default router;
