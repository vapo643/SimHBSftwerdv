/**
 * Helper para gerenciar certificados do Banco Inter
 * Funções: listar, extrair, validar, limpar
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('========================================');
console.log('🔐 CERTIFICADO HELPER - BANCO INTER');
console.log('Gerenciador de certificados .pfx');
console.log('========================================\n');

// Função para listar arquivos .pfx
function listPfxFiles() {
  console.log('📁 Arquivos .pfx disponíveis:');
  const files = fs.readdirSync('.').filter(f => f.endsWith('.pfx'));
  
  if (files.length === 0) {
    console.log('   ❌ Nenhum arquivo .pfx encontrado');
    console.log('   💡 Faça upload do arquivo .pfx do Banco Inter primeiro');
    return false;
  }
  
  files.forEach((file, index) => {
    const stats = fs.statSync(file);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`   ${index + 1}. ${file} (${size} KB)`);
  });
  
  return files;
}

// Função para verificar OpenSSL
function checkOpenSSL() {
  try {
    const version = execSync('openssl version', { encoding: 'utf8' });
    console.log(`✅ OpenSSL disponível: ${version.trim()}`);
    return true;
  } catch (error) {
    console.log('❌ OpenSSL não encontrado');
    console.log('🔧 Tentando instalar...');
    
    try {
      execSync('apt update && apt install -y openssl', { stdio: 'inherit' });
      console.log('✅ OpenSSL instalado com sucesso');
      return true;
    } catch (installError) {
      console.log('❌ Falha ao instalar OpenSSL');
      console.log('💡 Instale manualmente: apt install openssl');
      return false;
    }
  }
}

// Função para validar arquivo .pfx
function validatePfxFile(filename, password = '') {
  console.log(`\n🔍 Validando arquivo: ${filename}`);
  
  try {
    const command = password 
      ? `openssl pkcs12 -info -in "${filename}" -noout -password pass:"${password}"`
      : `openssl pkcs12 -info -in "${filename}" -noout -nodes`;
    
    execSync(command, { stdio: 'ignore' });
    console.log('✅ Arquivo .pfx válido');
    return true;
  } catch (error) {
    if (error.message.includes('MAC verify failure')) {
      console.log('❌ Senha incorreta ou arquivo corrompido');
    } else {
      console.log('❌ Arquivo .pfx inválido');
    }
    return false;
  }
}

// Função para extrair informações do certificado
function extractCertInfo(filename, password = '') {
  console.log(`\n📋 Extraindo informações do certificado: ${filename}`);
  
  try {
    // Extrair informações básicas
    const command = password
      ? `openssl pkcs12 -in "${filename}" -clcerts -nokeys -out temp_info.pem -password pass:"${password}"`
      : `openssl pkcs12 -in "${filename}" -clcerts -nokeys -out temp_info.pem -nodes`;
    
    execSync(command);
    
    // Ler informações do certificado
    const infoCommand = 'openssl x509 -in temp_info.pem -text -noout';
    const certInfo = execSync(infoCommand, { encoding: 'utf8' });
    
    // Extrair dados relevantes
    const subjectMatch = certInfo.match(/Subject: (.+)/);
    const issuerMatch = certInfo.match(/Issuer: (.+)/);
    const validFromMatch = certInfo.match(/Not Before: (.+)/);
    const validToMatch = certInfo.match(/Not After : (.+)/);
    
    console.log('📄 Informações do Certificado:');
    if (subjectMatch) console.log(`   Titular: ${subjectMatch[1].trim()}`);
    if (issuerMatch) console.log(`   Emissor: ${issuerMatch[1].trim()}`);
    if (validFromMatch) console.log(`   Válido de: ${validFromMatch[1].trim()}`);
    if (validToMatch) console.log(`   Válido até: ${validToMatch[1].trim()}`);
    
    // Verificar se está expirado
    const validTo = new Date(validToMatch ? validToMatch[1].trim() : '');
    const now = new Date();
    
    if (validTo < now) {
      console.log('⚠️  CERTIFICADO EXPIRADO!');
      console.log('💡 Solicite renovação no portal do Banco Inter');
    } else {
      const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
      console.log(`✅ Certificado válido (expira em ${daysUntilExpiry} dias)`);
    }
    
    // Limpar arquivo temporário
    if (fs.existsSync('temp_info.pem')) {
      fs.unlinkSync('temp_info.pem');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao extrair informações:', error.message);
    return false;
  }
}

// Função para limpar arquivos temporários
function cleanupTempFiles() {
  console.log('\n🧹 Limpando arquivos temporários...');
  
  const tempFiles = [
    'temp_cert.pem',
    'temp_key.pem', 
    'temp_info.pem',
    'certificado_extraido.txt'
  ];
  
  let cleaned = 0;
  tempFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      cleaned++;
    }
  });
  
  console.log(`✅ ${cleaned} arquivos temporários removidos`);
}

// Função principal
function main() {
  console.log('🎯 Opções disponíveis:');
  console.log('1. Listar arquivos .pfx');
  console.log('2. Validar arquivo .pfx');
  console.log('3. Extrair informações do certificado');
  console.log('4. Limpar arquivos temporários');
  console.log('5. Verificar OpenSSL');
  
  // Para simplificar, vamos executar todas as verificações
  console.log('\n🔄 Executando verificação completa...\n');
  
  // 1. Verificar OpenSSL
  if (!checkOpenSSL()) {
    return;
  }
  
  console.log('');
  
  // 2. Listar arquivos
  const files = listPfxFiles();
  if (!files) {
    return;
  }
  
  // 3. Se há apenas um arquivo, oferecer validação
  if (files.length === 1) {
    const filename = files[0];
    console.log(`\n💡 Encontrado: ${filename}`);
    console.log('🔍 Para extrair as chaves, use:');
    console.log(`   node extract-certificate.cjs ${filename} SUA_SENHA`);
    console.log('\n📋 Para validar primeiro, use:');
    console.log(`   node certificado-helper.cjs validate ${filename} SUA_SENHA`);
  } else {
    console.log('\n💡 Múltiplos arquivos encontrados.');
    console.log('🔍 Para extrair de um arquivo específico:');
    console.log('   node extract-certificate.cjs NOME_ARQUIVO.pfx SUA_SENHA');
  }
  
  console.log('\n📚 Comandos disponíveis:');
  console.log('   node extract-certificate.cjs arquivo.pfx senha  # Extrair chaves');
  console.log('   node certificado-helper.cjs validate arquivo.pfx senha  # Validar');
  console.log('   node certificado-helper.cjs clean  # Limpar temporários');
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
  main();
} else if (args[0] === 'validate' && args[1]) {
  const filename = args[1];
  const password = args[2] || '';
  validatePfxFile(filename, password);
  extractCertInfo(filename, password);
} else if (args[0] === 'clean') {
  cleanupTempFiles();
} else if (args[0] === 'info' && args[1]) {
  const filename = args[1];
  const password = args[2] || '';
  extractCertInfo(filename, password);
} else {
  console.log('❌ Comando inválido');
  console.log('💡 Use: node certificado-helper.cjs [validate|clean|info] [arquivo] [senha]');
}