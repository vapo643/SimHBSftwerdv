# SOLUÇÃO: Chamadas Automáticas Excessivas para API do Banco Inter

## Problema Identificado
A tela de formalização estava fazendo chamadas automáticas desnecessárias para a API do Banco Inter apenas ao abrir, causando logs excessivos e possível sobrecarga da API.

## Causas Identificadas

### 1. Query dos Boletos Sem Restrições
```typescript
// ANTES - Problemático
const { data: collectionsData } = useQuery<any[]>({
  queryKey: ["/api/inter/collections", propostaId],
  queryFn: async (): Promise<any[]> => {
    const response = await apiRequest(`/api/inter/collections/${propostaId}`);
    return Array.isArray(response) ? response : [];
  },
  enabled: !!propostaId, // ❌ Executava para qualquer proposta
});
```

### 2. Invalidação Automática no Realtime
```typescript
// ANTES - Problemático
// Atualizar boletos
queryClient.invalidateQueries({
  queryKey: ["/api/inter/collections", propostaId]
}); // ❌ Invalidava sempre que qualquer campo mudava
```

### 3. Configurações de Cache Insuficientes
- Sem `staleTime` adequado
- Refetch automático no foco da janela
- Muitas tentativas de retry

## Soluções Implementadas

### 1. Query dos Boletos Otimizada
```typescript
// DEPOIS - Otimizado
const { data: collectionsData } = useQuery<any[]>({
  queryKey: ["/api/inter/collections", propostaId],
  queryFn: async (): Promise<any[]> => {
    if (!propostaId) return [];
    console.log(`[INTER QUERY] Buscando boletos para proposta: ${propostaId}`);
    const response = await apiRequest(`/api/inter/collections/${propostaId}`) as any[];
    console.log(`[INTER QUERY] Boletos encontrados: ${Array.isArray(response) ? response.length : 0}`);
    return Array.isArray(response) ? response : [];
  },
  enabled: !!propostaId && (proposta?.status === "contratos_assinados" || proposta?.interBoletoGerado), // ✅ Só executa quando relevante
  staleTime: 2 * 60 * 1000, // ✅ Cache por 2 minutos
  refetchOnWindowFocus: false, // ✅ Não refetch automático
  retry: 1, // ✅ Menos tentativas
});
```

### 2. Invalidação Inteligente no Realtime
```typescript
// DEPOIS - Otimizado
// Atualizar boletos APENAS se status mudou para contratos_assinados ou Inter foi ativado
if (newData?.status === "contratos_assinados" || newData?.interBoletoGerado !== oldData?.interBoletoGerado) {
  console.log("🔄 [REALTIME] Atualizando boletos Inter devido a mudança relevante");
  queryClient.invalidateQueries({
    queryKey: ["/api/inter/collections", propostaId]
  });
}
```

### 3. Otimização Geral das Queries
- **Query da Proposta**: Cache por 1 minuto, sem refetch automático
- **Query do ClickSign**: Só executa se CCB gerado e não assinado, cache por 2 minutos
- **Logs Limpos**: Removidos logs desnecessários da query da proposta

## Resultados Esperados

1. **Menos Chamadas**: API Inter só é chamada quando necessário
2. **Melhor Performance**: Cache evita refetches desnecessários
3. **Logs Limpos**: Menos spam no console
4. **UX Mantida**: Funcionalidade permanece intacta
5. **PDF Download**: Continua funcionando normalmente

## Comportamento Atual

### Quando a API Inter É Chamada:
✅ Quando proposta tem status "contratos_assinados"  
✅ Quando `interBoletoGerado` é true  
✅ Quando há mudança relevante via Realtime  

### Quando NÃO É Chamada:
❌ Ao abrir tela com status "aprovado"  
❌ Ao focar/desfocar a janela  
❌ A cada mudança irrelevante na proposta  
❌ Automaticamente em intervalos  

## Data de Implementação
12 de agosto de 2025

## Status
✅ Implementado e funcionando