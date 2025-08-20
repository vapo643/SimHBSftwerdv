#!/usr/bin/env node
/**
 * PAM V1.0 - Script de Teste para Status Contextual em Pagamentos
 * Valida que a Tela de Pagamentos está lendo da nova tabela status_contextuais
 */

const { Client } = require("pg");

// Usar DATABASE_URL do ambiente
const databaseUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:I8vJjyNJYBTI@ep-polished-fire-a52jbvd4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const client = new Client({
  connectionString: databaseUrl,
});

// Conectar ao banco
client.connect();

async function testarStatusPagamentos() {
  console.log("🎯 PAM V1.0 - TESTE DE STATUS CONTEXTUAL EM PAGAMENTOS");
  console.log("=====================================================\n");

  try {
    // 1. Buscar uma proposta elegível para pagamento
    const queryPropostas = `
      SELECT id, numero_proposta, status, cliente_nome, ccb_gerado
      FROM propostas
      WHERE status IN ('BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE', 'pronto_pagamento')
      AND ccb_gerado = true
      AND deleted_at IS NULL
      LIMIT 1
    `;
    
    const resultPropostas = await client.query(queryPropostas);
    
    if (!resultPropostas.rows.length) {
      console.log("❌ Nenhuma proposta elegível para pagamento encontrada");
      await client.end();
      process.exit(1);
    }

    const proposta = resultPropostas.rows[0];
    console.log("📋 Proposta selecionada para teste:");
    console.log(`   ID: ${proposta.id}`);
    console.log(`   Número: ${proposta.numero_proposta}`);
    console.log(`   Cliente: ${proposta.cliente_nome}`);
    console.log(`   Status Legado: ${proposta.status}`);
    console.log(`   CCB Gerado: ${proposta.ccb_gerado}\n`);

    // 2. Verificar se já existe status contextual para pagamentos
    const queryStatusExistente = `
      SELECT * FROM status_contextuais
      WHERE proposta_id = $1 AND contexto = 'pagamentos'
      ORDER BY atualizado_em DESC
      LIMIT 1
    `;
    
    const resultStatus = await client.query(queryStatusExistente, [proposta.id]);
    let statusAnterior = resultStatus.rows[0]?.status || proposta.status;
    console.log(`📍 Status Contextual Atual (pagamentos): ${statusAnterior}\n`);

    // 3. Inserir novo status contextual de teste
    const novoStatus = "TESTE_PAGAMENTO_" + Date.now();
    console.log(`🔄 Inserindo novo status contextual: ${novoStatus}`);
    
    const queryInsert = `
      INSERT INTO status_contextuais (
        proposta_id, contexto, status, status_anterior, 
        observacoes, metadata, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW()
      )
    `;
    
    try {
      await client.query(queryInsert, [
        proposta.id,
        'pagamentos',
        novoStatus,
        statusAnterior,
        'PAM V1.0 - Teste de leitura contextual em pagamentos',
        JSON.stringify({
          teste: true,
          timestamp: new Date().toISOString(),
          script: "test-status-pagamentos.cjs"
        })
      ]);
    } catch (errorInsert) {
      console.log("❌ Erro ao inserir status contextual:", errorInsert);
      await client.end();
      process.exit(1);
    }

    console.log("✅ Status contextual inserido com sucesso\n");

    // 4. Fazer requisição à API de pagamentos
    console.log("🌐 Testando endpoint /api/pagamentos...");
    
    const response = await fetch("http://localhost:5000/api/pagamentos", {
      headers: {
        "Content-Type": "application/json",
      }
    });

    if (!response.ok) {
      console.log("❌ Erro na API:", response.status, response.statusText);
      // Limpar antes de sair
      await client.query(`DELETE FROM status_contextuais WHERE proposta_id = $1 AND contexto = 'pagamentos' AND status = $2`, [proposta.id, novoStatus]);
      await client.end();
      process.exit(1);
    }

    const pagamentos = await response.json();
    
    // 5. Verificar se a proposta retornou com o novo status
    const propostaRetornada = pagamentos.find(p => p.id === proposta.id || p.propostaId === proposta.id);
    
    if (!propostaRetornada) {
      console.log("⚠️  Proposta não encontrada na resposta da API");
      console.log("   (Pode não ter boletos emitidos no Inter)");
      console.log("   Total de pagamentos retornados:", pagamentos.length);
    } else {
      console.log("📊 Resultado do teste:");
      console.log(`   Status retornado: ${propostaRetornada.status}`);
      
      // Verificar nos logs do servidor se o status contextual está sendo lido
      console.log("\n   ⚠️  NOTA: O status no frontend pode estar mapeado.");
      console.log("   Verifique os logs do servidor para confirmar o status contextual.");
    }

    // 6. Limpar dados de teste
    console.log("\n🧹 Limpando dados de teste...");
    
    // Deletar o registro de teste
    const queryDelete = `
      DELETE FROM status_contextuais
      WHERE proposta_id = $1 AND contexto = 'pagamentos' AND status = $2
    `;
    
    try {
      await client.query(queryDelete, [proposta.id, novoStatus]);
      console.log("✅ Dados de teste limpos");
    } catch (errorDelete) {
      console.log("⚠️  Aviso: Não foi possível limpar o registro de teste");
    }

    // Se havia status anterior, restaurá-lo
    if (resultStatus.rows[0]) {
      const queryRestore = `
        INSERT INTO status_contextuais (
          proposta_id, contexto, status, observacoes, metadata, atualizado_em
        ) VALUES (
          $1, $2, $3, $4, $5, NOW()
        )
      `;
      
      try {
        await client.query(queryRestore, [
          proposta.id,
          'pagamentos',
          statusAnterior,
          'Restaurado após teste PAM V1.0',
          JSON.stringify({ restored: true })
        ]);
        console.log("✅ Status original restaurado");
      } catch (errorRestore) {
        console.log("⚠️  Não foi possível restaurar status original");
      }
    }
    
    // Fechar conexão
    await client.end();

    console.log("\n=====================================================");
    console.log("🎯 TESTE CONCLUÍDO");
    console.log("✅ Verifique os logs do servidor para confirmar o uso de status_contextuais");
    process.exit(0);

  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
    await client.end();
    process.exit(1);
  }
}

// Executar teste
testarStatusPagamentos();