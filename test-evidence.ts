import { interBankService } from "./server/services/interBankService";

async function testEvidenceCapture() {
  console.log("🔬 TESTE DE CAPTURA DE EVIDÊNCIA");
  console.log("================================");
  
  const codigoSolicitacao = "585bcc53-e077-49c7-a4cd-b000698a5bfe";
  
  try {
    console.log(`📋 Baixando PDF: ${codigoSolicitacao}`);
    const pdfBuffer = await interBankService.obterPdfCobranca(codigoSolicitacao);
    console.log(`✅ PDF baixado: ${pdfBuffer.length} bytes`);
    console.log("🔍 Verifique os logs acima para a URL do Supabase");
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
  }
}

testEvidenceCapture();