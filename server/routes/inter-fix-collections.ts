import { Router } from "express";
import { jwtAuthMiddleware, AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { interBankService } from "../services/interBankService";
import { db } from "../lib/supabase";
import { interCollections, propostas } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

const router = Router();

/**
 * ENDPOINT EMERGENCIAL: Regenerar boletos com códigos válidos da API Inter
 * POST /api/inter/fix-collections/:propostaId
 */
router.post(
  "/fix-collections/:propostaId",
  jwtAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;
      
      // Verificar permissões
      if (req.user?.role !== "ADMINISTRADOR") {
        return res.status(403).json({
          error: "Apenas administradores podem regenerar boletos",
        });
      }

      console.log(`🚨 [FIX COLLECTIONS] Iniciando regeneração para proposta: ${propostaId}`);

      // Buscar proposta
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      if (!proposta) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }

      // Buscar boletos atuais (possivelmente com códigos inválidos)
      const boletoesAtuais = await db
        .select()
        .from(interCollections)
        .where(eq(interCollections.propostaId, propostaId));

      console.log(`🔍 [FIX COLLECTIONS] Encontrados ${boletoesAtuais.length} boletos atuais`);
      
      // Verificar se são códigos inválidos
      const codigosInvalidos = boletoesAtuais.filter(b => 
        !b.codigoSolicitacao.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      );

      if (codigosInvalidos.length === 0) {
        return res.json({ 
          message: "Todos os boletos já possuem códigos válidos", 
          totalBoletos: boletoesAtuais.length 
        });
      }

      console.log(`⚠️ [FIX COLLECTIONS] ${codigosInvalidos.length} boletos com códigos inválidos encontrados`);

      // Desativar boletos atuais
      await db
        .update(interCollections)
        .set({ isActive: false })
        .where(eq(interCollections.propostaId, propostaId));

      // Preparar dados para criação de novos boletos
      const parcelas = boletoesAtuais.map(boleto => ({
        numero: boleto.numeroParcela || 1,
        valor: parseFloat(boleto.valorNominal.toString()),
        vencimento: boleto.dataVencimento,
      })).sort((a, b) => a.numero - b.numero);

      console.log(`🔄 [FIX COLLECTIONS] Criando ${parcelas.length} novos boletos na API Inter...`);

      const novosBoletosGerados = [];

      for (let i = 0; i < parcelas.length; i++) {
        const parcela = parcelas[i];
        
        try {
          const seuNumero = `${propostaId.slice(0, 18)}-${String(parcela.numero).padStart(3, '0')}`;
          
          console.log(`📄 [FIX COLLECTIONS] Criando boleto ${i + 1}/${parcelas.length} - Parcela ${parcela.numero}`);

          // Criar cobrança na API Inter
          const collectionData = await interBankService.criarCobranca({
            seuNumero,
            valorNominal: parcela.valor,
            dataVencimento: parcela.vencimento,
            nomePagador: proposta.clienteNome || "Cliente",
            cpfCnpjPagador: proposta.clienteCpf || "000.000.000-00",
            telefonePagador: proposta.clienteTelefone || "",
            emailPagador: proposta.clienteEmail || "",
          });

          console.log(`✅ [FIX COLLECTIONS] Boleto criado com código válido: ${collectionData.codigoSolicitacao}`);

          // Salvar no banco com código válido
          const novoBoleto = await db
            .insert(interCollections)
            .values({
              propostaId,
              codigoSolicitacao: collectionData.codigoSolicitacao, // UUID válido da API Inter
              seuNumero,
              valorNominal: parcela.valor.toString(),
              dataVencimento: parcela.vencimento,
              situacao: collectionData.situacao || "EM_PROCESSAMENTO",
              numeroParcela: parcela.numero,
              totalParcelas: parcelas.length,
              isActive: true,
            })
            .returning();

          novosBoletosGerados.push(novoBoleto[0]);

        } catch (error) {
          console.error(`❌ [FIX COLLECTIONS] Erro ao criar boleto ${parcela.numero}:`, error);
        }
      }

      // Atualizar proposta
      await db
        .update(propostas)
        .set({
          interBoletoGerado: true,
          interBoletoGeradoEm: new Date(),
          atualizadoEm: new Date(),
        })
        .where(eq(propostas.id, propostaId));

      console.log(`🎉 [FIX COLLECTIONS] Regeneração completa! ${novosBoletosGerados.length} boletos criados`);

      res.json({
        success: true,
        message: `${novosBoletosGerados.length} boletos regenerados com códigos válidos`,
        totalBoletosCriados: novosBoletosGerados.length,
        boletosComCodigosValidos: novosBoletosGerados.map(b => ({
          codigoSolicitacao: b.codigoSolicitacao,
          numeroParcela: b.numeroParcela,
          valor: b.valorNominal,
          vencimento: b.dataVencimento,
        })),
      });

    } catch (error) {
      console.error("❌ [FIX COLLECTIONS] Erro geral:", error);
      res.status(500).json({ 
        error: "Erro ao regenerar boletos", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
);

export default router;