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
 * Interface para estratégias de cálculo TAC - Strategy Pattern
 */
interface ITacCalculationStrategy {
  calculateTac(valorEmprestimo: number, produtoConfig?: ProdutoTacConfig): Promise<number>;
  getStrategyName(): string;
}

/**
 * Configuração TAC do produto
 */
interface ProdutoTacConfig {
  tacValor: number;
  tacTipo: 'fixo' | 'percentual';
  tacAtivaParaClientesExistentes: boolean;
}

/**
 * Estratégia para clientes NOVOS - 10% fixo
 */
class NewClientTacStrategy implements ITacCalculationStrategy {
  async calculateTac(valorEmprestimo: number): Promise<number> {
    const tacCalculada = valorEmprestimo * 0.10; // 10% fixo
    console.log(`[TAC_NEW_CLIENT] TAC 10% aplicada: R$ ${tacCalculada.toFixed(2)}`);
    return Math.round(tacCalculada * 100) / 100; // Arredondar 2 casas
  }
  
  getStrategyName(): string {
    return 'NEW_CLIENT_10_PERCENT';
  }
}

/**
 * Estratégia para clientes EXISTENTES - via produto
 */
class ExistingClientTacStrategy implements ITacCalculationStrategy {
  async calculateTac(valorEmprestimo: number, produtoConfig?: ProdutoTacConfig): Promise<number> {
    if (!produtoConfig) {
      console.warn('[TAC_EXISTING_CLIENT] Configuração produto ausente, aplicando 0');
      return 0;
    }
    
    const { tacValor, tacTipo, tacAtivaParaClientesExistentes } = produtoConfig;
    
    // NOVA REGRA: Se TAC desativada para clientes existentes, retorna 0 (isento)
    if (!tacAtivaParaClientesExistentes) {
      console.log('[TAC_EXISTING_CLIENT] TAC desativada para clientes existentes neste produto - isento');
      return 0;
    }
    
    if (tacTipo === 'fixo') {
      console.log(`[TAC_EXISTING_CLIENT] TAC fixa aplicada: R$ ${tacValor}`);
      return tacValor;
    } else if (tacTipo === 'percentual') {
      const tacCalculada = (valorEmprestimo * tacValor) / 100;
      console.log(`[TAC_EXISTING_CLIENT] TAC percentual ${tacValor}% aplicada: R$ ${tacCalculada.toFixed(2)}`);
      return Math.round(tacCalculada * 100) / 100;
    }
    
    return 0;
  }
  
  getStrategyName(): string {
    return 'EXISTING_CLIENT_PRODUCT_BASED';
  }
}

/**
 * Serviço responsável por todos os cálculos relacionados à Taxa de Abertura de Crédito
 * Refatorado com Strategy Pattern para nova regra: 10% para clientes novos
 */
export class TacCalculationService {
  /**
   * NOVO MÉTODO PRINCIPAL - Strategy Pattern + Nova Regra
   * Implementa nova regra: 10% TAC para clientes novos, produto-based para existentes
   * 
   * @param produtoId - ID do produto associado à proposta
   * @param valorEmprestimo - Valor total do empréstimo solicitado
   * @param clienteCpf - CPF do cliente para verificação de cadastro existente
   * @returns Objeto com valor TAC calculado e estratégia utilizada
   */
  public static async calculateTacWithNewRules(
    produtoId: number,
    valorEmprestimo: number,
    clienteCpf: string
  ): Promise<{ valorTac: number; estrategiaUsada: string }> {
    try {
      // Passo 1: Verificar se cliente é novo ou existente
      const isClienteNovo = !(await this.isClienteCadastrado(clienteCpf));
      
      // Passo 2: Selecionar estratégia baseada no status do cliente
      let strategy: ITacCalculationStrategy;
      let produtoConfig: ProdutoTacConfig | undefined;
      
      if (isClienteNovo) {
        strategy = new NewClientTacStrategy();
        console.log(`[TAC_SERVICE] Cliente ${clienteCpf} é NOVO - aplicando estratégia 10%`);
      } else {
        strategy = new ExistingClientTacStrategy();
        produtoConfig = await this.getProdutoTacConfig(produtoId);
        console.log(`[TAC_SERVICE] Cliente ${clienteCpf} é EXISTENTE - aplicando estratégia por produto`);
      }
      
      // Passo 3: Executar cálculo via estratégia selecionada
      const valorTac = await strategy.calculateTac(valorEmprestimo, produtoConfig);
      
      return {
        valorTac,
        estrategiaUsada: strategy.getStrategyName()
      };
      
    } catch (error) {
      console.error(`[TAC_SERVICE] Erro ao calcular TAC com novas regras:`, error);
      return { valorTac: 0, estrategiaUsada: 'ERROR_FALLBACK' };
    }
  }
  
