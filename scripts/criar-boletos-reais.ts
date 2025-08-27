#!/usr/bin/env tsx
/**
 * Script para criar boletos REAIS no Banco Inter
 * Corrige o problema de boletos com códigos falsos no banco
 */

import { db } from '../server/lib/supabase';
import { interCollections, propostas } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { interBankService } from '../server/services/interBankService';

async function criarBoletosReais(propostaId: string) {
  console.log(`\n🚀 INICIANDO CRIAÇÃO DE BOLETOS REAIS PARA PROPOSTA: ${propostaId}\n`);

  try {
    // 1. Buscar dados da proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, parseInt(propostaId.split('-')[0])))
      .limit(1);

    if (!proposta) {
      throw new Error('Proposta não encontrada');
    }

    console.log(`✅ Proposta encontrada: ${proposta.nome}`);

    // 2. Buscar boletos com códigos inválidos
    const boletosInvalidos = await db
      .select()
      .from(interCollections)
      .where(and(eq(interCollections.propostaId, propostaId), eq(interCollections.isActive, true)))
      .orderBy(interCollections.numeroParcela);

    console.log(`📋 Encontrados ${boletosInvalidos.length} boletos para recriar\n`);

    const successCount = 0;
    const failCount = 0;

    // 3. Criar boleto real para cada parcela
    for (const boleto of boletosInvalidos) {
      try {
        console.log(`\n🔄 Processando parcela ${boleto.numeroParcela}/${boleto.totalParcelas}...`);
        console.log(`   Código antigo (inválido): ${boleto.codigoSolicitacao}`);

        // Calcular data de vencimento
        const dataBase = new Date();
        const dataVencimento = new Date(dataBase);
        dataVencimento.setDate(dataBase.getDate() + boleto.numeroParcela * 30);

        // Preparar dados do boleto
        const dadosBoleto = {
          seuNumero:
            boleto.seuNumero || `${propostaId}-${String(boleto.numeroParcela).padStart(3, '0')}`,
          valorNominal: parseFloat(boleto.valorNominal),
          dataEmissao: new Date().toISOString().split('T')[0],
          dataVencimento: dataVencimento.toISOString().split('T')[0],
          numDiasAgenda: 30,
          pagador: {
            cpfCnpj: proposta.cpf.replace(/\D/g, ''),
            tipoPessoa: 'FISICA',
            nome: proposta.nome.toUpperCase(),
            endereco: proposta.endereco || 'Rua Miguel Angelo',
            numero: proposta.numero || '100',
            bairro: proposta.bairro || 'Centro',
            cidade: proposta.cidade || 'Serra',
            uf: proposta.estado || 'ES',
            cep: (proposta.cep || '29165460').replace(/\D/g, ''),
            email: proposta.email || 'cliente@example.com',
            telefone: (proposta.telefone || '27998538565').replace(/\D/g, ''),
          },
          mensagem: {
            linha1: `Parcela ${boleto.numeroParcela}/${boleto.totalParcelas}`,
          },
          desconto1: {
            codigoDesconto: 'NAOTEMDESCONTO',
            taxa: 0,
            valor: 0,
          },
          multa: {
            codigoMulta: 'PERCENTUAL',
            taxa: 2,
            valor: 0,
          },
          mora: {
            codigoMora: 'TAXAMENSAL',
            taxa: 1,
            valor: 0,
          },
        };

        console.log(`   Criando boleto no Inter API...`);

        // CRIAR BOLETO REAL NA API DO INTER
        const response = await interBankService.emitirCobranca(dadosBoleto);

        if (!response.codigoSolicitacao) {
          throw new Error('Inter não retornou código de solicitação');
        }

        console.log(`   ✅ Boleto criado! Código REAL: ${response.codigoSolicitacao}`);

        // 4. Atualizar banco com código REAL
        await db
          .update(interCollections)
          .set({
            codigoSolicitacao: response.codigoSolicitacao,
            nossoNumero: response.nossoNumero || '',
            situacao: 'EMITIDO',
            codigoBarras: response.codigoBarras || '',
            linhaDigitavel: response.linhaDigitavel || '',
            updatedAt: new Date(),
          })
          .where(eq(interCollections.id, boleto.id));

        console.log(`   ✅ Banco atualizado com código REAL`);
        successCount++;
      }
catch (error) {
        console.error(`   ❌ Erro na parcela ${boleto.numeroParcela}:`, error);
        failCount++;
      }
    }

    console.log(`\n✅ PROCESSO CONCLUÍDO!`);
    console.log(`   Sucesso: ${successCount} boletos`);
    console.log(`   Falhas: ${failCount} boletos`);
  }
catch (error) {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  }
}

// Executar para a proposta específica
const PROPOSTA_ID = '88a44696-9b63-42ee-aa81-15f9519d24cb';
criarBoletosReais(PROPOSTA_ID)
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });
