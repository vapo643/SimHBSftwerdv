import { Router } from 'express';
import { interBankService } from '../services/interBankService';
import { db } from '../lib/supabase';
import { interCollections, propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Gerar UUID válido
function generateValidUUID() {
  const chars = '0123456789abcdef';
  let _uuid = '';
  for (let _i = 0; i < 32; i++) {
    if (i == 8 || i == 12 || i == 16 || i == 20) {
      uuid += '-';
    }
    uuid += chars[Math.floor(Math.random() * 16)];
  }
  return uuid;
}

/**
 * ENDPOINT EXECUTAR: Regenerar boletos com códigos válidos da API Inter
 * POST /api/inter/execute-fix/:propostaId
 */
router.post('/execute-fix/:propostaId', async (req, res) => {
  try {
    const { propostaId } = req.params;

    console.log(`🚀 [EXECUTE FIX] Iniciando regeneração REAL para proposta: ${propostaId}`);

    // Buscar proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    if (!proposta) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Buscar boletos atuais (válidos e inválidos)
    const boletoesAtuais = await db
      .select()
      .from(interCollections)
      .where(eq(interCollections.propostaId, propostaId));

    console.log(`🔍 [EXECUTE FIX] Encontrados ${boletoesAtuais.length} boletos atuais`);

    // Identificar códigos inválidos
    const codigosInvalidos = boletoesAtuais.filter(
      (b) =>
        !b.codigoSolicitacao.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
    );

    if (codigosInvalidos.length == 0) {
      return res.json({
        success: true,
        message: 'Todos os boletos já possuem códigos válidos',
        totalBoletos: boletoesAtuais.length,
      });
    }

    console.log(
      `⚠️ [EXECUTE FIX] ${codigosInvalidos.length} boletos com códigos inválidos encontrados`
    );

    // =====================
    // EXECUTAR REGENERAÇÃO
    // =====================

    // 1. Desativar TODOS os boletos (válidos e inválidos)
    const resultUpdate = await db
      .update(interCollections)
      .set({ isActive: false })
      .where(eq(interCollections.propostaId, propostaId))
      .returning();

    console.log(`✅ [EXECUTE FIX] ${resultUpdate.length} boletos antigos desativados`);

    // 2. Preparar dados das parcelas
    const parcelas = boletoesAtuais
      .map((boleto) => ({
        numero: boleto.numeroParcela || 1,
        valor: parseFloat(boleto.valorNominal.toString()),
        vencimento: boleto.dataVencimento,
      }))
      .sort((a, b) => a.numero - b.numero);

    console.log(`📋 [EXECUTE FIX] ${parcelas.length} parcelas preparadas para regeneração`);

    const novosBoletosGerados = [];
    const errosEncontrados = [];

    // 3. Criar novos boletos com códigos simulados válidos (para teste)
    for (let _i = 0; i < parcelas.length; i++) {
      const parcela = parcelas[i];

      try {
        const seuNumero = `${propostaId.slice(0, 18)}-${String(parcela.numero).padStart(3, '0')}`;

        console.log(
          `📄 [EXECUTE FIX] Criando boleto ${i + 1}/${parcelas.length} - Parcela ${parcela.numero}`
        );

        // Usar função UUID válida

        const codigoSolicitacaoValido = generateValidUUID();

        console.log(`✅ [EXECUTE FIX] UUID válido gerado: ${codigoSolicitacaoValido}`);

        // **PAM V1.0 CORREÇÃO**: Seguir padrão correto do ClickSign webhook
        // 1. Criar boleto no Banco Inter
        const boletoData = {
  seuNumero,
          valorNominal: parcela.valor,
          dataVencimento: parcela.vencimento,
          numDiasAgenda: 60,
          pagador: {
            cpfCnpj: proposta.clienteCpf?.replace(/\D/g, '') || '',
            tipoPessoa: 'FISICA' as const,
            nome: proposta.clienteNome || '',
            email: proposta.clienteEmail || '',
            ddd: proposta.clienteTelefone
              ? proposta.clienteTelefone.replace(/\D/g, '').slice(0, 2)
              : '',
            telefone: proposta.clienteTelefone
              ? proposta.clienteTelefone.replace(/\D/g, '').slice(2)
              : '',
            endereco: proposta.clienteEndereco || '',
            numero: proposta.clienteNumero || '',
            complemento: proposta.clienteComplemento || '',
            bairro: proposta.clienteBairro || '',
            cidade: proposta.clienteCidade || '',
            uf: proposta.clienteUf || '',
            cep: proposta.clienteCep?.replace(/\D/g, '') || '',
          },
          mensagem: {
            linha1: `Parcela ${parcela.numero}/${parcelas.length} - Empréstimo`,
            linha2: `Proposta: ${propostaId}`,
            linha3: `SIMPIX - Soluções Financeiras`,
            linha4: `Valor da parcela: R$ ${parcela.valor.toFixed(2)}`,
            linha5: `Vencimento: ${parcela.vencimento}`,
          },
        };

        console.log(
          `[PAM V1.0 FIX] Criando boleto real no Banco Inter - Parcela ${parcela.numero}`
        );
        const createResponse = await interBankService.emitirCobranca(boletoData);

        // 2. Buscar dados completos (incluindo PIX)
        const interCollection = await interBankService.recuperarCobranca(
          createResponse.codigoSolicitacao
        );

        // 3. Salvar dados completos no banco (incluindo PIX)
        const [novoBoleto] = await db
          .insert(interCollections)
          .values({
  propostaId,
            codigoSolicitacao: createResponse.codigoSolicitacao,
  seuNumero,
            valorNominal: parcela.valor.toString(),
            dataVencimento: parcela.vencimento,
            situacao: interCollection.cobranca.situacao,
            dataSituacao: interCollection.cobranca.dataSituacao,
            nossoNumero: interCollection.boleto?.nossoNumero || '',
            codigoBarras: interCollection.boleto?.codigoBarras || '',
            linhaDigitavel: interCollection.boleto?.linhaDigitavel || '',
            pixTxid: interCollection.pix?.txid || '',
            pixCopiaECola: interCollection.pix?.pixCopiaECola || '', // **PIX AGORA PERSISTIDO**
            dataEmissao:
              interCollection.cobranca.dataEmissao || new Date().toISOString().split('T')[0],
            numeroParcela: parcela.numero,
            totalParcelas: parcelas.length,
            isActive: true,
          })
          .returning();

        novosBoletosGerados.push(novoBoleto);

        console.log(`🎉 [EXECUTE FIX] Boleto ${parcela.numero} criado com sucesso!`);
      }
catch (error) {
        console.error(`❌ [EXECUTE FIX] Erro ao criar boleto ${parcela.numero}:`, error);
        errosEncontrados.push({
          parcela: parcela.numero,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // 4. Atualizar flag na proposta
    await db
      .update(propostas)
      .set({
        interBoletoGerado: true,
        interBoletoGeradoEm: new Date(),
      })
      .where(eq(propostas.id, propostaId));

    console.log(
      `🎉 [EXECUTE FIX] Regeneração completa! ${novosBoletosGerados.length} novos boletos criados`
    );

    res.json({
      success: true,
      message: `Regeneração completa: ${novosBoletosGerados.length} boletos criados com códigos válidos`,
  propostaId,
      clienteNome: proposta.clienteNome,
      boletoAntigos: boletoesAtuais.length,
      boletosDesativados: resultUpdate.length,
      novosBoletosGerados: novosBoletosGerados.length,
      erros: errosEncontrados.length,
      exemploNovosCodigos: novosBoletosGerados.slice(0, 3).map((b) => ({
        parcela: b.numeroParcela,
        codigo: b.codigoSolicitacao,
        formato: b.codigoSolicitacao.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? 'UUID_VÁLIDO'
          : 'INVÁLIDO',
      })),
    });
  }
catch (error) {
    console.error('❌ [EXECUTE FIX] Erro geral:', error);
    res.status(500).json({
      error: 'Erro ao executar regeneração de boletos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
