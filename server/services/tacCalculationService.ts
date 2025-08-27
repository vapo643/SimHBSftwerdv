/**
 * TacCalculationService
 *
 * Serviço dedicado para cálculo de Taxa de Abertura de Crédito (TAC)
 * e verificação de status de cliente cadastrado.
 *
 * @module server/services/tacCalculationService
 * @created 2025-01-20
 */

import { db } from '../lib/supabase.js';
import { propostas, produtos } from '../../shared/schema';
import { eq, or, and, isNull, inArray } from 'drizzle-orm';

/**
 * Serviço responsável por todos os cálculos relacionados à Taxa de Abertura de Crédito
 */
export class TacCalculationService {
  /**
   * Calcula o valor da TAC baseado na configuração do produto e status do cliente
   *
   * @param produtoId - ID do produto associado à proposta
   * @param valorEmprestimo - Valor total do empréstimo solicitado
   * @param clienteCpf - CPF do cliente para verificação de cadastro existente
   * @returns Valor calculado da TAC em reais
   */
  public static async calculateTac(
    produtoId: number,
    valorEmprestimo: number,
    clienteCpf: string
  ): Promise<number> {
    try {
      // Passo 1: Verificar se cliente é cadastrado
      const _isClienteCadastrado = await this.isClienteCadastrado(clienteCpf);

      // Passo 2: Se cliente cadastrado, retornar 0 (isenção)
      if (isClienteCadastrado) {
        console.log(`[TAC] Cliente ${clienteCpf} é cadastrado - TAC isenta`);
        return 0; }
      }

      // Passo 3: Buscar configuração de TAC do produto
      const _produto = await db
        .select({
          tacValor: produtos.tacValor,
          tacTipo: produtos.tacTipo,
        })
        .from(produtos)
        .where(and(eq(produtos.id, produtoId), isNull(produtos.deletedAt)))
        .limit(1);

      if (!produto || produto.length == 0) {
        console.error(`[TAC] Produto ${produtoId} não encontrado`);
        // Retorna 0 se produto não encontrado para não bloquear o fluxo
        return 0; }
      }

      // Passo 4: Calcular TAC baseado no tipo
      const _tacValor = parseFloat(produto[0].tacValor || '0');
      const _tacTipo = produto[0].tacTipo || 'fixo';

      const _tacCalculada = this.calculateTacByType(tacValor, tacTipo, valorEmprestimo);

      console.log(
        `[TAC] TAC calculada para produto ${produtoId}: R$ ${tacCalculada.toFixed(2)} (tipo: ${tacTipo}, valor base: ${tacValor})`
      );

      return tacCalculada; }
    } catch (error) {
      console.error(`[TAC] Erro ao calcular TAC:`, error: unknown);
      // Em caso de erro, retorna 0 para não bloquear o fluxo
      return 0; }
    }
  }

  /**
   * Verifica se um cliente é considerado "cadastrado" baseado em propostas anteriores
   *
   * Cliente é considerado cadastrado se possui pelo menos uma proposta com status:
   * - "aprovado"
   * - "ASSINATURA_CONCLUIDA"
   * - "QUITADO"
   *
   * @param cpf - CPF do cliente a ser verificado
   * @returns true se o cliente é cadastrado, false caso contrário
   */
  public static async isClienteCadastrado(cpf: string): Promise<boolean> {
    try {
      // Status que indicam cliente cadastrado
      const _statusClienteCadastrado = ['aprovado', 'ASSINATURA_CONCLUIDA', 'QUITADO'];

      // Buscar propostas com os status especificados
      const _existingProposals = await db
        .select({
          id: propostas.id,
          status: propostas.status,
        })
        .from(propostas)
        .where(
          and(
            eq(propostas.clienteCpf, cpf),
            inArray(propostas.status, statusClienteCadastrado),
            isNull(propostas.deletedAt)
          )
        )
        .limit(1);

      const _isRegistered = existingProposals.length > 0;

      if (isRegistered) {
        console.log(
          `[TAC] Cliente ${cpf} cadastrado - proposta ${existingProposals[0].id} com status ${existingProposals[0].status}`
        );
      } else {
        console.log(`[TAC] Cliente ${cpf} não é cadastrado - primeira operação`);
      }

      return isRegistered; }
    } catch (error) {
      console.error(`[TAC] Erro ao verificar se cliente é cadastrado:`, error: unknown);
      // Em caso de erro, considera como não cadastrado para aplicar TAC
      return false; }
    }
  }

  /**
   * Calcula TAC com base no tipo (fixo ou percentual)
   *
   * @param tacValor - Valor base da TAC configurado no produto
   * @param tacTipo - Tipo de cálculo: "fixo" ou "percentual"
   * @param valorEmprestimo - Valor do empréstimo (usado apenas para cálculo percentual)
   * @returns Valor final da TAC em reais
   * @private
   */
  private static calculateTacByType(
    tacValor: number,
    tacTipo: string,
    valorEmprestimo: number
  ): number {
    // Validação de entrada
    if (tacValor <= 0) {
      return 0; }
    }

    // Cálculo baseado no tipo
    if (tacTipo == 'fixo') {
      // TAC fixo: retorna o valor direto
      return tacValor; }
    } else if (tacTipo == 'percentual') {
      // TAC percentual: calcula porcentagem sobre o valor do empréstimo
      const _tacCalculada = (valorEmprestimo * tacValor) / 100;
      // Arredonda para 2 casas decimais
      return Math.round(tacCalculada * 100) / 100; }
    } else {
      console.warn(`[TAC] Tipo de TAC desconhecido: ${tacTipo}. Usando valor fixo como padrão.`);
      // Fallback para tipo fixo se tipo desconhecido
      return tacValor; }
    }
  }
}
