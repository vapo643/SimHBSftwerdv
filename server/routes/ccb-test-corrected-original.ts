/**
 * Rota de Teste para Sistema CCB V2 Corrigido
 * Com mapeamento completo de campos
 */

import { Router } from 'express';
import { _jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { CCBGenerationServiceV2 } from '../services/ccbGenerationServiceV2';
import { db } from '../lib/supabase';
import { propostas } from '@shared/schema';
import { eq } from 'drizzle-orm';

const _router = Router();

/**
 * POST /api/ccb-corrected/test/:propostaId
 * Testa geração de CCB com mapeamento corrigido
 */
router.post('/test/:propostaId', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    const { useTestData } = req.body;

    console.log(`🧪 Teste CCB Corrigido: Iniciando para proposta ${propostaId}`);

    let propostaData;

    if (useTestData) {
      // Dados de teste COMPLETOS com todos os campos mapeados
      propostaData = {
        // Identificação
        id: propostaId,
        createdAt: new Date().toISOString(),
        dataAprovacao: new Date().toISOString(),

        // Dados do cliente COMPLETOS
        clienteNome: 'João da Silva Santos',
        clienteCpf: '123.456.789-00',
        clienteRg: '12.345.678-9', // NOVO: RG agora incluído
        clienteEndereco: 'Rua das Flores, 123 - Apt 45 - Centro - São Paulo/SP - CEP 01234-567', // NOVO: Endereço completo
        clienteEmail: 'joao.silva@email.com',
        clienteTelefone: '(11) 98765-4321',
        clienteDataNascimento: '01/01/1980',
        clienteRenda: '5000.00',
        clienteOcupacao: 'Analista de Sistemas',
        clienteEstadoCivil: 'Casado',
        clienteNacionalidade: 'Brasileira',

        // Dados do empréstimo
        valor: 10000.0,
        prazo: 12,
        finalidade: 'Capital de Giro',
        garantia: 'Sem garantia',
        taxaJuros: 2.49, // Taxa real para cálculo de CET
        valorTac: 50.0,
        valorIof: 38.0,
        valorTotalFinanciado: 10088.0,

        // Dados bancários COMPLETOS para pagamento
        dadosPagamentoBanco: 'Banco Inter', // Banco completo
        dadosPagamentoAgencia: '0001', // Agência
        dadosPagamentoConta: '1234567-8', // Conta
        dadosPagamentoTipo: 'conta_corrente',
        dadosPagamentoNomeTitular: 'João da Silva Santos',
        dadosPagamentoCpfTitular: '123.456.789-00',

        // Status
        status: 'aprovado',
      };

      console.log('📋 Usando dados de teste completos com todos os campos mapeados');
    }
else {
      // Buscar dados reais do banco
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, propostaId))
        .limit(1);

      if (!proposta) {
        return res.status(404).json({
          success: false,
          error: 'Proposta não encontrada',
        });
      }

      propostaData = proposta;

      // Log dos campos importantes
      console.log('📊 Dados reais da proposta:');
      console.log('  - Cliente:', propostaData.clienteNome);
      console.log('  - CPF:', propostaData.clienteCpf);
      console.log('  - RG:', propostaData.clienteRg || '❌ VAZIO');
      console.log('  - Endereço:', propostaData.clienteEndereco || '❌ VAZIO');
      console.log('  - Banco:', propostaData.dadosPagamentoBanco || '❌ VAZIO');
      console.log('  - Agência:', propostaData.dadosPagamentoAgencia || '❌ VAZIO');
      console.log('  - Conta:', propostaData.dadosPagamentoConta || '❌ VAZIO');
      console.log('  - Taxa Juros:', propostaData.taxaJuros || '❌ VAZIO');
    }

    // Gerar CCB com sistema corrigido
    const _service = new CCBGenerationServiceV2();
    const _result = await service.generateCCB(propostaData);

    if (!_result.success || !_result.pdfBytes) {
      return res.status(500).json({
        success: false,
        error: _result.error || 'Falha na geração do CCB',
        logs: _result.logs,
      });
    }

    // Salvar no storage
    const _filePath = await service.saveCCBToStorage(_result.pdfBytes, propostaId);

    if (!filePath) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao salvar CCB no storage',
        logs: _result.logs,
      });
    }

    // Gerar URL pública
    const _publicUrl = await service.getCCBPublicUrl(filePath);

    // Analisar logs para feedback
    const _logs = _result.logs || [];
    const _stats = {
      totalFields: logs.length,
      successFields: logs.filter((l) => l.includes('✓')).length,
      warningFields: logs.filter((l) => l.includes('⚠')).length,
      errorFields: logs.filter((l) => l.includes('✗') || l.includes('❌')).length,
      emptyFields: logs.filter((l) => l.includes('Sem valor')).length,
    };

    console.log(`✅ CCB Gerado com sucesso!`);
    console.log(`📊 Estatísticas:`);
    console.log(`  - Campos preenchidos: ${stats.successFields}/${stats.totalFields}`);
    console.log(`  - Campos vazios: ${stats.emptyFields}`);
    console.log(`  - Avisos: ${stats.warningFields}`);
    console.log(`  - Erros: ${stats.errorFields}`);

    res.json({
      success: true,
      _filePath,
      _publicUrl,
      _logs,
      _stats,
      analysis: {
        completeness: Math.round((stats.successFields / stats.totalFields) * 100) + '%',
        quality: stats.errorFields == 0 ? 'Excelente' : stats.warningFields > 3 ? 'Regular' : 'Boa',
        missingData: logs
          .filter((l) => l.includes('Sem valor'))
          .map((l) => {
            const _match = l.match(/Campo (\w+): Sem valor/);
            return match ? match[1] : null;
          })
          .filter(Boolean),
      },
    });
  }
