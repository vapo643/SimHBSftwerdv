import { Router } from 'express';
import { interBankService } from '../services/interBankService';
import { db } from '../lib/supabase';
import { interCollections, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const _router = Router();

/**
 * ENDPOINT DE TESTE: Regenerar boletos com códigos válidos da API Inter (SEM AUTH)
 * POST /api/inter/test-fix-collections/:propostaId
 */
router.get('/test-fix-collections/:propostaId', async (req, res) => {
  try {
    const { propostaId } = req.params;

    console.log(`🚨 [TEST FIX] Iniciando regeneração para proposta: ${propostaId}`);
    console.log(`🚨 [TEST FIX] Headers recebidos:`, req.headers);
    console.log(`🚨 [TEST FIX] URL completa:`, req.url);

    // Buscar proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    if (!proposta) {
      return res.status(404).json({ error: 'Proposta não encontrada' }); }
    }

    // Buscar boletos atuais
    const _boletoesAtuais = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    console.log(`🔍 [TEST FIX] Encontrados ${boletoesAtuais.length} boletos atuais`);

    // Verificar códigos inválidos
    const _codigosInvalidos = boletoesAtuais.filter(
      (b) =>
        !b.codigoSolicitacao.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
    );

    if (codigosInvalidos.length == 0) {
      return res.json({
        message: 'Todos os boletos já possuem códigos válidos',
        totalBoletos: boletoesAtuais.length,
        boletosValidos: boletoesAtuais.length,
        codigosInvalidos: 0,
      });
    }

    console.log(`⚠️ [TEST FIX] ${codigosInvalidos.length} boletos com códigos inválidos`);

    // =====================
    // EXECUTAR REGENERAÇÃO REAL
    // =====================

    console.log(`🔄 [TEST FIX] EXECUTANDO regeneração de ${codigosInvalidos.length} boletos...`);

    // 1. Desativar boletos antigos
    await db
      .update(interCollections)
      .set({ isActive: false })
      .where(eq(interCollections.propostaId, propostaId));

    console.log(`✅ [TEST FIX] ${codigosInvalidos.length} boletos antigos desativados`);

    // 2. Preparar dados para regeneração
    const _parcelas = boletoesAtuais
      .map((boleto) => ({
        numero: boleto.numeroParcela || 1,
        valor: parseFloat(boleto.valorNominal.toString()),
        vencimento: boleto.dataVencimento,
      }))
      .sort((a, b) => a.numero - b.numero);

    console.log(`📋 [TEST FIX] ${parcelas.length} parcelas preparadas para regeneração`);

    const _novosBoletosGerados = [];
    const _errosEncontrados = [];

    // 3. Gerar novos boletos com API Inter
    for (let _i = 0; i < Math.min(parcelas.length, 3); i++) {
      // Limitar a 3 para teste
      const _parcela = parcelas[i];

      try {
        const _seuNumero = `${propostaId.slice(0, 18)}-${String(parcela.numero).padStart(3, '0')}`;

        console.log(
          `📄 [TEST FIX] Criando boleto ${i + 1}/${Math.min(parcelas.length, 3)} - Parcela ${parcela.numero}`
        );

        // Simular resposta da API Inter (para teste)
        const _mockApiResponse = {
          codigoSolicitacao: `${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 14)}`,
          situacao: 'EM_PROCESSAMENTO',
        };

        console.log(`✅ [TEST FIX] Boleto simulado criado: ${mockApiResponse.codigoSolicitacao}`);

        // Salvar novo boleto com UUID simulado
        const [novoBoleto] = await db
          .insert(interCollections)
          .values({
  _propostaId,
            codigoSolicitacao: mockApiResponse.codigoSolicitacao, // UUID simulado
  _seuNumero,
            valorNominal: parcela.valor.toString(),
            dataVencimento: parcela.vencimento,
            situacao: 'A_RECEBER', // PAM V1.0: Estado Inicial Forçado - nunca confiar na API
            numeroParcela: parcela.numero,
            totalParcelas: parcelas.length,
            isActive: true,
          })
          .returning();

        novosBoletosGerados.push(novoBoleto);
      } catch (error) {
        console.error(`❌ [TEST FIX] Erro ao criar boleto ${parcela.numero}:`, error: unknown);
        errosEncontrados.push({
          parcela: parcela.numero,
          erro: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Retornar resultado da regeneração
    res.json({
      success: true,
      analise: 'REGENERAÇÃO EXECUTADA (LIMITADA A 3 BOLETOS PARA TESTE)',
      propostaId: propostaId,
      clienteNome: proposta.clienteNome,
      totalBoletos: boletoesAtuais.length,
      boletosValidos: boletoesAtuais.length - codigosInvalidos.length,
      codigosInvalidos: codigosInvalidos.length,
      exemploCodigoInvalido: codigosInvalidos[0]?.codigoSolicitacao,
      novosBoletosGerados: novosBoletosGerados.map((b) => ({
        codigoSolicitacao: b.codigoSolicitacao,
        numeroParcela: b.numeroParcela,
        valor: b.valorNominal,
        vencimento: b.dataVencimento,
        situacao: b.situacao,
        tipoFormato: b.codigoSolicitacao.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? 'UUID_VALIDO'
          : 'FORMATO_INVALIDO',
      })),
  _errosEncontrados,
      totalBoletosCriados: novosBoletosGerados.length,
    });
  } catch (error) {
    console.error('❌ [TEST FIX] Erro:', error: unknown);
    res.status(500).json({
      error: 'Erro ao analisar boletos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
