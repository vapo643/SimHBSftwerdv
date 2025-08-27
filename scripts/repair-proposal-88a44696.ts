#!/usr/bin/env tsx

/**
 * PAM V1.0 - SCRIPT DE REPARO DE DADOS CORROMPIDOS
 *
 * MISSÃO: Reparar a proposta `88a44696-9b63-42ee-aa81-15f9519d24cb`
 * extraindo dados do JSON `cliente_data` e populando campos relacionais vazios.
 *
 * EVIDÊNCIA DO PROBLEMA:
 * - nomeCliente: 'Sem nome'
 * - cpfCliente: ''
 * - Outros campos de cliente podem estar vazios/NULL
 *
 * ESTRATÉGIA:
 * 1. SELECT na proposta corrompida
 * 2. Extrair dados do JSON cliente_data
 * 3. UPDATE nos campos relacionais com dados do JSON
 */

import { db } from '../server/lib/supabase';
import { propostas } from '../shared/schema';
import { eq } from 'drizzle-orm';

const PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb';

async function repairProposal() {
  console.log('🔧 PAM V1.0 - INICIANDO REPARO DE DADOS CORROMPIDOS');
  console.log(`🎯 Alvo: Proposta ${PROPOSTA_ID}`);
  console.log('='.repeat(80));

  try {
    // ETAPA 1: SELECT na proposta corrompida
    console.log('📋 ETAPA 1: Buscando proposta corrompida...');

    const propostaCorrupta = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, PROPOSTA_ID))
      .limit(1);

    if (propostaCorrupta.length == 0) {
      console.error('❌ ERRO: Proposta não encontrada no banco de dados');
      process.exit(1);
    }

    const proposta = propostaCorrupta[0];

    console.log('✅ Proposta encontrada!');
    console.log('📊 DADOS ATUAIS (CORROMPIDOS):');
    console.log(`   - clienteNome: "${proposta.clienteNome}"`);
    console.log(`   - clienteCpf: "${proposta.clienteCpf}"`);
    console.log(`   - clienteEmail: "${proposta.clienteEmail}"`);
    console.log(`   - clienteTelefone: "${proposta.clienteTelefone}"`);

    // ETAPA 2: Analisar dados JSON disponíveis
    console.log('\n📋 ETAPA 2: Analisando dados JSON disponíveis...');

    console.log(`🔍 Cliente Data (raw): "${proposta.clienteData}"`);
    console.log(`🔍 Condicoes Data (raw): "${proposta.condicoesData}"`);

    // Tentar múltiplas estratégias de recuperação de dados
    let dadosEncontrados = null;

    // Estratégia 1: Parsear cliente_data se for JSON válido
    if (proposta.clienteData && proposta.clienteData !== '[object Object]') {
      try {
        dadosEncontrados = JSON.parse(proposta.clienteData);
        console.log('✅ Dados encontrados em cliente_data!');
      }
catch (e) {
        console.log('⚠️ cliente_data não é JSON válido');
      }
    }

    // Estratégia 2: Parsear condicoes_data (pode ter dados do cliente)
    if (
      !dadosEncontrados &&
      proposta.condicoesData &&
      proposta.condicoesData !== '[object Object]'
    ) {
      try {
        const condicoesJson = JSON.parse(proposta.condicoesData);
        if (condicoesJson.cliente || condicoesJson.clienteNome) {
          dadosEncontrados = condicoesJson;
          console.log('✅ Dados encontrados em condicoes_data!');
        }
      }
catch (e) {
        console.log('⚠️ condicoes_data não é JSON válido');
      }
    }

    // Estratégia 3: Verificar se temos dados suficientes para reparo
    if (!dadosEncontrados) {
      console.error('❌ ERRO: Nenhuma fonte de dados válida foi encontrada');
      console.log('🔍 Impossível realizar reparo sem dados de origem');
      process.exit(1);
    }

    let clienteDataJson = dadosEncontrados;

    console.log('📊 DADOS DO JSON (FONTE DA VERDADE):');
    console.log(`   - nome: "${clienteDataJson.nome || 'VAZIO'}"`);
    console.log(`   - cpf: "${clienteDataJson.cpf || 'VAZIO'}"`);
    console.log(`   - email: "${clienteDataJson.email || 'VAZIO'}"`);
    console.log(`   - telefone: "${clienteDataJson.telefone || 'VAZIO'}"`);

    // Validar se temos dados suficientes para reparo
    if (!clienteDataJson.nome || !clienteDataJson.cpf) {
      console.error('❌ ERRO: JSON cliente_data também está incompleto (faltam nome ou CPF)');
      console.log('🔍 Conteúdo completo do JSON:', JSON.stringify(clienteDataJson, null, 2));
      process.exit(1);
    }

    // ETAPA 3: UPDATE nos campos relacionais
    console.log('\n📋 ETAPA 3: Executando UPDATE nos campos relacionais...');

    const dadosParaReparo = {
      clienteNome: clienteDataJson.nome,
      clienteCpf: clienteDataJson.cpf,
      clienteEmail: clienteDataJson.email || null,
      clienteTelefone: clienteDataJson.telefone || null,
      clienteDataNascimento: clienteDataJson.dataNascimento || null,
      clienteRenda: clienteDataJson.renda || null,
      clienteRg: clienteDataJson.rg || null,
      clienteOrgaoEmissor: clienteDataJson.orgaoEmissor || null,
      clienteEstadoCivil: clienteDataJson.estadoCivil || null,
      clienteNacionalidade: clienteDataJson.nacionalidade || null,
      clienteCep: clienteDataJson.cep || null,
      clienteEndereco: clienteDataJson.endereco || null,
      clienteOcupacao: clienteDataJson.ocupacao || null,
    };

    console.log('🔄 Executando UPDATE com os seguintes dados:');
    Object.entries(dadosParaReparo).forEach(([campo, valor]) => {
      if (valor) {
        console.log(`   - ${campo}: "${valor}"`);
      }
    });

    const updateResult = await db
      .update(propostas)
      .set(dadosParaReparo)
      .where(eq(propostas.id, PROPOSTA_ID))
      .returning();

    if (updateResult.length == 0) {
      console.error('❌ ERRO: Falha no UPDATE - nenhuma linha afetada');
      process.exit(1);
    }

    console.log('✅ UPDATE executado com sucesso!');

    // ETAPA 4: Verificação final
    console.log('\n📋 ETAPA 4: Verificação final - SELECT pós-reparo...');

    const propostaReparada = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, PROPOSTA_ID))
      .limit(1);

    const reparada = propostaReparada[0];

    console.log('📊 DADOS APÓS REPARO:');
    console.log(`   - clienteNome: "${reparada.clienteNome}"`);
    console.log(`   - clienteCpf: "${reparada.clienteCpf}"`);
    console.log(`   - clienteEmail: "${reparada.clienteEmail}"`);
    console.log(`   - clienteTelefone: "${reparada.clienteTelefone}"`);

    // Verificar se o reparo foi bem-sucedido
    const reparoComSucesso =
      reparada.clienteNome &&
      reparada.clienteNome !== 'Sem nome' &&
      reparada.clienteCpf &&
      reparada.clienteCpf !== '';

    if (reparoComSucesso) {
      console.log('\n🎉 SUCESSO! Proposta reparada com êxito!');
      console.log('🔧 PAM V1.0 - FASE 1 CONCLUÍDA');
    }
else {
      console.error('\n❌ FALHA! Reparo não funcionou conforme esperado');
      process.exit(1);
    }
  }
catch (error) {
    console.error('💥 ERRO CRÍTICO durante reparo:', error);
    process.exit(1);
  }
}

// Executar reparo automaticamente
repairProposal()
  .then(() => {
    console.log('\n✅ Script de reparo finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script de reparo falhou:', error);
    process.exit(1);
  });

export { repairProposal };