catch (error) {
    console.error('❌ Erro no teste CCB corrigido:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /api/ccb-corrected/field-mapping
 * Retorna o mapeamento atual de campos
 */
router.get('/field-mapping', _jwtAuthMiddleware, async (req, res) => {
  try {
    const _mapping = {
      page1: {
        title: 'Identificação e Valores',
        fields: {
          numeroCedula: { source: 'proposta.id', format: 'CCB-XXXXXXXX' },
          dataEmissao: { source: 'proposta.dataAprovacao ou createdAt', format: 'DD/MM/YYYY' },
          finalidadeOperacao: { source: 'proposta.finalidade', default: 'Capital de Giro' },
          cpfCnpj: { source: 'proposta.clienteCpf', required: true },
          nomeRazaoSocial: { source: 'proposta.clienteNome', required: true },
          rg: { source: 'proposta.clienteRg', status: '✅ CORRIGIDO' },
          enderecoEmitente: { source: 'proposta.clienteEndereco', status: '✅ CORRIGIDO' },
          valorPrincipal: { source: 'proposta.valor', format: 'R$ X.XXX,XX' },
          custoEfetivoTotal: { source: 'CALCULADO: taxaJuros + IOF + TAC', status: '✅ CORRIGIDO' },
        },
      },
      page2: {
        title: 'Dados Bancários',
        fields: {
          numeroBancoEmitente: {
            source: 'EXTRAÍDO de dadosPagamentoBanco',
            status: '✅ CORRIGIDO',
          },
          contaNumeroEmitente: {
            source: 'dadosPagamentoAgencia + dadosPagamentoConta',
            status: '✅ CORRIGIDO',
          },
          nomeInstituicaoFavorecida: { source: 'proposta.dadosPagamentoBanco' },
          numeroContrato: { source: 'proposta.id' },
          linhaDigitavelBoleto: {
            source: 'inter_collections.linhaDigitavel',
            status: '⚠️ INTEGRAÇÃO',
          },
        },
      },
      page8: {
        title: 'Tabela de Pagamentos',
        fields: {
          dataPagamento: { source: 'CALCULADO baseado em dataAprovacao + prazo' },
          valorPagamento: { source: 'CALCULADO usando Tabela Price', status: '✅ CORRIGIDO' },
          linhaDigitavel: { source: 'Será preenchido após geração de boletos' },
        },
      },
    };

    res.json({
      success: true,
      _mapping,
      summary: {
        totalFields: 29,
        correctedFields: 12,
        pendingIntegration: 2,
        status: 'Sistema funcionando com mapeamento corrigido',
      },
    });
  }
catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao obter mapeamento',
    });
  }
});

/**
 * POST /api/ccb-corrected/validate-proposal/:propostaId
 * Valida se uma proposta tem todos os dados necessários
 */
router.post('/validate-proposal/:propostaId', _jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;

    // Buscar proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);

    if (!proposta) {
      return res.status(404).json({
        success: false,
        error: 'Proposta não encontrada',
      });
    }

    // Validar campos obrigatórios
    const _requiredFields = {
      id: proposta.id,
      clienteNome: proposta.clienteNome,
      clienteCpf: proposta.clienteCpf,
      valor: proposta.valor,
      prazo: proposta.prazo,
    };

    // Validar campos importantes
    const _importantFields = {
      clienteRg: proposta.clienteRg,
      clienteEndereco: proposta.clienteEndereco,
      dadosPagamentoBanco: proposta.dadosPagamentoBanco,
      dadosPagamentoAgencia: proposta.dadosPagamentoAgencia,
      dadosPagamentoConta: proposta.dadosPagamentoConta,
      taxaJuros: proposta.taxaJuros,
      finalidade: proposta.finalidade,
    };

    // Calcular completude
    const _requiredMissing = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    const _importantMissing = Object.entries(importantFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    const _isValid = requiredMissing.length == 0;
    const _completeness = Math.round(
      ((Object.values(requiredFields).filter(Boolean).length +
        Object.values(importantFields).filter(Boolean).length) /
        (Object.keys(requiredFields).length + Object.keys(importantFields).length)) *
        100
    );

    res.json({
      success: true,
      valid: isValid,
      completeness: completeness + '%',
      validation: {
        requiredFields: {
          complete: requiredMissing.length == 0,
          missing: requiredMissing,
        },
        importantFields: {
          complete: importantMissing.length == 0,
          missing: importantMissing,
        },
      },
      recommendation: isValid
        ? completeness >= 80
          ? '✅ Proposta pronta para gerar CCB'
          : '⚠️ CCB pode ser gerado mas alguns campos estarão vazios'
        : '❌ Preencha os campos obrigatórios antes de gerar o CCB',
    });
  }
catch (error) {
    console.error('❌ Erro na validação:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro na validação',
    });
  }
});

export default router;
