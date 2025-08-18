#!/usr/bin/env node

/**
 * Script para criar e fazer upload de CCB de teste
 * PAM V1.0 - Validação da Tela de Pagamentos
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function criarCcbTeste() {
  try {
    console.log('🧪 [CCB TEST] Criando CCB de teste para proposta 902183dd...');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Criar um PDF de teste simples (usando texto como simulação)
    const testContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 150
>>
stream
BT
/F1 12 Tf
72 720 Td
(CCB ASSINADA DE TESTE) Tj
0 -20 Td
(Proposta: 902183dd-b5d1-4e20-8a72-79d3d3559d4d) Tj
0 -20 Td
(Cliente: Gabriel de Jesus Santana Serri) Tj
0 -20 Td
(Data: ${new Date().toISOString()}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000201 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
404
%%EOF
`;

    // 2. Converter para Buffer
    const pdfBuffer = Buffer.from(testContent, 'utf8');
    
    // 3. Definir caminho exato solicitado
    const storagePath = 'ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d/ccb_assinada_teste.pdf';
    
    console.log(`📁 [UPLOAD] Fazendo upload para: ${storagePath}`);
    
    // 4. Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ [UPLOAD] Erro no upload:', uploadError.message);
      return false;
    }

    console.log('✅ [UPLOAD] Ficheiro carregado com sucesso!');
    console.log('   Path:', uploadData.path);

    // 5. Verificar se o arquivo foi salvo
    const { data: listData, error: listError } = await supabase.storage
      .from('documents')
      .list('ccb/assinadas/902183dd-b5d1-4e20-8a72-79d3d3559d4d');

    if (listError) {
      console.error('❌ [VERIFY] Erro ao verificar upload:', listError.message);
      return false;
    }

    const testFile = listData?.find(f => f.name === 'ccb_assinada_teste.pdf');
    if (!testFile) {
      console.error('❌ [VERIFY] Ficheiro não encontrado após upload');
      return false;
    }

    console.log('✅ [VERIFY] Ficheiro verificado no storage:', testFile.name);
    console.log('   Tamanho:', testFile.metadata?.size || 'N/A', 'bytes');
    
    return storagePath;

  } catch (error) {
    console.error('❌ [CCB TEST] Erro crítico:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  criarCcbTeste().then(result => {
    if (result) {
      console.log('\n🎉 [SUCCESS] CCB de teste criado com sucesso!');
      console.log('   Storage Path:', result);
      process.exit(0);
    } else {
      console.error('\n❌ [FAILED] Falha na criação da CCB de teste');
      process.exit(1);
    }
  });
}

module.exports = { criarCcbTeste };