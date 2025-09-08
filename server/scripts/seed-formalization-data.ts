#!/usr/bin/env tsx
/**
 * PAM V1.0 - Script de Semeamento de Dados de Formalização
 * 
 * Objetivo: Popular a proposta de teste com documentos e condições financeiras
 * necessárias para validar a tela de formalização.
 * 
 * EXECUÇÃO: tsx server/scripts/seed-formalization-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Constantes do script
const PROPOSAL_ID = '29e80705-89bb-43a5-bbc8-960b3139939c';

// Dados de exemplo para formalização
const CONDICOES_DATA = {
  valor: 1006.00,
  prazo: 6,
  finalidade: 'Capital de giro para microempresa',
  modalidade: 'Crédito pessoal',
  taxaJuros: 2.85,
  taxaJurosAnual: 34.2,
  valorTac: 125.75,
  valorIof: 18.67,
  valorTotalFinanciado: 1150.42,
  valorLiquidoLiberado: 1006.00,
  jurosModalidade: 'pre_fixado',
  periodicidadeCapitalizacao: 'mensal',
  pracaPagamento: 'São Paulo',
  formaPagamento: 'boleto',
  anoBase: 365,
  tarifaTed: 10.00
};

// Documentos de exemplo para inserir
const DOCUMENTOS_EXEMPLO = [
  {
    nome_arquivo: 'rg_frente.pdf',
    url: '/documents/proposta-29e80705-89bb-43a5-bbc8-960b3139939c/rg_frente.pdf',
    tipo: 'application/pdf',
    tamanho: 245760, // 240KB
  },
  {
    nome_arquivo: 'cpf_comprovante.pdf', 
    url: '/documents/proposta-29e80705-89bb-43a5-bbc8-960b3139939c/cpf_comprovante.pdf',
    tipo: 'application/pdf',
    tamanho: 189440, // 185KB
  },
  {
    nome_arquivo: 'comprovante_renda.pdf',
    url: '/documents/proposta-29e80705-89bb-43a5-bbc8-960b3139939c/comprovante_renda.pdf',
    tipo: 'application/pdf', 
    tamanho: 312320, // 305KB
  }
];

async function seedFormalizationData(): Promise<void> {
  console.log('\n🌱 [SEED] Iniciando semeamento de dados de formalização...');
  console.log(`📄 [SEED] Proposta alvo: ${PROPOSAL_ID}`);
  
  // Inicializar cliente Supabase
  const supabaseUrl = process.env.DATABASE_URL?.replace('postgresql://', 'https://').split('/')[2].replace(':5432', '') || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
  }
  
  // Configurar cliente direto do banco PostgreSQL via Supabase
  const supabase = createClient(
    `https://${process.env.DATABASE_URL.split('@')[1].split('/')[0].replace(':5432', '')}.supabase.co`,
    process.env.SUPABASE_ANON_KEY || '',
    {
      auth: { persistSession: false }
    }
  );

  try {
    console.log('\n📊 [SEED STEP 1] Verificando proposta existente...');
    
    // Verificar se a proposta existe
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, status, condicoes_data')
      .eq('id', PROPOSAL_ID)
      .single();
    
    if (propostaError || !proposta) {
      throw new Error(`Proposta ${PROPOSAL_ID} não encontrada: ${propostaError?.message}`);
    }
    
    console.log(`✅ [SEED] Proposta encontrada - Status: ${proposta.status}`);
    console.log(`📋 [SEED] Condições atuais: ${proposta.condicoes_data ? 'Existem' : 'NULL/Vazio'}`);

    console.log('\n💰 [SEED STEP 2] Atualizando condições financeiras...');
    
    // Atualizar condicoes_data da proposta
    const { error: updateError } = await supabase
      .from('propostas')
      .update({ condicoes_data: CONDICOES_DATA })
      .eq('id', PROPOSAL_ID);
    
    if (updateError) {
      throw new Error(`Erro ao atualizar condições financeiras: ${updateError.message}`);
    }
    
    console.log(`✅ [SEED] Condições financeiras atualizadas com ${Object.keys(CONDICOES_DATA).length} campos`);

    console.log('\n📁 [SEED STEP 3] Verificando documentos existentes...');
    
    // Verificar documentos existentes
    const { data: docsExistentes, error: docsError } = await supabase
      .from('proposta_documentos')
      .select('id, nome_arquivo')
      .eq('proposta_id', PROPOSAL_ID);
    
    if (docsError) {
      throw new Error(`Erro ao verificar documentos: ${docsError.message}`);
    }
    
    console.log(`📄 [SEED] Documentos existentes: ${docsExistentes?.length || 0}`);

    if (docsExistentes && docsExistentes.length > 0) {
      console.log('⚠️  [SEED] Documentos já existem. Pulando inserção...');
    } else {
      console.log('\n📤 [SEED STEP 4] Inserindo documentos de exemplo...');
      
      // Inserir documentos de exemplo
      const documentosParaInserir = DOCUMENTOS_EXEMPLO.map(doc => ({
        proposta_id: PROPOSAL_ID,
        nome_arquivo: doc.nome_arquivo,
        url: doc.url,
        tipo: doc.tipo,
        tamanho: doc.tamanho,
        created_at: new Date().toISOString(),
      }));
      
      const { error: insertError } = await supabase
        .from('proposta_documentos')
        .insert(documentosParaInserir);
      
      if (insertError) {
        throw new Error(`Erro ao inserir documentos: ${insertError.message}`);
      }
      
      console.log(`✅ [SEED] ${DOCUMENTOS_EXEMPLO.length} documentos inseridos com sucesso`);
    }

    console.log('\n🔍 [SEED STEP 5] Validação final...');
    
    // Verificação final
    const { data: propostaFinal } = await supabase
      .from('propostas')
      .select('condicoes_data')
      .eq('id', PROPOSAL_ID)
      .single();
    
    const { data: documentosFinal } = await supabase
      .from('proposta_documentos')
      .select('id, nome_arquivo')
      .eq('proposta_id', PROPOSAL_ID);
    
    console.log('\n🎯 [SEED] RESULTADO FINAL:');
    console.log(`✅ Condições financeiras: ${propostaFinal?.condicoes_data ? 'COMPLETAS' : 'AUSENTES'}`);
    console.log(`✅ Documentos carregados: ${documentosFinal?.length || 0}`);
    console.log(`✅ Proposta pronta para formalização: ${(propostaFinal?.condicoes_data && documentosFinal && documentosFinal.length > 0) ? 'SIM' : 'NÃO'}`);
    
    console.log('\n🏆 [SEED] Semeamento concluído com sucesso!');
    console.log(`🔗 [SEED] Teste a tela: /formalizacao/acompanhamento/${PROPOSAL_ID}`);
    
  } catch (error) {
    console.error('\n❌ [SEED ERROR] Falha no semeamento:', error);
    process.exit(1);
  }
}

// Executar script
if (require.main === module) {
  seedFormalizationData()
    .then(() => {
      console.log('\n✨ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script falhou:', error);
      process.exit(1);
    });
}

export { seedFormalizationData };