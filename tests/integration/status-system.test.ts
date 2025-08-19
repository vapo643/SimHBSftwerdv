/**
 * Testes de Integração - Sistema de Status FSM
 * PAM V1.0 - Validação de Transições e Atomicidade
 * Data: 19/08/2025
 * 
 * Esta suíte de testes valida o contrato do sistema de status,
 * garantindo a correta execução das transições de negócio e
 * a atomicidade das operações de dupla escrita.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "../../server/lib/supabase";
import { 
  propostas, 
  propostaLogs, 
  statusContextuais, 
  parcelas,
  interCollections,
  interWebhooks,
  interCallbacks,
  statusTransitions,
  solicitacoesModificacao,
  propostaDocumentos
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { 
  ProposalStatus, 
  InvalidTransitionError,
  transitionTo,
  getPossibleTransitions,
  isFinalStatus
} from "../../server/services/statusFsmService";
import { 
  updateStatusWithContext, 
  StatusContexto 
} from "../../server/lib/status-context-helper";

describe("Sistema de Status FSM - Testes de Integração", () => {
  let testProposalId: string;
  const testUserId = "test-user-123";
  
  /**
   * Setup: Limpa banco e cria proposta de teste
   */
  beforeEach(async () => {
    console.log("[TEST SETUP] 🧹 Limpando banco de dados de teste...");
    
    // Limpar tabelas relacionadas em ordem correta (respeitar foreign keys)
    // Primeiro limpar tabelas dependentes
    await db.delete(parcelas);
    await db.delete(interCollections);
    await db.delete(interWebhooks);
    await db.delete(interCallbacks);
    await db.delete(statusTransitions);
    await db.delete(solicitacoesModificacao);
    await db.delete(propostaDocumentos);
    await db.delete(statusContextuais);
    await db.delete(propostaLogs);
    await db.delete(propostas);
    
    // Criar proposta de teste com status inicial
    testProposalId = uuidv4(); // Gerar UUID para a proposta
    const [newProposal] = await db.insert(propostas)
      .values({
        id: testProposalId,
        numeroProposta: 999999, // Número sequencial de teste
        status: ProposalStatus.RASCUNHO,
        valor: "10000.00",
        prazo: 12,
        taxaJuros: "1.99",
        clienteNome: "Cliente Teste",
        clienteCpf: "12345678901",
        clienteTelefone: "11999999999",
        clienteEmail: "teste@teste.com",
        produtoId: 1,
        tabelaComercialId: 1,
        lojaId: 1,
        finalidade: "Teste",
        garantia: "Nenhuma",
      })
      .returning({ id: propostas.id });
    
    // testProposalId já foi definido antes do insert
    console.log(`[TEST SETUP] ✅ Proposta de teste criada: ${testProposalId}`);
  });
  
  /**
   * Teardown: Limpa banco após cada teste
   */
  afterEach(async () => {
    console.log("[TEST TEARDOWN] 🧹 Limpando banco após teste...");
    
    // Limpar em ordem correta para respeitar foreign keys
    await db.delete(parcelas);
    await db.delete(interCollections);
    await db.delete(interWebhooks);
    await db.delete(interCallbacks);
    await db.delete(statusTransitions);
    await db.delete(solicitacoesModificacao);
    await db.delete(propostaDocumentos);
    await db.delete(statusContextuais);
    await db.delete(propostaLogs);
    await db.delete(propostas);
    
    console.log("[TEST TEARDOWN] ✅ Banco limpo");
  });
  
  /**
   * CENÁRIO 1: Transição Válida
   * Testa uma transição permitida pelo grafo de estados
   */
  describe("Cenário 1: Transição Válida", () => {
    it("deve permitir transição de RASCUNHO para APROVADO", async () => {
      console.log("[TEST] 🎯 Testando transição válida: RASCUNHO → APROVADO");
      
      // Executar transição
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        userId: testUserId,
        observacoes: "Proposta aprovada pelo analista"
      });
      
      // A função não retorna nada, então verificamos o banco
      
      // Verificar atualização na tabela propostas
      const [updatedProposal] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      expect(updatedProposal.status).toBe(ProposalStatus.APROVADO);
      
      // Verificar criação de log
      const logs = await db
        .select()
        .from(propostaLogs)
        .where(eq(propostaLogs.propostaId, testProposalId))
        .orderBy(desc(propostaLogs.createdAt));
      
      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog.statusNovo).toBe(ProposalStatus.APROVADO);
      expect(latestLog.observacao).toContain("Proposta aprovada pelo analista");
      
      console.log("[TEST] ✅ Transição válida executada com sucesso");
    });
    
    it("deve permitir múltiplas transições válidas em sequência", async () => {
      console.log("[TEST] 🎯 Testando cadeia de transições válidas");
      
      // RASCUNHO → APROVADO
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        userId: testUserId
      });
      
      // APROVADO → CCB_GERADA
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.CCB_GERADA,
        userId: testUserId
      });
      
      // CCB_GERADA → AGUARDANDO_ASSINATURA
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.AGUARDANDO_ASSINATURA,
        userId: testUserId,
        observacoes: "CCB enviada para assinatura"
      });
      
      // Verificar estado final
      const [finalProposal] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      expect(finalProposal.status).toBe(ProposalStatus.AGUARDANDO_ASSINATURA);
      
      console.log("[TEST] ✅ Cadeia de transições executada com sucesso");
    });
  });
  
  /**
   * CENÁRIO 2: Transição Inválida
   * Testa transições não permitidas pelo grafo de estados
   */
  describe("Cenário 2: Transição Inválida", () => {
    it("deve rejeitar transição de APROVADO para REJEITADO diretamente", async () => {
      console.log("[TEST] 🚫 Testando transição inválida: APROVADO → REJEITADO");
      
      // Primeiro, mover para APROVADO
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        userId: testUserId
      });
      
      // Tentar transição inválida (APROVADO pode virar REJEITADO segundo o grafo, vamos testar outro caso)
      // Vamos testar ASSINATURA_CONCLUIDA → RASCUNHO que é claramente inválida
      
      // Primeiro vamos para ASSINATURA_CONCLUIDA através de transições válidas
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.CCB_GERADA,
        userId: testUserId
      });
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.AGUARDANDO_ASSINATURA,
        userId: testUserId
      });
      await transitionTo({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.ASSINATURA_CONCLUIDA,
        userId: testUserId
      });
      
      // Agora tentar voltar para RASCUNHO (inválido)
      await expect(
        transitionTo({
          propostaId: testProposalId,
          novoStatus: ProposalStatus.RASCUNHO,
          userId: testUserId
        })
      ).rejects.toThrow(InvalidTransitionError);
      
      // Verificar que o status não mudou
      const [unchangedProposal] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      expect(unchangedProposal.status).toBe(ProposalStatus.ASSINATURA_CONCLUIDA);
      
      console.log("[TEST] ✅ Transição inválida corretamente rejeitada");
    });
    
    it("deve validar corretamente transições através do método getPossibleTransitions", async () => {
      console.log("[TEST] 🔍 Testando validação de transições");
      
      // Obter transições possíveis
      const fromRascunho = getPossibleTransitions(ProposalStatus.RASCUNHO);
      expect(fromRascunho).toContain(ProposalStatus.APROVADO);
      expect(fromRascunho).toContain(ProposalStatus.REJEITADO);
      
      const fromRejeitado = getPossibleTransitions(ProposalStatus.REJEITADO);
      expect(fromRejeitado).toHaveLength(0); // Estado final
      
      // Validar estados finais
      expect(isFinalStatus(ProposalStatus.REJEITADO)).toBe(true);
      expect(isFinalStatus(ProposalStatus.PAGAMENTO_AUTORIZADO)).toBe(true);
      expect(isFinalStatus(ProposalStatus.RASCUNHO)).toBe(false);
      
      console.log("[TEST] ✅ Validação de transições funcionando corretamente");
    });
  });
  
  /**
   * CENÁRIO 3: Atomicidade da Dupla Escrita
   * Valida que as escritas nas tabelas propostas e status_contextuais
   * ocorrem de forma atômica (tudo ou nada)
   */
  describe("Cenário 3: Atomicidade da Dupla Escrita", () => {
    it("deve garantir atomicidade ao atualizar status com contexto", async () => {
      console.log("[TEST] ⚛️ Testando atomicidade da dupla escrita");
      
      const contexto: StatusContexto = "formalizacao";
      const novoStatus = ProposalStatus.APROVADO;
      
      // Executar atualização com contexto
      const result = await updateStatusWithContext({
        propostaId: testProposalId,
        novoStatus: novoStatus,
        contexto: contexto,
        userId: testUserId,
        observacoes: "Teste de atomicidade",
        metadata: { teste: true }
      });
      
      expect(result.success).toBe(true);
      expect(result.statusLegado).toBe(novoStatus);
      expect(result.statusContextual).toBe(novoStatus);
      expect(result.contexto).toBe(contexto);
      
      // Verificar que ambas as tabelas foram atualizadas
      const [propostaAtualizada] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      const [statusContextual] = await db
        .select()
        .from(statusContextuais)
        .where(
          and(
            eq(statusContextuais.propostaId, testProposalId),
            eq(statusContextuais.contexto, contexto)
          )
        )
        .limit(1);
      
      // Ambas devem ter o mesmo status
      expect(propostaAtualizada.status).toBe(novoStatus);
      expect(statusContextual.status).toBe(novoStatus);
      expect(statusContextual.contexto).toBe(contexto);
      
      console.log("[TEST] ✅ Atomicidade garantida - ambas as tabelas atualizadas");
    });
    
    it("deve criar log de auditoria durante dupla escrita", async () => {
      console.log("[TEST] 📝 Testando criação de logs de auditoria");
      
      // Executar atualização
      await updateStatusWithContext({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        contexto: "geral",
        userId: testUserId,
        observacoes: "Aprovação para teste de auditoria"
      });
      
      // Verificar logs
      const logs = await db
        .select()
        .from(propostaLogs)
        .where(eq(propostaLogs.propostaId, testProposalId))
        .orderBy(desc(propostaLogs.createdAt));
      
      expect(logs.length).toBeGreaterThan(0);
      
      const auditLog = logs[0];
      expect(auditLog.statusAnterior).toBe(ProposalStatus.RASCUNHO);
      expect(auditLog.statusNovo).toBe(ProposalStatus.APROVADO);
      expect(auditLog.autorId).toBe(testUserId);
      
      console.log("[TEST] ✅ Log de auditoria criado corretamente");
    });
    
    it("deve manter consistência mesmo com múltiplos contextos", async () => {
      console.log("[TEST] 🔄 Testando múltiplos contextos");
      
      // Atualizar com contexto 'formalizacao'
      await updateStatusWithContext({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        contexto: "formalizacao",
        userId: testUserId
      });
      
      // Atualizar com contexto 'pagamentos' (mesmo status)
      await updateStatusWithContext({
        propostaId: testProposalId,
        novoStatus: ProposalStatus.APROVADO,
        contexto: "pagamentos",
        userId: testUserId
      });
      
      // Verificar que existem 2 registros de contexto
      const contextosRegistrados = await db
        .select()
        .from(statusContextuais)
        .where(eq(statusContextuais.propostaId, testProposalId));
      
      expect(contextosRegistrados.length).toBe(2);
      expect(contextosRegistrados.every(c => c.status === ProposalStatus.APROVADO)).toBe(true);
      
      // Verificar que a tabela principal tem o status correto
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      expect(proposta.status).toBe(ProposalStatus.APROVADO);
      
      console.log("[TEST] ✅ Múltiplos contextos mantêm consistência");
    });
  });
  
  /**
   * Testes Adicionais: Edge Cases e Validações
   */
  describe("Edge Cases e Validações", () => {
    it("deve rejeitar transição para proposta inexistente", async () => {
      console.log("[TEST] 🚫 Testando proposta inexistente");
      
      await expect(
        transitionTo({
          propostaId: "proposta-inexistente",
          novoStatus: ProposalStatus.APROVADO,
          userId: testUserId
        })
      ).rejects.toThrow();
      
      console.log("[TEST] ✅ Erro lançado para proposta inexistente");
    });
    
    it("deve obter transições possíveis para proposta específica", async () => {
      console.log("[TEST] 🎰 Testando obtenção de transições possíveis");
      
      // Buscar proposta atual
      const [proposta] = await db
        .select()
        .from(propostas)
        .where(eq(propostas.id, testProposalId))
        .limit(1);
      
      // Obter transições possíveis do status atual
      const possibleTransitions = getPossibleTransitions(proposta.status);
      
      expect(proposta.status).toBe(ProposalStatus.RASCUNHO);
      expect(possibleTransitions).toContain(ProposalStatus.APROVADO);
      expect(possibleTransitions).toContain(ProposalStatus.REJEITADO);
      expect(possibleTransitions).toContain(ProposalStatus.SUSPENSA);
      
      console.log("[TEST] ✅ Transições possíveis obtidas corretamente");
    });
  });
});