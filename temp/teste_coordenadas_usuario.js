/**
 * TESTE PRÁTICO COM SUAS COORDENADAS MANUAIS
 * Execute este código no console do navegador quando estiver logado
 */

async function testarSuasCoordenadas() {
  console.log("🎯 TESTANDO SUAS COORDENADAS MANUAIS");
  console.log("=" .repeat(50));
  
  // Dados de teste alinhados com campos do sistema
  const dadosTeste = {
    // PÁGINA 1 - Identificação
    numeroCedula: "PROP-2025-001",
    dataEmissao: "08/08/2025",
    finalidadeOperacao: "Empréstimo pessoal",
    
    // Dados do Cliente (suas coordenadas)
    nomeCliente: "Maria Fernanda Santos de Oliveira",
    cpfCliente: "123.456.789-00",
    rgCliente: "12.345.678-9",
    rgExpedidor: "SSP",
    rgUF: "SP",
    nacionalidade: "Brasileira",
    estadoCivil: "Casada",
    
    // Endereço (suas coordenadas)
    enderecoCliente: "Rua das Flores, 123",
    cepCliente: "12345-678",
    cidadeCliente: "São Paulo",
    ufCliente: "SP",
    
    // Dados do Credor
    razaoSocialCredor: "SIMPIX LTDA",
    cnpjCredor: "12.345.678/0001-90",
    
    // Condições Financeiras (suas coordenadas)
    valorPrincipal: "R$ 50.000,00",
    prazoAmortizacao: "24 meses",
    taxaJurosEfetivaMensal: "2,5%",
    taxaJurosEfetivaAnual: "34,48%",
    iof: "R$ 380,00",
    tac: "R$ 150,00",
    custoEfetivoTotal: "3,2% a.m.",
    
    // PÁGINA 2 - Dados Bancários
    bancoEmitente: "001",
    agenciaEmitente: "1234",
    contaEmitente: "12345-6",
    tipoContaEmitente: "Conta Corrente",
    chavePix: "123.456.789-00",
    
    // Parcelas (exemplo de 3)
    parcela1: "1/24 - 08/09/2025 - R$ 2.354,87",
    parcela2: "2/24 - 08/10/2025 - R$ 2.354,87",
    parcela3: "3/24 - 08/11/2025 - R$ 2.354,87"
  };
  
  console.log("\n📋 SUAS COORDENADAS MANUAIS:");
  console.log("Página 1:");
  console.log("  nomeCliente: X:55, Y:645");
  console.log("  cpfCliente: X:405, Y:645");
  console.log("  valorPrincipal: X:50, Y:350");
  console.log("Página 2:");
  console.log("  bancoEmitente: X:170, Y:660");
  console.log("  parcela1: X:110/270/470, Y:460");
  
  console.log("\n🧪 ENVIANDO PARA TESTE...");
  
  try {
    const response = await fetch('/api/ccb-calibration/test-user-coordinates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testData: dadosTeste,
        useUserCoordinates: true // Usa suas coordenadas manuais
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log("\n✅ TESTE CONCLUÍDO!");
      console.log("PDF gerado com suas coordenadas:", result.pdfPath);
      console.log("Total de campos mapeados:", result.fieldsCount);
      console.log("Páginas preenchidas:", result.pagesUsed);
      
      console.log("\n📊 CAMPOS TESTADOS:");
      result.testedFields?.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.name}: ${field.coordinate}`);
      });
      
    } else {
      console.error("❌ Erro no teste:", await response.text());
    }
    
  } catch (error) {
    console.error("❌ Erro:", error);
  }
  
  console.log("\n💡 PRÓXIMOS PASSOS:");
  console.log("1. Baixe o PDF gerado");
  console.log("2. Verifique se os campos estão nas posições corretas");
  console.log("3. Se precisar ajustar, edite ccbUserCoordinates.ts");
  console.log("4. Execute o teste novamente");
}

// Comparação rápida
function compararCoordenadas() {
  console.log("📊 COMPARAÇÃO: Suas Coordenadas vs Sistema Anterior");
  console.log("=" .repeat(50));
  
  const comparacao = [
    { campo: "nomeCliente", sua: "X:55, Y:645", antiga: "X:120, Y:680", diff: "X:-65, Y:-35" },
    { campo: "cpfCliente", sua: "X:405, Y:645", antiga: "X:120, Y:655", diff: "X:+285, Y:-10" },
    { campo: "valorPrincipal", sua: "X:50, Y:350", antiga: "X:200, Y:580", diff: "X:-150, Y:-230" },
    { campo: "prazoAmortizacao", sua: "X:50, Y:300", antiga: "X:180, Y:555", diff: "X:-130, Y:-255" }
  ];
  
  comparacao.forEach(item => {
    console.log(`\n${item.campo}:`);
    console.log(`  Sua coordenada: ${item.sua}`);
    console.log(`  Sistema antigo: ${item.antiga}`);
    console.log(`  Diferença: ${item.diff}`);
  });
  
  console.log("\n✅ Suas coordenadas são mais precisas e alinhadas com o template real!");
}

console.log("🚀 Execute: testarSuasCoordenadas()");
console.log("📊 Ou compare: compararCoordenadas()");