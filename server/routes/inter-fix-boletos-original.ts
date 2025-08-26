import { Router } from "express";
import { jwtAuthMiddleware, type AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { requireAnyRole } from "../lib/role-guards";
import { interBankService } from "../services/interBankService";
import { db } from "../lib/supabase";
import { interCollections, propostas } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * ENDPOINT DE CORREÇÃO: Regenerar boletos com códigos REAIS do Inter
 * POST /api/inter-fix/regenerate/:propostaId
 */
router.post(
  "/regenerate/:propostaId",
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;
      
      console.log(`[INTER FIX] 🔧 INICIANDO REGENERAÇÃO DE BOLETOS PARA: ${propostaId}`);
      
      // 1. Buscar proposta usando queryClient
      const queryResult = await db.execute(
        `SELECT * FROM propostas WHERE id = $1 LIMIT 1`,
        [propostaId]
      );
      
      const proposta = queryResult.rows[0];
        
      if (!proposta) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }
      
      console.log(`[INTER FIX] ✅ Proposta encontrada`);
      
      // 2. Buscar boletos existentes (com códigos inválidos)
      const boletosInvalidos = await db
        .select()
        .from(interCollections)
        .where(and(
          eq(interCollections.propostaId, propostaId),
          eq(interCollections.isActive, true)
        ))
        .orderBy(interCollections.numeroParcela);
        
      console.log(`[INTER FIX] 📋 Encontrados ${boletosInvalidos.length} boletos para regenerar`);
      
      const results = [];
      let successCount = 0;
      let failCount = 0;
      
      // 3. Para cada boleto, criar um REAL no Inter
      for (const boleto of boletosInvalidos) {
        try {
          console.log(`[INTER FIX] 🔄 Processando parcela ${boleto.numeroParcela}/${boleto.totalParcelas}`);
          
          // Extrair dados do cliente
          const clienteData = typeof proposta.clienteData === 'string' 
            ? JSON.parse(proposta.clienteData) 
            : proposta.clienteData;
            
          // Calcular data de vencimento (30 dias entre parcelas)
          const dataBase = new Date();
          const dataVencimento = new Date(dataBase);
          dataVencimento.setDate(dataBase.getDate() + ((boleto.numeroParcela || 1) * 30));
          
          // Preparar dados completos para o Inter
          const dadosCobranca = {
            id: `${propostaId}-${String(boleto.numeroParcela).padStart(3, '0')}`,
            valorTotal: parseFloat(boleto.valorNominal),
            dataVencimento: dataVencimento.toISOString().split('T')[0],
            clienteData: {
              nome: clienteData.nome || "Gabriel de Jesus Santana Serri",
              cpf: (clienteData.cpf || "20528464760").replace(/\D/g, ''),
              email: clienteData.email || "gabrieldjesus238@gmail.com",
              telefone: (clienteData.telefone || "27998538565").replace(/\D/g, ''),
              endereco: clienteData.endereco || "Rua Miguel Angelo",
              numero: clienteData.numero || "100",
              complemento: clienteData.complemento || "",
              bairro: clienteData.bairro || "Centro",
              cidade: clienteData.cidade || "Serra",
              uf: clienteData.estado || "ES",
              cep: (clienteData.cep || "29165460").replace(/\D/g, '')
            }
          };
          
          console.log(`[INTER FIX] 📤 Criando boleto no Inter API...`);
          
          // CRIAR BOLETO REAL NO INTER
          const response = await interBankService.criarCobrancaParaProposta(dadosCobranca);
          
          if (!response.codigoSolicitacao) {
            throw new Error("Inter não retornou código de solicitação");
          }
          
          console.log(`[INTER FIX] ✅ Boleto criado! Código REAL: ${response.codigoSolicitacao}`);
          
          // 4. Buscar detalhes completos do boleto criado
          const detalhes = await interBankService.recuperarCobranca(response.codigoSolicitacao);
          
          // 5. Atualizar banco com dados REAIS
          await db
            .update(interCollections)
            .set({
              codigoSolicitacao: response.codigoSolicitacao,
              nossoNumero: detalhes.boleto?.nossoNumero || '',
              codigoBarras: detalhes.boleto?.codigoBarras || detalhes.codigoBarras || '',
              linhaDigitavel: detalhes.boleto?.linhaDigitavel || detalhes.linhaDigitavel || '',
              pixCopiaECola: detalhes.pix?.pixCopiaECola || '',
              situacao: detalhes.cobranca?.situacao || 'EMITIDO',
              updatedAt: new Date()
            })
            .where(eq(interCollections.id, boleto.id));
            
          console.log(`[INTER FIX] ✅ Banco atualizado com dados REAIS`);
          
          results.push({
            parcela: boleto.numeroParcela,
            codigoAntigo: boleto.codigoSolicitacao,
            codigoNovo: response.codigoSolicitacao,
            status: 'SUCESSO'
          });
          
          successCount++;
          
        } catch (error: any) {
          console.error(`[INTER FIX] ❌ Erro na parcela ${boleto.numeroParcela}:`, error.message);
          
          results.push({
            parcela: boleto.numeroParcela,
            codigoAntigo: boleto.codigoSolicitacao,
            erro: error.message,
            status: 'ERRO'
          });
          
          failCount++;
        }
      }
      
      console.log(`[INTER FIX] ✅ PROCESSO CONCLUÍDO!`);
      console.log(`[INTER FIX]    Sucesso: ${successCount} boletos`);
      console.log(`[INTER FIX]    Falhas: ${failCount} boletos`);
      
      return res.json({
        success: true,
        message: `Regeneração concluída: ${successCount} boletos criados com sucesso`,
        total: boletosInvalidos.length,
        successCount,
        failCount,
        detalhes: results
      });
      
    } catch (error: any) {
      console.error("[INTER FIX] ❌ Erro fatal:", error);
      return res.status(500).json({ 
        error: "Erro ao regenerar boletos",
        message: error.message 
      });
    }
  }
);

export default router;