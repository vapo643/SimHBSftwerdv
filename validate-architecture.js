#!/usr/bin/env node

/**
 * Script de Validação Arquitetural
 * Executa dependency-cruiser para validar boundaries e regras de arquitetura
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function validateArchitecture() {
  console.log('🔍 Iniciando validação arquitetural...\n');
  console.log('📋 Analisando dependências e boundaries...\n');

  try {
    const { stdout, stderr } = await execAsync(
      'npx dependency-cruiser --config .dependency-cruiser.cjs server shared client/src',
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );

    if (stderr) {
      console.error('⚠️ Avisos durante a validação:\n', stderr);
    }

    console.log('✅ Validação concluída com sucesso!\n');
    console.log('📊 Relatório de validação:\n');
    console.log(stdout);

    process.exit(0);
  } catch (error) {
    console.error('❌ Falhas de validação arquitetural detectadas:\n');

    if (error.stdout) {
      console.log(error.stdout);
    }

    if (error.stderr) {
      console.error(error.stderr);
    }

    console.error('\n⚠️ Existem violações das regras arquiteturais que precisam ser corrigidas.');
    process.exit(1);
  }
}

// Executar validação
validateArchitecture();
