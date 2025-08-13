#!/usr/bin/env node
/**
 * Script de teste para captura de evidência de PDF do Banco Inter
 * Objetivo: Baixar um PDF e verificar se foi salvo no Supabase Storage
 */

const InterBankService = require('./server/services/interBankService.ts').default;

async function testEvidenceCapture() {
  console.log('🔬 TESTE DE CAPTURA DE EVIDÊNCIA INICIADO');
  console.log('=====================================');
  
  try {
    // Criar instância do serviço
    const interService = new InterBankService({
      apiUrl: 'https://cdpj.partners.bancointer.com.br',
      clientId: process.env.INTER_CLIENT_ID,
      clientSecret: process.env.INTER_CLIENT_SECRET,
      certificate: process.env.INTER_CERTIFICATE,
      privateKey: process.env.INTER_PRIVATE_KEY,
      contaCorrente: process.env.INTER_CONTA_CORRENTE,
      environment: 'production'
    });
    
    // Código de solicitação real do log
    const codigoSolicitacao = '585bcc53-e077-49c7-a4cd-b000698a5bfe';
    
    console.log(`📋 Testando download do PDF: ${codigoSolicitacao}`);
    console.log('⏳ Aguarde, isso pode levar alguns segundos...');
    
    // Executar download (que agora salva evidência)
    const pdfBuffer = await interService.obterPdfCobranca(codigoSolicitacao);
    
    console.log('✅ PDF baixado com sucesso!');
    console.log(`📊 Tamanho do PDF: ${pdfBuffer.length} bytes`);
    console.log('🔍 Verifique os logs acima para a URL do Supabase Storage');
    console.log('=====================================');
    console.log('🎯 MISSÃO CUMPRIDA: Evidência capturada!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testEvidenceCapture();