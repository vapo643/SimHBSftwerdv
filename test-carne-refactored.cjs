console.log('\n📋 =================[ TESTE CARNÊ REFATORADO ]==================');
console.log('📋 OBJETIVO: Verificar que o Mock Queue executa Worker real');
console.log('📋 ESPERADO: Ver logs [WORKER:PDF] no console do servidor');
console.log('📋 =============================================================\n');

// Usar token estático para teste (já usado no sistema)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU2NzlmZDM4LWFmNGItNDFlZC1iMmJhLTQ2NjllZWExM2EyNCIsImVtYWlsIjoiYWRtaW5Ac2ltcGl4LmNvbS5iciIsInJvbGUiOiJBRE1JTiIsIm5vbWUiOiJBZG1pbiBTaW1waXgiLCJpYXQiOjE3MzY5NDgyMDksImV4cCI6MTczNjk1MTgwOX0.p1s8-V7WuB7EPQU-YcBRtFIo4kEEwlKRLVAGlVB5pNQ';

async function testCarneGeneration() {
  try {
    console.log('1️⃣ Solicitando geração de carnê para proposta 902183dd-b5d1-4e20-8a72-79d3d3559d4d...');
    console.log('   (Esta proposta tem 24 boletos no sistema)\n');
    
    const response = await fetch('http://localhost:5000/api/propostas/902183dd-b5d1-4e20-8a72-79d3d3559d4d/gerar-carne', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('2️⃣ Resposta da API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.jobId) {
      console.log(`\n3️⃣ Job criado com sucesso! ID: ${data.jobId}`);
      console.log('⏳ Aguardando processamento do Worker (8 segundos)...');
      console.log('   ⚠️  OBSERVE O CONSOLE DO SERVIDOR PARA VER OS LOGS [WORKER:PDF]\n');
      
      // Aguardar processamento
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Verificar status do job
      console.log('4️⃣ Verificando status do job...');
      const statusResponse = await fetch(`http://localhost:5000/api/jobs/${data.jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      });
      
      const status = await statusResponse.json();
      console.log('\n📊 Status do Job:');
      console.log(JSON.stringify(status, null, 2));
      
      if (status.status === 'completed') {
        console.log('\n✅ SUCESSO! Job concluído!');
        console.log('🎯 Mock Queue executou o Worker real!');
        console.log('📄 Carnê gerado e disponível para download!');
        
        if (status.result?.url) {
          console.log(`\n📥 URL do Carnê: ${status.result.url}`);
        }
      } else if (status.status === 'failed') {
        console.log('\n⚠️ Job falhou:', status.error || status.failedReason);
        console.log('   Isso pode indicar que dados reais estão faltando (refatoração funcionou!)');
      } else {
        console.log('\n⏳ Job ainda em processamento. Status:', status.status);
      }
    } else {
      console.log('\n❌ Erro na criação do job:', data.error || data.message);
    }
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
  }
}

console.log('🚀 Iniciando teste em 2 segundos...\n');
console.log('📌 IMPORTANTE: Observe o console do servidor para ver os logs do Worker!\n');
setTimeout(testCarneGeneration, 2000);
