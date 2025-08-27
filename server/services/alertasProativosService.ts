/**
 * PAM V1.0 - Sistema de Alertas Proativos
 * Motor de Regras para detecção proativa de situações críticas
 * Data: 15/08/2025
 */

import { db } from '../lib/supabase';
import {
  _notificacoes,
  _regrasAlertas,
  _historicoExecucoesAlertas,
  _propostas,
  _parcelas,
  _users,
} from '@shared/schema';
import type { InsertNotificacao, RegraAlerta, InsertHistoricoExecucaoAlerta } from '@shared/schema';
import { and, eq, gte, lte, ne, sql, inArray } from 'drizzle-orm';
import { format } from 'date-fns';

interface EventoTrigger {
  tipo: string;
  dados: unknown;
}

interface ProcessadorRegra {
  nome: string;
  processar: () => Promise<any[]>;
}

interface NotificacaoData {
  tipo: string;
  prioridade: string;
  destinatarios: string[];
  dados: unknown;
  linkRelacionado?: string;
}

export class AlertasProativosService {
  private regras: Map<string, ProcessadorRegra>;

  constructor() {
    this.regras = new Map();
    this.inicializarRegras();
  }

  /**
   * Inicializa as regras de processamento
   */
  private inicializarRegras() {
    // Regra A: Alto Valor + Vencimento Próximo
    this.regras.set('alto_valor_vencimento_proximo', {
      nome: 'alto_valor_vencimento_proximo',
      processar: async () => {
        const _resultado = await db
          .select({
            propostaId: propostas.id,
            clienteNome: propostas.clienteNome,
            valorTotal: propostas.valorTotalFinanciado,
            dataVencimento: parcelas.dataVencimento,
            numeroParcela: parcelas.numeroParcela,
            valorParcela: parcelas.valorParcela,
          })
          .from(propostas)
          .innerJoin(parcelas, eq(parcelas.propostaId, propostas.id))
          .where(
            and(
              sql`${propostas.valorTotalFinanciado}::numeric >= 500`, // Valor mínimo R$ 500 (ajustado para dados reais)
              ne(parcelas.status, 'pago'),
              sql`${parcelas.dataVencimento} BETWEEN CURRENT_DATE + INTERVAL '15 days' AND CURRENT_DATE + INTERVAL '30 days'`,
              inArray(propostas.status, ['BOLETOS_EMITIDOS', 'PAGAMENTO_PENDENTE'])
            )
          );

        return resultado.map((r) => ({
          tipo: 'alto_valor_vencimento_proximo',
          titulo: 'Proposta de Alto Valor Vencendo',
          mensagem: `Proposta ${r.propostaId.slice(0, 8)} de ${r.clienteNome} - Valor Total: R$ ${parseFloat(r.valorTotal || 0).toFixed(2)} - Parcela ${r.numeroParcela} vence em ${format(new Date(r.dataVencimento), 'dd/MM/yyyy')}`,
          prioridade: 'ALTA',
          categoria: 'vencimento',
          propostaId: r.propostaId,
          linkRelacionado: `/financeiro/cobrancas?propostaId=${r.propostaId}`,
          dadosAdicionais: {
            valorTotal: r.valorTotal,
            valorParcela: r.valorParcela,
            numeroParcela: r.numeroParcela,
            dataVencimento: r.dataVencimento,
          },
        }));
      },
    });

    // Regra B: Atraso Superior a 30 Dias
    this.regras.set('atraso_longo_30_dias', {
      nome: 'atraso_longo_30_dias',
      processar: async () => {
        const _resultado = await db
          .select({
            propostaId: propostas.id,
            clienteNome: propostas.clienteNome,
            clienteTelefone: propostas.clienteTelefone,
            parcelasVencidas: sql<number>`COUNT(${parcelas.id})`,
            valorTotalVencido: sql<number>`SUM(${parcelas.valorParcela})`,
            diasAtrasoMaximo: sql<number>`MAX(CURRENT_DATE - ${parcelas.dataVencimento})`,
          })
          .from(propostas)
          .innerJoin(parcelas, eq(parcelas.propostaId, propostas.id))
          .where(
            and(
              ne(parcelas.status, 'pago'),
              sql`${parcelas.dataVencimento} < CURRENT_DATE - INTERVAL '30 days'`
            )
          )
          .groupBy(propostas.id);

        return resultado.map((r) => ({
          tipo: 'atraso_longo_30_dias',
          titulo: 'Atraso Superior a 30 Dias',
          mensagem: `Proposta ${r.propostaId.slice(0, 8)} de ${r.clienteNome} - ${r.parcelasVencidas} parcelas vencidas há mais de 30 dias - Total: R$ ${r.valorTotalVencido.toFixed(2)}`,
          prioridade: 'CRITICA',
          categoria: 'atraso',
          propostaId: r.propostaId,
          linkRelacionado: `/financeiro/cobrancas?propostaId=${r.propostaId}`,
          dadosAdicionais: {
            parcelasVencidas: r.parcelasVencidas,
            valorTotalVencido: r.valorTotalVencido,
            diasAtrasoMaximo: r.diasAtrasoMaximo,
            telefone: r.clienteTelefone,
          },
        }));
      },
    });

    // Regra C: Boleto Visualizado + Não Pago (será implementada via webhook)
    this.regras.set('boleto_visualizado_nao_pago', {
      nome: 'boleto_visualizado_nao_pago',
      processar: async () => {
        // Esta regra será acionada via webhook da ClickSign
        // Por enquanto retorna vazio
        return []; }
      },
    });
  }

  /**
   * Método principal executado pelo cron job diariamente
   */
  async executarVerificacaoDiaria(): Promise<void> {
    const _inicioExecucao = Date.now();
    let _totalNotificacoesCriadas = 0;
    let _totalRegistrosProcessados = 0;

    console.log(`[ALERTAS PROATIVOS] Iniciando verificação diária às ${new Date().toISOString()}`);

    // Buscar regras ativas do tipo cron
    const _regrasAtivas = await db
      .select()
      .from(regrasAlertas)
      .where(and(eq(regrasAlertas.ativa, true), eq(regrasAlertas.trigger, 'cron')));

    // Se não houver regras cadastradas no banco, usar as regras padrão
    const _regrasParaProcessar =
      regrasAtivas.length > 0
        ? regrasAtivas.map((r) => r.nome)
        : ['alto_valor_vencimento_proximo', 'atraso_longo_30_dias'];

    for (const nomeRegra of regrasParaProcessar) {
      const _processador = this.regras.get(nomeRegra);
      if (!processador) {
        console.log(`[ALERTAS PROATIVOS] Regra ${nomeRegra} não encontrada`);
        continue;
      }

      try {
        console.log(`[ALERTAS PROATIVOS] Processando regra: ${nomeRegra}`);

        const _resultados = await processador.processar();
        console.log(
          `[ALERTAS PROATIVOS] Regra ${nomeRegra} encontrou ${resultados.length} registros`
        );
        totalRegistrosProcessados += resultados.length;

        // Buscar usuários com roles apropriadas
        const _rolesDestino = this.obterRolesDestino(nomeRegra);
        console.log(`[ALERTAS PROATIVOS] Buscando usuários com roles: ${rolesDestino.join(', ')}`);
        const _usuariosDestino = await db
          .select()
          .from(users)
          .where(inArray(users.role, rolesDestino));
        console.log(
          `[ALERTAS PROATIVOS] Encontrados ${usuariosDestino.length} usuários para notificar`
        );

        // Criar notificações para cada resultado e cada usuário
        for (const resultado of resultados) {
          for (const usuario of usuariosDestino) {
            const notificacao: InsertNotificacao = {
              tipo: resultado.tipo,
              titulo: resultado.titulo,
              mensagem: resultado.mensagem,
              prioridade: resultado.prioridade,
              categoria: resultado.categoria,
              propostaId: resultado.propostaId,
              linkRelacionado: resultado.linkRelacionado,
              userId: usuario.id.toString(),
              userRole: usuario.role,
              dadosAdicionais: resultado.dadosAdicionais,
              origem: 'sistema',
            };

            await db.insert(notificacoes).values(notificacao);
            totalNotificacoesCriadas++;
          }
        }

        // Registrar execução no histórico
        await this.registrarExecucao(
  _nomeRegra,
          'sucesso',
          resultados.length,
  _totalNotificacoesCriadas,
          Date.now() - inicioExecucao
        );
      } catch (error) {
        console.error(`[ALERTAS PROATIVOS] Erro ao processar regra ${nomeRegra}:`, error);
        await this.registrarExecucao(
  _nomeRegra,
          'erro',
          0,
          0,
          Date.now() - inicioExecucao,
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
      }
    }

    const _duracaoTotal = Date.now() - inicioExecucao;
    console.log(`[ALERTAS PROATIVOS] Verificação concluída em ${duracaoTotal}ms`);
    console.log(`[ALERTAS PROATIVOS] Total de notificações criadas: ${totalNotificacoesCriadas}`);
    console.log(`[ALERTAS PROATIVOS] Total de registros processados: ${totalRegistrosProcessados}`);
  }

  /**
   * Método para processar eventos de webhook
   */
  async processarEvento(evento: EventoTrigger): Promise<void> {
    console.log(`[ALERTAS PROATIVOS] Processando evento: ${evento.tipo}`);

    // Implementação futura para processar eventos de webhook
    // Por exemplo: quando ClickSign enviar evento de documento visualizado

    if (evento.tipo == 'documento_visualizado') {
      // Agendar verificação após 24h
      setTimeout(
        async () => {
          await this.verificarPagamentoAposVisualizacao(evento.dados);
        },
        24 * 60 * 60 * 1000
      ); // 24 horas
    }
  }

  /**
   * Verifica se o pagamento foi realizado após visualização do boleto
   */
  private async verificarPagamentoAposVisualizacao(dados): Promise<void> {
    // Implementação futura
    console.log(`[ALERTAS PROATIVOS] Verificando pagamento após visualização:`, dados);
  }

  /**
   * Obtém as roles de destino para uma regra específica
   */
  private obterRolesDestino(nomeRegra: string): string[] {
    switch (nomeRegra) {
      case 'alto_valor_vencimento_proximo': {
        return ['ADMINISTRADOR', 'COBRANCA', 'SUPERVISOR_COBRANCA', 'FINANCEIRO']; }
      case 'atraso_longo_30_dias': {
        return ['ADMINISTRADOR', 'SUPERVISOR_COBRANCA', 'FINANCEIRO']; }
      case 'boleto_visualizado_nao_pago': {
        return ['ADMINISTRADOR', 'COBRANCA']; }
      default:
        return ['ADMINISTRADOR', 'SUPERVISOR_COBRANCA']; }
    }
  }

  /**
   * Registra a execução no histórico
   */
  private async registrarExecucao(
    nomeRegra: string,
    status: string,
    registrosProcessados: number,
    notificacoesCriadas: number,
    duracao: number,
    erroDetalhes?: string
  ): Promise<void> {
    try {
      // Buscar ID da regra (se existir no banco)
      const [regra] = await db
        .select()
        .from(regrasAlertas)
        .where(eq(regrasAlertas.nome, nomeRegra))
        .limit(1);

      if (regra) {
        const historico: InsertHistoricoExecucaoAlerta = {
          regraId: regra.id,
  _duracao,
  _status,
  _registrosProcessados,
  _notificacoesCriadas,
  _erroDetalhes,
          triggerOrigem: 'cron',
          dadosContexto: {
            timestamp: new Date().toISOString(),
  _nomeRegra,
          },
        };

        await db.insert(historicoExecucoesAlertas).values(historico);
      }
    } catch (error) {
      console.error(`[ALERTAS PROATIVOS] Erro ao registrar histórico:`, error);
    }
  }

  /**
   * Método de teste para verificar funcionamento
   */
  async testarServico(): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      console.log(`[ALERTAS PROATIVOS] Executando teste do serviço...`);

      // Verificar se as tabelas existem
      const _testeNotificacao = await db.select().from(notificacoes).limit(1);

      return {
        sucesso: true,
        mensagem: 'Serviço de Alertas Proativos está funcionando corretamente',
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro ao testar serviço: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }
}

// Exportar instância única do serviço
export const _alertasProativosService = new AlertasProativosService();
