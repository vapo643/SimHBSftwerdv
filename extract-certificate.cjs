/**
 * Script para extrair certificado e chave privada de arquivo .pfx
 * Uso: node extract-certificate.cjs nome_arquivo.pfx senha_certificado
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('🔐 EXTRATOR DE CERTIFICADO INTER');
console.log('Converte .pfx para formato de secrets');
console.log('========================================\n');

// Verificar argumentos
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('❌ Uso: node extract-certificate.cjs <arquivo.pfx> [senha]');
  console.log('📁 Arquivos .pfx disponíveis:');
  
  const files = fs.readdirSync('.').filter(f => f.endsWith('.pfx'));
  if (files.length === 0) {
    console.log('   Nenhum arquivo .pfx encontrado na pasta atual');
    console.log('   Faça upload do arquivo .pfx primeiro');
  } else {
    files.forEach(f => console.log(`   - ${f}`));
    console.log(`\n💡 Exemplo: node extract-certificate.cjs ${files[0]} sua_senha`);
  }
  process.exit(1);
}

const pfxFile = args[0];
const password = args[1] || '';

// Verificar se arquivo existe
if (!fs.existsSync(pfxFile)) {
  console.log(`❌ Arquivo não encontrado: ${pfxFile}`);
  console.log('📁 Arquivos disponíveis:');
  fs.readdirSync('.').filter(f => f.endsWith('.pfx')).forEach(f => console.log(`   - ${f}`));
  process.exit(1);
}

console.log(`📋 Processando arquivo: ${pfxFile}`);
console.log(`🔑 Senha fornecida: ${password ? '***' : 'Nenhuma'}`);

// Verificar se OpenSSL está disponível
try {
  execSync('openssl version', { stdio: 'ignore' });
  console.log('✅ OpenSSL encontrado');
} catch (error) {
  console.log('❌ OpenSSL não encontrado. Tentando instalar...');
  try {
    execSync('apt update && apt install -y openssl', { stdio: 'ignore' });
    console.log('✅ OpenSSL instalado com sucesso');
  } catch (installError) {
    console.log('❌ Falha ao instalar OpenSSL. Tentando método alternativo...');
  }
}

try {
  console.log('\n🔄 Extraindo certificado...');
  
  // Extrair certificado
  const certCommand = password 
    ? `openssl pkcs12 -in "${pfxFile}" -clcerts -nokeys -out temp_cert.pem -password pass:"${password}"`
    : `openssl pkcs12 -in "${pfxFile}" -clcerts -nokeys -out temp_cert.pem -nodes`;
  
  execSync(certCommand);
  
  // Extrair chave privada
  console.log('🔄 Extraindo chave privada...');
  const keyCommand = password
    ? `openssl pkcs12 -in "${pfxFile}" -nocerts -nodes -out temp_key.pem -password pass:"${password}"`
    : `openssl pkcs12 -in "${pfxFile}" -nocerts -nodes -out temp_key.pem`;
  
  execSync(keyCommand);
  
  // Ler arquivos extraídos
  let certContent = '';
  let keyContent = '';
  
  if (fs.existsSync('temp_cert.pem')) {
    certContent = fs.readFileSync('temp_cert.pem', 'utf8');
    fs.unlinkSync('temp_cert.pem'); // Limpar arquivo temporário
  }
  
  if (fs.existsSync('temp_key.pem')) {
    keyContent = fs.readFileSync('temp_key.pem', 'utf8');
    fs.unlinkSync('temp_key.pem'); // Limpar arquivo temporário
  }
  
  // Processar conteúdo do certificado
  const certMatch = certContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  const certificate = certMatch ? certMatch[0].trim() : '';
  
  // Processar conteúdo da chave privada
  const keyMatch = keyContent.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/) ||
                   keyContent.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/);
  const privateKey = keyMatch ? keyMatch[0].trim() : '';
  
  console.log('\n========================================');
  console.log('✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO');
  console.log('========================================\n');
  
  if (certificate) {
    console.log('📋 INTER_CERTIFICATE:');
    console.log('   Copie este valor para o secret INTER_CERTIFICATE:');
    console.log('   ----------------------------------------');
    console.log(certificate);
    console.log('   ----------------------------------------\n');
  } else {
    console.log('❌ Certificado não encontrado no arquivo');
  }
  
  if (privateKey) {
    console.log('🔑 INTER_PRIVATE_KEY:');
    console.log('   Copie este valor para o secret INTER_PRIVATE_KEY:');
    console.log('   ----------------------------------------');
    console.log(privateKey);
    console.log('   ----------------------------------------\n');
  } else {
    console.log('❌ Chave privada não encontrada no arquivo');
  }
  
  if (certificate && privateKey) {
    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('1. Copiar o CERTIFICADO acima para o secret INTER_CERTIFICATE');
    console.log('2. Copiar a CHAVE PRIVADA acima para o secret INTER_PRIVATE_KEY');
    console.log('3. Configurar os outros secrets (CLIENT_ID, CLIENT_SECRET)');
    console.log('4. Testar a conexão');
    
    // Salvar em arquivo para referência
    const outputFile = `certificado_extraido_${Date.now()}.txt`;
    const output = `INTER_CERTIFICATE:\n${certificate}\n\nINTER_PRIVATE_KEY:\n${privateKey}\n`;
    fs.writeFileSync(outputFile, output);
    console.log(`5. Backup salvo em: ${outputFile}`);
    
  } else {
    console.log('❌ Falha na extração. Verifique:');
    console.log('   - Se a senha está correta');
    console.log('   - Se o arquivo .pfx é válido');
    console.log('   - Se o arquivo é do Banco Inter');
  }
  
} catch (error) {
  console.log('\n❌ ERRO DURANTE A EXTRAÇÃO:');
  console.log(error.message);
  
  if (error.message.includes('invalid password') || error.message.includes('MAC verify failure')) {
    console.log('\n💡 POSSÍVEL PROBLEMA: Senha incorreta');
    console.log('   - Verifique se a senha do certificado está correta');
    console.log('   - A senha foi fornecida pelo banco quando baixou o .pfx');
  } else if (error.message.includes('No such file')) {
    console.log('\n💡 POSSÍVEL PROBLEMA: Arquivo não encontrado');
    console.log('   - Verifique se o nome do arquivo está correto');
    console.log('   - Certifique-se que fez upload do arquivo .pfx');
  } else {
    console.log('\n💡 SOLUÇÕES:');
    console.log('   1. Tentar novamente com senha correta');
    console.log('   2. Baixar novo certificado do portal Inter');
    console.log('   3. Verificar se arquivo não está corrompido');
  }
  
  // Limpar arquivos temporários
  ['temp_cert.pem', 'temp_key.pem'].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
}