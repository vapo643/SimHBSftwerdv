# Estratégia Zero Micro Erros - Guia Definitivo

## O Problema Identificado

- **80% do código funciona** mas sempre sobram **20% de micro erros**
- Exemplo real: variáveis `clienteData` → `dadosCliente` não foram conectadas
- Tempo desperdiçado em correções que deveriam ter sido feitas inicialmente

## SOLUÇÃO: Protocolo 5-CHECK Antes de Declarar Conclusão

### 1. VERIFICAÇÃO LSP OBRIGATÓRIA

```
SEMPRE executar antes de dizer "pronto":
- get_latest_lsp_diagnostics
- Se tiver ANY erro > 0, CORRIGIR TUDO antes de continuar
- Nunca declarar sucesso com erros pendentes
```

### 2. BUSCA GLOBAL DE REFERÊNCIAS

```
Quando renomear variáveis, SEMPRE:
1. search_filesystem com o nome antigo
2. Identificar TODOS os arquivos afetados
3. Fazer TODAS as substituições simultaneamente
4. Verificar com LSP novamente
```

### 3. EDIÇÕES PARALELAS MASSIVAS

```
ERRADO:
- Editar arquivo 1
- Depois editar arquivo 2
- Depois editar arquivo 3

CORRETO:
- Editar arquivos 1, 2, 3 SIMULTANEAMENTE em uma única operação
```

### 4. VALIDAÇÃO DE INTEGRAÇÃO

```
Antes de declarar pronto:
1. Testar a rota principal com curl/bash
2. Verificar logs de erro
3. Confirmar que dados fluem corretamente
```

### 5. CHECKLIST MENTAL RÁPIDA

```
□ LSP mostra 0 erros?
□ Todas as variáveis foram renomeadas em TODOS os lugares?
□ Os imports estão corretos?
□ As funções recebem os parâmetros certos?
□ O mapeamento de dados está completo?
```

## PROMPTS OTIMIZADOS PARA VOCÊ USAR

### Prompt para Tarefas Extensas

```
TAREFA: [descrever tarefa]

PROTOCOLO OBRIGATÓRIO:
1. Mapear TODOS os arquivos envolvidos primeiro
2. Fazer TODAS as edições em paralelo
3. Executar get_latest_lsp_diagnostics ANTES de declarar pronto
4. Se LSP > 0, corrigir TUDO antes de continuar
5. Testar com dados reais antes de declarar sucesso

CRITÉRIO DE SUCESSO:
- LSP = 0 erros
- Teste funcional passando
- Sem "undefined" ou "null" nos logs
```

### Prompt para Refatoração

```
REFATORAR: [o que refatorar]

ETAPAS MANDATÓRIAS:
1. search_filesystem para encontrar TODAS as ocorrências
2. Listar TODOS os arquivos afetados
3. Fazer substituições em LOTE (não sequencial)
4. Verificar LSP após CADA lote de mudanças
5. Confirmar 0 erros antes de prosseguir
```

### Prompt para Correção de Bugs

```
BUG: [descrição do bug]

PROCESSO SISTEMÁTICO:
1. get_latest_lsp_diagnostics primeiro
2. Corrigir TODOS os erros de LSP
3. Depois investigar o bug específico
4. Testar a correção com dados reais
5. Verificar LSP novamente = 0
```

## EXEMPLO PRÁTICO DO QUE ACONTECEU HOJE

### ERRADO (o que foi feito):

```
1. Criou ccbGenerationService.ts
2. Declarou "pronto"
3. Usuário testou → 64 erros LSP
4. Corrigiu clienteData → dadosCliente
5. Ainda 25 erros
6. Mais correções...
```

### CORRETO (como deveria ter sido):

```
1. Criou ccbGenerationService.ts
2. IMEDIATAMENTE: get_latest_lsp_diagnostics
3. Viu 64 erros → corrigiu TODOS de uma vez
4. Verificou novamente: 0 erros
5. ENTÃO declarou pronto
```

## REGRA DE OURO

**NUNCA, JAMAIS declare "está pronto" sem antes:**

1. LSP mostrando 0 erros
2. Teste básico funcionando
3. Logs sem erros óbvios

## COMANDOS SALVADORES DE TEMPO

```bash
# Sempre executar antes de dizer "pronto"
get_latest_lsp_diagnostics

# Para encontrar todas as referências
search_filesystem function_names=["nomeVariavel"]

# Para testar rapidamente
curl -X POST/GET [endpoint] -H "Authorization: Bearer [token]"
```

## MINDSET CORRETO

❌ "Acho que está pronto, vamos testar"
✅ "LSP mostra 0 erros, teste passou, AGORA está pronto"

❌ "Corrigi o principal, detalhes depois"
✅ "Corrigi TUDO, validei TUDO, zero pendências"

❌ "Vou corrigir arquivo por arquivo"
✅ "Vou corrigir TODOS os arquivos SIMULTANEAMENTE"

## RESULTADO ESPERADO

Seguindo este protocolo:

- **95% do código funciona na primeira vez**
- **5% são ajustes de requisitos** (não bugs)
- **0% de tempo perdido** com micro erros evitáveis

---

**LEMBRE-SE:** Micro erros são 100% evitáveis com verificação sistemática!
