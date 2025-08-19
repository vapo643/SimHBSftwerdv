#!/usr/bin/env node
/**
 * PAM V1.0 - Script de Teste para Status Contextual
 * Valida que a Tela de Cobranças está lendo da nova tabela status_contextuais
 */

const { Client } = require("pg");

// Usar DATABASE_URL do ambiente
const databaseUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:I8vJjyNJYBTI@ep-polished-fire-a52jbvd4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const client = new Client({
  connectionString: databaseUrl,
});

// Conectar ao banco
client.connect();

async function testarStatusContextual() {
  console.log("🎯 PAM V1.0 - TESTE DE STATUS CONTEXTUAL");
  console.log("=====================================\n");

  try {
    // 1. Buscar uma proposta elegível para cobrança
    const queryPropostas = `
      SELECT id, numero_proposta, status, cliente_nome
      FROM propostas
      WHERE status IN ('BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE', 'pronto_pagamento')
      AND deleted_at IS NULL
      LIMIT 1
    `;
    
    const resultPropostas = await client.query(queryPropostas);
    
    if (!resultPropostas.rows.length) {
      console.log("❌ Nenhuma proposta elegível encontrada");
      await client.end();
      process.exit(1);
    }

    const proposta = resultPropostas.rows[0];
    console.log("📋 Proposta selecionada para teste:");
    console.log(`   ID: ${proposta.id}`);
    console.log(`   Número: ${proposta.numero_proposta}`);
    console.log(`   Cliente: ${proposta.cliente_nome}`);
    console.log(`   Status Legado: ${proposta.status}\n`);

    // 2. Verificar se já existe status contextual
    const queryStatusExistente = `
      SELECT * FROM status_contextuais
      WHERE proposta_id = $1 AND contexto = 'cobrancas'
      ORDER BY atualizado_em DESC
      LIMIT 1
    `;
    
    const resultStatus = await client.query(queryStatusExistente, [proposta.id]);
    let statusAnterior = resultStatus.rows[0]?.status || proposta.status;
    console.log(`📍 Status Contextual Atual: ${statusAnterior}\n`);

    // 3. Inserir novo status contextual de teste
    const novoStatus = "TESTE_COBRANCA_" + Date.now();
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
        'cobrancas',
        novoStatus,
        statusAnterior,
        'PAM V1.0 - Teste de leitura contextual',
        JSON.stringify({
          teste: true,
          timestamp: new Date().toISOString(),
          script: "test-status-contextual.cjs"
        })
      ]);
    } catch (errorInsert) {
      console.log("❌ Erro ao inserir status contextual:", errorInsert);
      await client.end();
      process.exit(1);
    }

    console.log("✅ Status contextual inserido com sucesso\n");

    // 4. Fazer requisição à API de cobranças
    console.log("🌐 Testando endpoint /api/cobrancas...");
    
    const response = await fetch("http://localhost:5000/api/cobrancas", {
      headers: {
        "Content-Type": "application/json",
      }
    });

    if (!response.ok) {
      console.log("❌ Erro na API:", response.status, response.statusText);
      process.exit(1);
    }

    const cobrancas = await response.json();
    
    // 5. Verificar se a proposta retornou com o novo status
    const propostaRetornada = cobrancas.find(c => c.id === proposta.id);
    
    if (!propostaRetornada) {
      console.log("⚠️  Proposta não encontrada na resposta da API");
      console.log("   (Pode não ter parcelas ou boletos emitidos)");
    } else {
      console.log("📊 Resultado do teste:");
      console.log(`   Status retornado: ${propostaRetornada.status}`);
      
      if (propostaRetornada.status === novoStatus) {
        console.log("   ✅ SUCESSO! API está lendo da tabela status_contextuais!");
      } else {
        console.log(`   ❌ FALHA! API retornou status diferente`);
        console.log(`   Esperado: ${novoStatus}`);
        console.log(`   Recebido: ${propostaRetornada.status}`);
      }
    }

    // 6. Limpar dados de teste - restaurar status anterior
    console.log("\n🧹 Limpando dados de teste...");
    
    // Deletar o registro de teste
    const queryDelete = `
      DELETE FROM status_contextuais
      WHERE proposta_id = $1 AND contexto = 'cobrancas' AND status = $2
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
          'cobrancas',
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

    console.log("\n=====================================");
    console.log("🎯 TESTE CONCLUÍDO");
    
    if (propostaRetornada?.status === novoStatus) {
      console.log("✅ A Tela de Cobranças está operando com a nova arquitetura!");
      process.exit(0);
    } else {
      console.log("⚠️  Verificação manual necessária");
      process.exit(0);
    }

  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
    process.exit(1);
  }
}

// Executar teste
testarStatusContextual();