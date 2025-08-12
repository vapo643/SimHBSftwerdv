#!/usr/bin/env node
/**
 * Script para extrair e processar certificado do Banco Inter
 */

const fs = require('fs');

const INTER_CERTIFICATE = process.env.INTER_CERTIFICATE;
const INTER_PRIVATE_KEY = process.env.INTER_PRIVATE_KEY;

console.log('📋 ANÁLISE DO CERTIFICADO INTER');
console.log('================================\n');

function analisarTexto(texto, nome) {
  console.log(`\n${nome}:`);
  console.log('- Tamanho:', texto.length, 'caracteres');
  console.log('- Primeiros 100 chars:', texto.substring(0, 100));
  console.log('- Últimos 50 chars:', texto.substring(texto.length - 50));
  
  // Verificar se é Base64
  const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(texto.replace(/\s/g, ''));
  console.log('- Parece ser Base64?', isBase64);
  
  // Verificar se tem headers PEM
  const hasPemHeaders = texto.includes('BEGIN') && texto.includes('END');
  console.log('- Tem headers PEM?', hasPemHeaders);
  
  if (isBase64 && !hasPemHeaders) {
    try {
      const decoded = Buffer.from(texto, 'base64').toString('utf-8');
      console.log('- Decodificado tem headers PEM?', decoded.includes('BEGIN') && decoded.includes('END'));
      
      if (decoded.includes('BEGIN')) {
        console.log('✅ FORMATO CORRETO: Base64 contendo PEM');
        // Salvar versão decodificada
        fs.writeFileSync(`${nome}-decoded.pem`, decoded);
        console.log(`  Salvo em: ${nome}-decoded.pem`);
        return decoded;
      }
    } catch (e) {
      console.log('- Erro ao decodificar:', e.message);
    }
  }
  
  if (hasPemHeaders) {
    console.log('✅ FORMATO CORRETO: PEM direto');
    fs.writeFileSync(`${nome}-direct.pem`, texto);
    console.log(`  Salvo em: ${nome}-direct.pem`);
    return texto;
  }
  
  // Tentar forçar formato PEM
  if (!hasPemHeaders && texto.length > 100) {
    console.log('⚠️ Tentando adicionar headers PEM...');
    const lines = texto.match(/.{1,64}/g) || [];
    const pemFormatted = nome.includes('CERT') 
      ? `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`
      : `-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----`;
    
    fs.writeFileSync(`${nome}-forced.pem`, pemFormatted);
    console.log(`  Salvo em: ${nome}-forced.pem`);
    return pemFormatted;
  }
  
  return texto;
}

// Analisar certificado
const certProcessado = analisarTexto(INTER_CERTIFICATE, 'INTER_CERTIFICATE');

// Analisar chave privada
const keyProcessado = analisarTexto(INTER_PRIVATE_KEY, 'INTER_PRIVATE_KEY');

// Criar arquivo de configuração JSON
const config = {
  certificate: certProcessado,
  privateKey: keyProcessado,
  clientId: process.env.INTER_CLIENT_ID,
  clientSecret: process.env.INTER_CLIENT_SECRET,
  contaCorrente: process.env.INTER_CONTA_CORRENTE || "346470536"
};

fs.writeFileSync('certificate-debug.json', JSON.stringify(config, null, 2));
console.log('\n✅ Configuração salva em: certificate-debug.json');

console.log('\n📊 RESUMO:');
console.log('- Certificado processado:', certProcessado.substring(0, 50).includes('BEGIN') ? '✅' : '❌');
console.log('- Chave privada processada:', keyProcessado.substring(0, 50).includes('BEGIN') ? '✅' : '❌');