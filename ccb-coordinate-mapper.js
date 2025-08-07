#!/usr/bin/env node

/**
 * 🎯 Ferramenta de Mapeamento Manual de Coordenadas CCB
 * Permite testar coordenadas específicas campo por campo
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PROPOSAL_ID = '6492cfeb-8b66-4fa7-beb6-c7998be61b78';

// Coordenadas atuais (que estão erradas)
const currentCoordinates = {
  nomeCliente: { x: 120, y: 722, size: 12 },
  cpfCliente: { x: 120, y: 697, size: 11 },
  valorEmprestimo: { x: 200, y: 602, size: 12 },
  numeroParcelas: { x: 180, y: 572, size: 11 },
  valorParcela: { x: 200, y: 542, size: 11 },
  dataEmissao: { x: 100, y: 192, size: 10 }
};

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function generateTestCCB(adjustments) {
  try {
    console.log('🧪 Gerando CCB de teste...');
    
    // Importar e executar diretamente
    const { ccbGenerationService } = await import('./server/services/ccbGenerationService.ts');
    const result = await ccbGenerationService.generateCCBWithAdjustments(PROPOSAL_ID, adjustments);
    
    if (result.success) {
      console.log('✅ CCB gerado!');
      console.log(`📁 Arquivo: ${result.pdfPath}`);
      
      const publicUrl = await ccbGenerationService.getPublicUrl(result.pdfPath);
      if (publicUrl) {
        console.log(`🔗 URL: ${publicUrl}`);
        console.log('\n🔗 COPIE ESTE LINK E ABRA NO NAVEGADOR PARA VER O RESULTADO:\n');
        console.log(`${publicUrl}\n`);
      }
      return true;
    } else {
      console.error('❌ Erro:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

async function mapField() {
  console.log('\n🎯 MAPEAMENTO MANUAL DE COORDENADAS CCB');
  console.log('==========================================');
  
  while (true) {
    console.log('\n📋 Campos disponíveis:');
    console.log('1. nomeCliente (Nome do cliente)');
    console.log('2. cpfCliente (CPF)');
    console.log('3. valorEmprestimo (Valor do empréstimo)');
    console.log('4. numeroParcelas (Número de parcelas)');
    console.log('5. valorParcela (Valor da parcela)');
    console.log('6. dataEmissao (Data de emissão)');
    console.log('7. Gerar CCB com coordenadas atuais');
    console.log('8. Mostrar coordenadas atuais');
    console.log('9. Sair');
    
    const choice = await question('\n👉 Escolha um campo para ajustar (1-9): ');
    
    if (choice === '9') {
      console.log('👋 Tchau!');
      break;
    }
    
    if (choice === '7') {
      // Gerar CCB com coordenadas atuais
      const adjustments = Object.entries(currentCoordinates).map(([fieldName, coords]) => ({
        fieldName,
        deltaX: coords.x - 120, // Base x
        deltaY: coords.y - 680, // Base y  
        newSize: coords.size
      }));
      
      await generateTestCCB(adjustments);
      continue;
    }
    
    if (choice === '8') {
      console.log('\n📍 Coordenadas atuais:');
      Object.entries(currentCoordinates).forEach(([field, coords]) => {
        console.log(`${field}: x=${coords.x}, y=${coords.y}, size=${coords.size}`);
      });
      continue;
    }
    
    const fieldMap = {
      '1': 'nomeCliente',
      '2': 'cpfCliente', 
      '3': 'valorEmprestimo',
      '4': 'numeroParcelas',
      '5': 'valorParcela',
      '6': 'dataEmissao'
    };
    
    const fieldName = fieldMap[choice];
    if (!fieldName) {
      console.log('❌ Opção inválida!');
      continue;
    }
    
    const current = currentCoordinates[fieldName];
    console.log(`\n🎯 Ajustando: ${fieldName}`);
    console.log(`📍 Atual: x=${current.x}, y=${current.y}, size=${current.size}`);
    
    const newX = await question(`👉 Nova coordenada X (atual: ${current.x}): `);
    const newY = await question(`👉 Nova coordenada Y (atual: ${current.y}): `);
    const newSize = await question(`👉 Novo tamanho fonte (atual: ${current.size}): `);
    
    // Atualizar coordenadas
    if (newX) currentCoordinates[fieldName].x = parseInt(newX);
    if (newY) currentCoordinates[fieldName].y = parseInt(newY);
    if (newSize) currentCoordinates[fieldName].size = parseInt(newSize);
    
    console.log(`✅ ${fieldName} atualizado para: x=${currentCoordinates[fieldName].x}, y=${currentCoordinates[fieldName].y}, size=${currentCoordinates[fieldName].size}`);
    
    // Perguntar se quer gerar teste
    const testNow = await question('\n🧪 Gerar CCB de teste agora? (s/n): ');
    
    if (testNow.toLowerCase() === 's') {
      const adjustment = {
        fieldName,
        deltaX: currentCoordinates[fieldName].x - 120,
        deltaY: currentCoordinates[fieldName].y - 680,
        newSize: currentCoordinates[fieldName].size
      };
      
      await generateTestCCB([adjustment]);
    }
  }
  
  rl.close();
}

// Iniciar ferramenta
mapField().catch(console.error);