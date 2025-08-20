#!/usr/bin/env node

/**
 * Script para migrar CCBs assinadas existentes para pasta organizada
 * Move de ccb/ para ccb/assinadas/
 */

const { createClient } = require('@supabase/supabase-js');
const { sql } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

async function migrarCCBsAssinadas() {
  try {
    console.log('🔄 [MIGRAÇÃO] Iniciando migração de CCBs assinadas...');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Buscar propostas com CCB assinada no banco
    const client = postgres(process.env.DATABASE_URL);
    const db = drizzle(client);
    
    const propostas = await db.execute(sql`
      SELECT id, cliente_nome, caminho_ccb_assinado, assinatura_eletronica_concluida
      FROM propostas 
      WHERE caminho_ccb_assinado IS NOT NULL 
        AND assinatura_eletronica_concluida = true
      ORDER BY id
    `);

    console.log(`📊 [MIGRAÇÃO] Encontradas ${propostas.length} propostas com CCB assinada`);

    let migradas = 0;
    let erros = 0;

    // 2. Para cada proposta, mover o arquivo
    for (const proposta of propostas) {
      try {
        const caminhoAtual = proposta.caminho_ccb_assinado;
        
        // Verificar se já está na pasta correta
        if (caminhoAtual.includes('ccb/assinadas/')) {
          console.log(`✅ [SKIP] ${proposta.id} já está organizada`);
          continue;
        }

        console.log(`🔄 [MIGRAÇÃO] Processando ${proposta.id}: ${caminhoAtual}`);

        // Baixar arquivo atual
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(caminhoAtual);

        if (downloadError) {
          console.error(`❌ [ERRO] Não foi possível baixar ${caminhoAtual}:`, downloadError.message);
          erros++;
          continue;
        }

        // Criar novo caminho organizado
        const nomeArquivo = caminhoAtual.split('/').pop();
        const novoCaminho = `ccb/assinadas/ccb_assinada_${proposta.id}_${Date.now()}.pdf`;

        // Upload para nova localização
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(novoCaminho, fileData, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error(`❌ [ERRO] Upload falhou para ${novoCaminho}:`, uploadError.message);
          erros++;
          continue;
        }

        // Atualizar banco de dados
        await db.execute(sql`
          UPDATE propostas 
          SET caminho_ccb_assinado = ${novoCaminho}, atualizado_em = NOW()
          WHERE id = ${proposta.id}
        `);

        // Remover arquivo antigo (opcional - comentado por segurança)
        // const { error: removeError } = await supabase.storage
        //   .from('documents')
        //   .remove([caminhoAtual]);

        console.log(`✅ [SUCESSO] ${proposta.id}: ${caminhoAtual} → ${novoCaminho}`);
        migradas++;

      } catch (error) {
        console.error(`❌ [ERRO] Falha ao processar ${proposta.id}:`, error.message);
        erros++;
      }
    }

    await client.end();

    console.log(`\n📊 [RESUMO DA MIGRAÇÃO]`);
    console.log(`   Total de propostas: ${propostas.length}`);
    console.log(`   Migradas com sucesso: ${migradas}`);
    console.log(`   Erros: ${erros}`);
    console.log(`\n✅ [MIGRAÇÃO] Concluída!`);

  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro crítico:', error);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  migrarCCBsAssinadas().then(() => {
    console.log('\n🎉 Migração finalizada. Execute o script check-storage-structure.cjs para verificar.');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Migração falhou:', error);
    process.exit(1);
  });
}

module.exports = { migrarCCBsAssinadas };