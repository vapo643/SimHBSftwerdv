#!/usr/bin/env node
/**
 * PAM V1.0 - Script de Teste de Reconciliação Parcelas
 * Testa a sincronização entre inter_collections e parcelas via webhook
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.development' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testarReconciliacao() {
  console.log('🧪 [PAM V1.0 TEST] Iniciando teste de reconciliação...\n');
  
  try {
    // 1. Buscar uma proposta com boletos emitidos e parcelas
    const { rows: propostas } = await pool.query(`
      SELECT DISTINCT p.id, p.cliente_nome, p.status
      FROM propostas p
      INNER JOIN inter_collections ic ON ic.proposta_id = p.id
      INNER JOIN parcelas pa ON pa.proposta_id = p.id
      WHERE p.status = 'BOLETOS_EMITIDOS'
      AND ic.situacao = 'A_RECEBER'
      AND pa.status != 'pago'
      LIMIT 1
    `);
    
    if (propostas.length === 0) {
      console.log('❌ Nenhuma proposta elegível encontrada para teste');
      return;
    }
    
    const proposta = propostas[0];
    console.log(`✅ Proposta encontrada: ${proposta.id}`);
    console.log(`   Cliente: ${proposta.cliente_nome}`);
    console.log(`   Status: ${proposta.status}\n`);
    
    // 2. Buscar a primeira parcela não paga e seu boleto correspondente
    const { rows: parcelas } = await pool.query(`
      SELECT 
        pa.id as parcela_id, 
        pa.numero_parcela, 
        pa.status as parcela_status,
        pa.valor_parcela,
        ic.codigo_solicitacao,
        ic.situacao as boleto_situacao
      FROM parcelas pa
      INNER JOIN inter_collections ic ON ic.proposta_id = pa.proposta_id 
        AND ic.numero_parcela = pa.numero_parcela
      WHERE pa.proposta_id = $1
      AND pa.status != 'pago'
      AND ic.situacao = 'A_RECEBER'
      ORDER BY pa.numero_parcela
      LIMIT 1
    `, [proposta.id]);
    
    if (parcelas.length === 0) {
      console.log('❌ Nenhuma parcela elegível encontrada');
      return;
    }
    
    const parcela = parcelas[0];
    console.log(`📋 Parcela selecionada para teste:`);
    console.log(`   Parcela ID: ${parcela.parcela_id}`);
    console.log(`   Número: ${parcela.numero_parcela}`);
    console.log(`   Status atual: ${parcela.parcela_status}`);
    console.log(`   Código solicitação: ${parcela.codigo_solicitacao}`);
    console.log(`   Situação boleto: ${parcela.boleto_situacao}\n`);
    
    // 3. Simular webhook de pagamento
    console.log('🔄 Simulando webhook de pagamento do Banco Inter...\n');
    
    const webhookPayload = {
      codigoSolicitacao: parcela.codigo_solicitacao,
      situacao: 'RECEBIDO',
      valorPago: parcela.valor_parcela,
      dataPagamento: new Date().toISOString(),
      origemRecebimento: 'PIX'
    };
    
    console.log('📤 Enviando webhook para: http://localhost:5000/api/webhooks/inter');
    console.log('   Payload:', JSON.stringify(webhookPayload, null, 2));
    
    const response = await fetch('http://localhost:5000/api/webhooks/inter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (!response.ok) {
      console.error(`❌ Erro ao enviar webhook: ${response.status} ${response.statusText}`);
      return;
    }
    
    console.log('✅ Webhook enviado com sucesso\n');
    
    // 4. Aguardar processamento
    console.log('⏳ Aguardando 3 segundos para processamento...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Verificar se a reconciliação funcionou
    console.log('🔍 Verificando resultados da reconciliação:\n');
    
    // Verificar inter_collections
    const { rows: boletosAtualizados } = await pool.query(`
      SELECT codigo_solicitacao, situacao, valor_total_recebido
      FROM inter_collections
      WHERE codigo_solicitacao = $1
    `, [parcela.codigo_solicitacao]);
    
    const boletoAtualizado = boletosAtualizados[0];
    console.log('📊 Status do boleto (inter_collections):');
    console.log(`   Situação: ${boletoAtualizado.situacao} ${boletoAtualizado.situacao === 'RECEBIDO' ? '✅' : '❌'}`);
    console.log(`   Valor recebido: R$ ${boletoAtualizado.valor_total_recebido || 0}\n`);
    
    // Verificar parcelas - PONTO CRÍTICO DA RECONCILIAÇÃO
    const { rows: parcelasAtualizadas } = await pool.query(`
      SELECT id, numero_parcela, status, data_pagamento, valor_pago
      FROM parcelas
      WHERE id = $1
    `, [parcela.parcela_id]);
    
    const parcelaAtualizada = parcelasAtualizadas[0];
    console.log('🎯 Status da parcela (parcelas) - VERIFICAÇÃO CRÍTICA:');
    console.log(`   Status: ${parcelaAtualizada.status} ${parcelaAtualizada.status === 'pago' ? '✅ RECONCILIAÇÃO FUNCIONOU!' : '❌ RECONCILIAÇÃO FALHOU!'}`);
    console.log(`   Data pagamento: ${parcelaAtualizada.data_pagamento || 'NULL'}`);
    console.log(`   Valor pago: R$ ${parcelaAtualizada.valor_pago || 0}\n`);
    
    // 6. Resultado final
    if (boletoAtualizado.situacao === 'RECEBIDO' && parcelaAtualizada.status === 'pago') {
      console.log('🎉 SUCESSO TOTAL! A reconciliação PAM V1.0 está funcionando perfeitamente!');
      console.log('✅ Tabela inter_collections atualizada');
      console.log('✅ Tabela parcelas sincronizada');
      console.log('✅ Fonte única da verdade estabelecida');
    } else if (boletoAtualizado.situacao === 'RECEBIDO' && parcelaAtualizada.status !== 'pago') {
      console.log('⚠️ PROBLEMA DETECTADO: Webhook processou mas reconciliação falhou');
      console.log('✅ Tabela inter_collections atualizada');
      console.log('❌ Tabela parcelas NÃO foi sincronizada');
      console.log('🔧 Verifique os logs do servidor para erros de reconciliação');
    } else {
      console.log('❌ FALHA: Webhook não foi processado corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await pool.end();
  }
}

// Executar teste
testarReconciliacao().catch(console.error);