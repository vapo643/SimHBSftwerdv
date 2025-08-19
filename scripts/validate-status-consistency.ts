#!/usr/bin/env tsx
/**
 * PAM V1.0 - Script de Validação de Consistência de Status
 * 
 * Objetivo: Validar que a dupla escrita está funcionando corretamente
 * comparando os status entre a tabela legada (propostas) e a nova
 * tabela (status_contextuais).
 * 
 * Execução: npm run validate:status
 */

import { db } from "../server/lib/supabase";
import { propostas, statusContextuais } from "../shared/schema";
import { eq, sql, desc, and, isNull } from "drizzle-orm";

// Cores para output no console
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

interface ValidationResult {
  totalPropostas: number;
  totalComContexto: number;
  totalSemContexto: number;
  inconsistencias: Array<{
    propostaId: string;
    statusLegado: string | null;
    statusContextual: string | null;
    contexto: string | null;
    ultimaAtualizacao: Date | null;
  }>;
  propostasOrfas: string[]; // Propostas sem registro em status_contextuais
}

/**
 * Função principal de validação
 */
async function validateStatusConsistency(): Promise<ValidationResult> {
  console.log(`${colors.cyan}${colors.bright}======================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  VALIDAÇÃO DE CONSISTÊNCIA DE STATUS${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}======================================${colors.reset}\n`);
  
  const startTime = Date.now();
  
  try {
    // 1. Buscar todas as propostas ativas (não deletadas)
    console.log(`${colors.blue}[1/4] Buscando propostas...${colors.reset}`);
    const allPropostas = await db
      .select({
        id: propostas.id,
        status: propostas.status,
        createdAt: propostas.createdAt,
      })
      .from(propostas)
      .where(isNull(propostas.deletedAt))
      .orderBy(desc(propostas.createdAt));
    
    console.log(`  ✓ Encontradas ${colors.bright}${allPropostas.length}${colors.reset} propostas\n`);
    
    // 2. Buscar todos os registros de status_contextuais
    console.log(`${colors.blue}[2/4] Buscando registros contextuais...${colors.reset}`);
    const allContextuais = await db
      .select()
      .from(statusContextuais)
      .orderBy(desc(statusContextuais.atualizadoEm));
    
    console.log(`  ✓ Encontrados ${colors.bright}${allContextuais.length}${colors.reset} registros contextuais\n`);
    
    // 3. Criar mapa de status contextuais mais recentes por proposta
    console.log(`${colors.blue}[3/4] Analisando consistência...${colors.reset}`);
    const contextualMap = new Map<string, typeof allContextuais[0]>();
    
    // Agrupar por proposta_id e pegar o mais recente
    for (const ctx of allContextuais) {
      const existing = contextualMap.get(ctx.propostaId);
      if (!existing || ctx.atualizadoEm > existing.atualizadoEm) {
        contextualMap.set(ctx.propostaId, ctx);
      }
    }
    
    // 4. Comparar e identificar inconsistências
    const inconsistencias: ValidationResult['inconsistencias'] = [];
    const propostasOrfas: string[] = [];
    let totalComContexto = 0;
    let totalSemContexto = 0;
    
    for (const proposta of allPropostas) {
      const contextual = contextualMap.get(proposta.id);
      
      if (!contextual) {
        // Proposta sem registro em status_contextuais
        totalSemContexto++;
        propostasOrfas.push(proposta.id);
        
        // Só considerar órfã se a proposta não for muito antiga (criada após implementação)
        const dataImplementacao = new Date('2025-08-19'); // Data da implementação da dupla escrita
        if (proposta.createdAt && proposta.createdAt > dataImplementacao) {
          console.log(`  ${colors.yellow}⚠ Proposta órfã: ${proposta.id} (sem registro contextual)${colors.reset}`);
        }
      } else {
        totalComContexto++;
        
        // Comparar status
        if (proposta.status !== contextual.status) {
          inconsistencias.push({
            propostaId: proposta.id,
            statusLegado: proposta.status,
            statusContextual: contextual.status,
            contexto: contextual.contexto,
            ultimaAtualizacao: contextual.atualizadoEm,
          });
          
          console.log(`  ${colors.red}✗ INCONSISTÊNCIA: Proposta ${proposta.id}${colors.reset}`);
          console.log(`    Status Legado: ${colors.yellow}${proposta.status}${colors.reset}`);
          console.log(`    Status Contextual: ${colors.green}${contextual.status}${colors.reset}`);
          console.log(`    Contexto: ${contextual.contexto}`);
          console.log(`    Última Atualização: ${contextual.atualizadoEm}\n`);
        }
      }
    }
    
    const elapsedTime = Date.now() - startTime;
    
    // 5. Relatório final
    console.log(`\n${colors.cyan}${colors.bright}======================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}           RELATÓRIO FINAL${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}======================================${colors.reset}\n`);
    
    console.log(`${colors.bright}📊 ESTATÍSTICAS:${colors.reset}`);
    console.log(`  • Total de Propostas: ${allPropostas.length}`);
    console.log(`  • Com Status Contextual: ${colors.green}${totalComContexto}${colors.reset}`);
    console.log(`  • Sem Status Contextual: ${colors.yellow}${totalSemContexto}${colors.reset}`);
    console.log(`  • Taxa de Cobertura: ${colors.bright}${((totalComContexto / allPropostas.length) * 100).toFixed(2)}%${colors.reset}`);
    console.log(`  • Tempo de Execução: ${elapsedTime}ms\n`);
    
    if (inconsistencias.length === 0) {
      console.log(`${colors.green}${colors.bright}✅ [CONSISTÊNCIA VALIDADA]${colors.reset}`);
      console.log(`${colors.green}Verificadas ${allPropostas.length} propostas. Nenhuma inconsistência encontrada.${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ [INCONSISTÊNCIAS DETECTADAS]${colors.reset}`);
      console.log(`${colors.red}Encontradas ${inconsistencias.length} inconsistências em ${allPropostas.length} propostas.${colors.reset}`);
      
      // Listar IDs das propostas inconsistentes
      console.log(`\n${colors.bright}IDs das Propostas Inconsistentes:${colors.reset}`);
      inconsistencias.forEach(inc => {
        console.log(`  • ${inc.propostaId}`);
      });
    }
    
    // Alertar sobre propostas órfãs recentes
    const dataImplementacao = new Date('2025-08-19');
    const orfasRecentes = propostasOrfas.filter(id => {
      const prop = allPropostas.find(p => p.id === id);
      return prop && prop.createdAt && prop.createdAt > dataImplementacao;
    });
    
    if (orfasRecentes.length > 0) {
      console.log(`\n${colors.yellow}${colors.bright}⚠ PROPOSTAS ÓRFÃS RECENTES:${colors.reset}`);
      console.log(`${colors.yellow}${orfasRecentes.length} propostas criadas após 19/08/2025 sem status contextual:${colors.reset}`);
      orfasRecentes.slice(0, 5).forEach(id => {
        console.log(`  • ${id}`);
      });
      if (orfasRecentes.length > 5) {
        console.log(`  ... e mais ${orfasRecentes.length - 5} outras`);
      }
    }
    
    console.log(`\n${colors.cyan}======================================${colors.reset}\n`);
    
    return {
      totalPropostas: allPropostas.length,
      totalComContexto,
      totalSemContexto,
      inconsistencias,
      propostasOrfas,
    };
    
  } catch (error) {
    console.error(`${colors.red}${colors.bright}❌ ERRO NA VALIDAÇÃO:${colors.reset}`);
    console.error(error);
    throw error;
  }
}

