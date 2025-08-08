/**
 * 🧪 TESTE PRÁTICO DAS SUAS COORDENADAS
 * Execute no navegador (Console) quando estiver logado
 */

// Simular teste das suas coordenadas atuais
const testarCoordenadas = async () => {
  console.log("🎯 Testando suas coordenadas com dados reais...");
  
  // Dados de teste que revelam problemas
  const dadosReais = {
    nomeCliente: "Maria Fernanda Santos de Oliveira", // Nome longo
    cpfCliente: "123.456.789-00",
    valorEmprestimo: "R$ 125.750,00", // Valor com muitos dígitos
    numeroParcelas: "48",
    dataEmissao: "08 de agosto de 2025"
  };

  try {
    // Teste suas coordenadas
    const response = await fetch('/api/ccb-calibration/test-positions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ testData: dadosReais })
    });
    
    const result = await response.json();
    console.log("✅ PDF de teste gerado:", result.testPath);
    console.log("📋 Campos testados:", result.testedFields);
    
    // Gerar grid para análise
    const gridResponse = await fetch('/api/ccb-calibration/generate-grid', {
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gridSpacing: 50,
        showCoordinates: true,
        highlightFields: ['nomeCliente', 'valorEmprestimo', 'cpfCliente']
      })
    });
    
    const gridResult = await gridResponse.json();
    console.log("📐 Grid de análise gerado:", gridResult.gridPath);
    
    console.log("\n🎯 PRÓXIMOS PASSOS:");
    console.log("1. Baixe os PDFs gerados");
    console.log("2. Verifique posicionamento dos campos");  
    console.log("3. Ajuste coordenadas no ccbFieldMapping.ts");
    console.log("4. Execute teste novamente");
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
};

// Para executar: testarCoordenadas()
console.log("Execute: testarCoordenadas()");