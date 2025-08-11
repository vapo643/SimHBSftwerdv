/**
 * TESTE DE RENDERIZAÇÃO DOS CAMPOS DE ENDEREÇO NO CCB
 */

import { CCBGenerationService } from './server/services/ccbGenerationService.js';
import { drizzleClient } from './server/db.js';
import { propostas } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testAddressRendering() {
  try {
    console.log('=== TESTE DE RENDERIZAÇÃO DE ENDEREÇO NO CCB ===\n');
    
    const proposalId = '88a44696-9b63-42ee-aa81-15f9519d24cb';
    
    // Buscar dados da proposta
    const [proposal] = await drizzleClient
      .select()
      .from(propostas)
      .where(eq(propostas.id, proposalId));
    
    if (!proposal) {
      console.error('❌ Proposta não encontrada');
      return;
    }
    
    console.log('📊 Dados de endereço no banco:');
    console.log('• Endereço completo:', proposal.cliente_data?.endereco);
    console.log('• Logradouro:', proposal.cliente_data?.logradouro);
    console.log('• Número:', proposal.cliente_data?.numero);
    console.log('• Bairro:', proposal.cliente_data?.bairro);
    console.log('• CEP:', proposal.cliente_data?.cep);
    console.log('• Cidade:', proposal.cliente_data?.cidade);
    console.log('• Estado:', proposal.cliente_data?.estado);
    console.log('• UF:', proposal.cliente_data?.uf);
    
    // Testar geração do CCB
    console.log('\n🚀 Gerando CCB...');
    const service = new CCBGenerationService();
    const result = await service.generateCCB(proposalId);
    
    if (result.success) {
      console.log('✅ CCB gerado com sucesso!');
      console.log('📄 Arquivo:', result.filename);
      console.log('🔗 URL:', result.publicUrl);
      console.log('\n⚠️ IMPORTANTE: Verifique o PDF para confirmar se os campos de endereço estão posicionados em:');
      console.log('• Endereço: X:100, Y:670 (fonte 8)');
      console.log('• CEP: X:270, Y:670 (fonte 9)');
      console.log('• Cidade: X:380, Y:670 (fonte 10)');
      console.log('• UF: X:533, Y:670 (fonte 9)');
    } else {
      console.error('❌ Erro ao gerar CCB:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    process.exit(0);
  }
}

testAddressRendering();