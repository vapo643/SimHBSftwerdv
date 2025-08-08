#!/usr/bin/env node

/**
 * Script de Monitoramento Contínuo de Qualidade
 * Monitora alterações nos arquivos e executa verificações automaticamente
 */

import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Cores para console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Arquivos para monitorar
const WATCH_PATTERNS = [
  'client/src/**/*.{ts,tsx,js,jsx}',
  'server/**/*.{ts,js}',
  'shared/**/*.{ts,js}'
];

// Arquivos para ignorar
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}'
];

let isChecking = false;
let pendingCheck = false;

/**
 * Executa verificação de qualidade em um arquivo
 */
async function checkFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  console.log(`\n${colors.blue}📝 Arquivo modificado: ${relativePath}${colors.reset}`);
  
  try {
    // Verifica ESLint
    console.log(`${colors.yellow}🔍 Verificando ESLint...${colors.reset}`);
    const { stdout: eslintOut, stderr: eslintErr } = await execAsync(
      `npx eslint "${filePath}" --quiet`,
      { encoding: 'utf8' }
    ).catch(e => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));
    
    if (eslintOut || eslintErr) {
      console.log(`${colors.red}❌ ESLint encontrou problemas:${colors.reset}`);
      console.log(eslintOut || eslintErr);
      
      // Tenta corrigir automaticamente
      console.log(`${colors.yellow}🔧 Tentando corrigir automaticamente...${colors.reset}`);
      await execAsync(`npx eslint "${filePath}" --fix --quiet`).catch(() => {});
    } else {
      console.log(`${colors.green}✅ ESLint: OK${colors.reset}`);
    }
    
    // Verifica Prettier
    console.log(`${colors.yellow}🎨 Verificando Prettier...${colors.reset}`);
    const { stdout: prettierOut } = await execAsync(
      `npx prettier --check "${filePath}"`,
      { encoding: 'utf8' }
    ).catch(e => ({ stdout: e.stdout || '' }));
    
    if (!prettierOut.includes('Checking formatting...')) {
      console.log(`${colors.yellow}🎨 Formatando com Prettier...${colors.reset}`);
      await execAsync(`npx prettier --write "${filePath}"`);
      console.log(`${colors.green}✅ Prettier: Formatado${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Prettier: OK${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Erro ao verificar arquivo:${colors.reset}`, error.message);
  }
}

/**
 * Executa verificação completa do projeto
 */
async function fullCheck() {
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.magenta}🚀 VERIFICAÇÃO COMPLETA DO PROJETO${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  try {
    // Conta problemas do ESLint
    const { stdout: clientCount } = await execAsync('npx eslint client/src --quiet 2>&1 | wc -l');
    const { stdout: serverCount } = await execAsync('npx eslint server --quiet 2>&1 | wc -l');
    
    const totalProblems = parseInt(clientCount) + parseInt(serverCount);
    
    if (totalProblems > 0) {
      console.log(`${colors.yellow}⚠️  ${totalProblems} problemas encontrados no total${colors.reset}`);
      console.log(`   Client: ${clientCount.trim()} problemas`);
      console.log(`   Server: ${serverCount.trim()} problemas`);
    } else {
      console.log(`${colors.green}🎉 Nenhum problema encontrado!${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Erro na verificação completa:${colors.reset}`, error.message);
  }
}

/**
 * Processa fila de verificação
 */
async function processQueue() {
  if (isChecking) {
    pendingCheck = true;
    return;
  }
  
  isChecking = true;
  pendingCheck = false;
  
  // Aguarda um pouco para agrupar múltiplas mudanças
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await fullCheck();
  
  isChecking = false;
  
  if (pendingCheck) {
    processQueue();
  }
}

// Configuração do watcher
console.log(`${colors.blue}👁️  Monitoramento de Qualidade Iniciado${colors.reset}`);
console.log(`${colors.blue}   Monitorando: client/src, server, shared${colors.reset}`);
console.log(`${colors.blue}   Pressione Ctrl+C para parar${colors.reset}\n`);

const watcher = chokidar.watch(WATCH_PATTERNS, {
  ignored: IGNORE_PATTERNS,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

// Eventos do watcher
watcher
  .on('change', async (filePath) => {
    await checkFile(filePath);
  })
  .on('add', async (filePath) => {
    console.log(`${colors.green}➕ Novo arquivo: ${filePath}${colors.reset}`);
    await checkFile(filePath);
  })
  .on('unlink', (filePath) => {
    console.log(`${colors.red}➖ Arquivo removido: ${filePath}${colors.reset}`);
  })
  .on('error', error => {
    console.error(`${colors.red}Erro no watcher:${colors.reset}`, error);
  });

// Executa verificação inicial
fullCheck();

// Verificação periódica a cada 5 minutos
setInterval(() => {
  console.log(`\n${colors.blue}⏰ Verificação periódica...${colors.reset}`);
  processQueue();
}, 5 * 60 * 1000);

// Captura Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Encerrando monitoramento...${colors.reset}`);
  watcher.close();
  process.exit(0);
});