/**
 * Função para executar validação específica por contexto
 */
async function validateByContext(contexto: string): Promise<void> {
  console.log(`\n${colors.blue}Validando contexto: ${colors.bright}${contexto}${colors.reset}`);
  
  const contextRecords = await db
    .select()
    .from(statusContextuais)
    .where(eq(statusContextuais.contexto, contexto))
    .orderBy(desc(statusContextuais.atualizadoEm));
  
  console.log(`  Encontrados ${contextRecords.length} registros no contexto '${contexto}'`);
  
  // Validar unicidade por proposta_id + contexto
  const seen = new Set<string>();
  const duplicates: string[] = [];
  
  for (const record of contextRecords) {
    if (seen.has(record.propostaId)) {
      duplicates.push(record.propostaId);
    }
    seen.add(record.propostaId);
  }
  
  if (duplicates.length > 0) {
    console.log(`  ${colors.red}⚠ Duplicatas encontradas: ${duplicates.length} propostas com múltiplos registros${colors.reset}`);
  } else {
    console.log(`  ${colors.green}✓ Nenhuma duplicata encontrada${colors.reset}`);
  }
}

/**
 * Função principal - ponto de entrada do script
 */
async function main() {
  try {
    // Executar validação principal
    const result = await validateStatusConsistency();
    
    // Validar cada contexto individualmente
    console.log(`\n${colors.cyan}${colors.bright}VALIDAÇÃO POR CONTEXTO:${colors.reset}`);
    await validateByContext('geral');
    await validateByContext('pagamentos');
    await validateByContext('cobrancas');
    await validateByContext('formalizacao');
    
    // Determinar código de saída
    const exitCode = result.inconsistencias.length > 0 ? 1 : 0;
    
    console.log(`\n${colors.bright}Script finalizado com código de saída: ${exitCode}${colors.reset}`);
    process.exit(exitCode);
    
  } catch (error) {
    console.error(`${colors.red}${colors.bright}Erro fatal na execução do script:${colors.reset}`, error);
    process.exit(2);
  }
}

// Executar se chamado diretamente
// Em ES modules, usamos import.meta.url
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { validateStatusConsistency, validateByContext };