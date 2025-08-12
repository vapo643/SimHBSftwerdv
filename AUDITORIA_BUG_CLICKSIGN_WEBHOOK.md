# 🚨 AUDITORIA CRÍTICA - BUG CLICKSIGN + WEBHOOK

**Data:** 12 de Agosto de 2025  
**Status:** BUG IDENTIFICADO - Race Condition Crítica

---

## 🎯 PROBLEMA IDENTIFICADO

**Sintoma:** Link ClickSign aparece e depois some, voltando para o botão azul

**Causa Raiz:** Race condition entre múltiplas fontes de verdade:

1. **Estado local** (`clickSignData`) - definido imediatamente após clique
2. **Query do servidor** (`initialClickSignData`) - busca status via API
3. **Realtime webhook** - invalida queries quando há UPDATE na tabela

---

## 🔍 FLUXO DO BUG

### **Passo 1: Clique no botão azul**
```javascript
// ✅ Link aparece (estado local)
setClickSignData(response);

// ❌ PROBLEMA: refetch() desnecessário 
refetch(); // Recarrega dados da proposta
```

### **Passo 2: refetch() executa**
```javascript
// Query principal recarrega: "/api/propostas/formalizacao"
// Query ClickSign pode rodar novamente: "/api/clicksign/status"
```

### **Passo 3: useEffect problemático**
```javascript
React.useEffect(() => {
  if (initialClickSignData?.signUrl) {
    setClickSignData(initialClickSignData); // ✅ OK
  } else {
    setClickSignData(null); // ❌ RESETA O LINK!
  }
}, [initialClickSignData]);
```

### **Passo 4: Realtime agrava o problema**
```javascript
// Webhook UPDATE trigger
queryClient.invalidateQueries({
  queryKey: ["/api/clicksign/status", propostaId] // ❌ Re-executa query
});
```

---

## 🔧 CORREÇÕES NECESSÁRIAS

### 1. **Remover refetch() desnecessário**
```javascript
// ❌ ANTES:
setClickSignData(response);
refetch(); // Remove isso!

// ✅ DEPOIS:
setClickSignData(response);
// Sem refetch - dados locais são suficientes
```

### 2. **Proteger useEffect contra reset**
```javascript
// ❌ ANTES:
if (initialClickSignData?.signUrl) {
  setClickSignData(initialClickSignData);
} else {
  setClickSignData(null); // Sempre reseta
}

// ✅ DEPOIS:
if (initialClickSignData?.signUrl) {
  setClickSignData(initialClickSignData);
} else if (!clickSignData) {
  // Só reseta se não tem dados locais
  setClickSignData(null);
}
```

### 3. **Ser seletivo no realtime**
```javascript
// ❌ ANTES: Invalida TUDO
queryClient.invalidateQueries({
  queryKey: ["/api/clicksign/status", propostaId]
});

// ✅ DEPOIS: Apenas se necessário
if (payload.new.status !== payload.old.status) {
  // Só invalida se status mudou
  queryClient.invalidateQueries({
    queryKey: ["/api/clicksign/status", propostaId]
  });
}
```

---

## 📊 DIAGNÓSTICO TÉCNICO

| Componente | Status | Ação |
|------------|--------|------|
| Estado local | ❌ Resetado | Proteger contra overwrites |
| refetch() | ❌ Desnecessário | Remover após ClickSign |
| useEffect | ❌ Agressivo | Adicionar proteção |
| Realtime | ❌ Invasivo | Ser mais seletivo |
| Webhook | ✅ Funcional | Manter |

---

## 🚀 PLANO DE CORREÇÃO

1. **Imediato:** Remover `refetch()` após envio ClickSign
2. **Crítico:** Proteger useEffect contra reset
3. **Otimização:** Melhorar seletividade do realtime
4. **Validação:** Testar fluxo completo

## ✅ CORREÇÕES APLICADAS

### 1. **Removido refetch() desnecessário** ✅
- Após envio ClickSign não chama mais `refetch()`
- Estado local permanece intacto

### 2. **Proteção no useEffect** ✅
- Só reseta `clickSignData` se não tem dados locais
- Evita race condition com webhook

### 3. **Realtime seletivo** ✅
- Só invalida query ClickSign se status realmente mudou
- Preserva estado local quando possível

## 🎯 CORREÇÕES FINAIS APLICADAS

### 4. **Timeline sincronizada** ✅  
- Timeline agora reconhece `status === "contratos_assinados"`
- Mostra mensagem de sucesso quando assinado
- Remove botões de ClickSign após assinatura

### 5. **Persistência após F5** ✅
- Usa `initialClickSignData?.signUrl` para recuperar link
- Condições corrigidas para evitar botão azul incorreto

### 6. **Realtime seletivo ativado** ✅
- Só invalida quando status muda para "contratos_assinados"
- Timeline atualiza automaticamente via webhook

**Status:** ✅ COMPLETAMENTE CORRIGIDO

**Fluxo Final:**
1. Clique botão → Link aparece imediatamente
2. F5 → Link permanece (via initialClickSignData)
3. Webhook assina → Timeline atualiza automaticamente 
4. Mostra "Contrato Assinado com Sucesso"