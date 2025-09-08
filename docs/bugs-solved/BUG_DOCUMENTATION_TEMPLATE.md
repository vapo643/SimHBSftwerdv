# 🐛 TEMPLATE OBRIGATÓRIO - Documentação de Bug

**⚠️ POLÍTICA MANDATÓRIA: Todo bug resolvido DEVE ser documentado usando este template**

## 📋 Checklist de Documentação

- [ ] Arquivo criado em pasta específica: `docs/bugs-solved/[categoria]/YYYY-MM-DD-nome-descritivo.md`
- [ ] Categoria correta escolhida: `critical/`, `high/`, `medium/`, `low/`
- [ ] Template completo preenchido (todas as seções)
- [ ] Código ANTES e DEPOIS incluído
- [ ] Evidências de validação documentadas
- [ ] README.md atualizado com novo bug
- [ ] replit.md atualizado se necessário

---

# [CATEGORIA] Nome do Bug - Data Resolução

## 🔍 Descrição do Problema

- **Impacto:** [Crítico/Alto/Médio/Baixo]
- **Área Afetada:** [Frontend/Backend/Database/API/etc]
- **Descoberto em:** [Data/Context]
- **Reportado por:** [Fonte]

## 🚨 Sintomas Observados

- Lista dos comportamentos incorretos observados
- Screenshots ou logs se aplicável
- Impacto no usuário final

## 🔬 Análise Técnica

### Root Cause Analysis

- Explicação detalhada da causa raiz
- Código problemático identificado
- Fatores contribuintes

### Código Problemático (ANTES)

```[language]
// Código que causava o problema
```

### Problemas Identificados

1. **Problema 1:** Descrição
2. **Problema 2:** Descrição

## ✅ Solução Implementada

### Código Corrigido (DEPOIS)

```[language]
// Código corrigido
```

### Arquivos Modificados

- `caminho/para/arquivo1.ext` - Descrição da mudança
- `caminho/para/arquivo2.ext` - Descrição da mudança

### Estratégia de Correção

- Abordagem técnica utilizada
- Justificativa das escolhas feitas

## 🧪 Validação

### Testes Executados

- [ ] **Cenário 1:** Descrição → Resultado
- [ ] **Cenário 2:** Descrição → Resultado
- [ ] **Cenário 3:** Descrição → Resultado

### Evidências de Correção

```
ANTES: Comportamento incorreto
DEPOIS: Comportamento correto
```

### Métricas de Sucesso

- Performance melhorada
- Erros eliminados
- Funcionalidade restaurada

## 📊 Impacto da Correção

### Benefícios Alcançados

- **Imediatos:** Lista de benefícios diretos
- **Longo prazo:** Impactos futuros positivos
- **Preventivos:** Problemas evitados

### Áreas Melhoradas

- Funcionalidade X melhorada
- Performance Y otimizada
- Segurança Z fortalecida

## 🔄 Prevenção Futura

### Medidas Preventivas

- Testes automatizados adicionados
- Validações implementadas
- Documentação criada

### Lições Aprendidas

- O que causou o bug
- Como evitar no futuro
- Melhorias de processo

---

**Resolução:** ✅ Completa / 🔄 Em Progresso / ❌ Bloqueada  
**Executor:** [Nome/Team]  
**Tempo de resolução:** [Duração]  
**Documentação adicional:** [Links para outros docs]

---

## 📝 Notas de Implementação

### Passos para Usar Este Template:

1. **Copie este template** para um novo arquivo
2. **Nomeie o arquivo:** `YYYY-MM-DD-nome-descritivo.md`
3. **Coloque na categoria correta:** critical/, high/, medium/, low/
4. **Preencha TODAS as seções** - sem exceções
5. **Inclua evidências visuais** quando possível
6. **Atualize o README.md** da pasta bugs-solved
7. **Referencie no replit.md** se for mudança arquitetural

### Exemplos de Nomes de Arquivo:

- `2025-08-21-parsing-monetario-multiplicacao-100x.md`
- `2025-08-20-transacao-atomica-webhooks.md`
- `2025-07-15-memory-leak-react-components.md`

### Categorização:

- **Critical:** Produção quebrada, dados corrompidos, segurança
- **High:** Funcionalidade principal afetada, UX ruim
- **Medium:** Inconvenientes, edge cases, melhorias
- **Low:** Cosméticos, otimizações menores

**LEMBRE-SE: ZERO TOLERÂNCIA para bugs não documentados!**