  /**
   * MÉTODO AUXILIAR - Buscar configuração TAC do produto
   * 
   * @param produtoId - ID do produto
   * @returns Configuração TAC do produto ou undefined se não encontrado
   */
  private static async getProdutoTacConfig(produtoId: number): Promise<ProdutoTacConfig | undefined> {
    try {
      const produto = await db
        .select({
          tacValor: produtos.tacValor,
          tacTipo: produtos.tacTipo,
          tacAtivaParaClientesExistentes: produtos.tacAtivaParaClientesExistentes,
        })
        .from(produtos)
        .where(and(eq(produtos.id, produtoId), isNull(produtos.deletedAt)))
        .limit(1);

      if (!produto || produto.length === 0) {
        console.error(`[TAC_SERVICE] Produto ${produtoId} não encontrado`);
        return undefined;
      }

      return {
        tacValor: parseFloat(produto[0].tacValor || '0'),
        tacTipo: produto[0].tacTipo as 'fixo' | 'percentual' || 'fixo',
        tacAtivaParaClientesExistentes: produto[0].tacAtivaParaClientesExistentes ?? true
      };
    } catch (error) {
      console.error(`[TAC_SERVICE] Erro ao buscar config produto ${produtoId}:`, error);
      return undefined;
    }
  }
  /**
   * MÉTODO LEGACY (DEPRECATED) - Manter para compatibilidade
   * 
   * @deprecated Use calculateTacWithNewRules instead
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
    console.warn('[TAC_SERVICE] DEPRECATED: Use calculateTacWithNewRules instead');
    const result = await this.calculateTacWithNewRules(produtoId, valorEmprestimo, clienteCpf);
    return result.valorTac;
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
      const statusClienteCadastrado = ['aprovado', 'ASSINATURA_CONCLUIDA', 'QUITADO'];

      // Buscar propostas com os status especificados
      const existingProposals = await db
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

      const isRegistered = existingProposals.length > 0;

      if (isRegistered) {
        console.log(
          `[TAC] Cliente ${cpf} cadastrado - proposta ${existingProposals[0].id} com status ${existingProposals[0].status}`
        );
      } else {
        console.log(`[TAC] Cliente ${cpf} não é cadastrado - primeira operação`);
      }

      return isRegistered;
    } catch (error) {
      console.error(`[TAC] Erro ao verificar se cliente é cadastrado:`, error);
      // Em caso de erro, considera como não cadastrado para aplicar TAC
      return false;
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
      return 0;
    }

    // Cálculo baseado no tipo
    if (tacTipo === 'fixo') {
      // TAC fixo: retorna o valor direto
      return tacValor;
    } else if (tacTipo === 'percentual') {
      // TAC percentual: calcula porcentagem sobre o valor do empréstimo
      const tacCalculada = (valorEmprestimo * tacValor) / 100;
      // Arredonda para 2 casas decimais
      return Math.round(tacCalculada * 100) / 100;
    } else {
      console.warn(`[TAC] Tipo de TAC desconhecido: ${tacTipo}. Usando valor fixo como padrão.`);
      // Fallback para tipo fixo se tipo desconhecido
      return tacValor;
    }
  }
}
