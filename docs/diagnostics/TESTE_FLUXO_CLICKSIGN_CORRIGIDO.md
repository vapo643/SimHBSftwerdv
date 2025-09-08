# 🧪 GUIA DE TESTE - FLUXO CLICKSIGN CORRIGIDO

**Data:** 12 de Agosto de 2025  
**Versão:** Pós-correção do bug "Link Desaparece"

---

## 🎯 CENÁRIOS DE TESTE

### **CENÁRIO 1: Estado Inicial Correto**

**Objetivo:** Verificar que apenas o botão azul aparece para propostas não enviadas

**Passos:**

1. Acesse proposta que NUNCA foi enviada ao ClickSign
2. Navegue para /formalizacao/{proposta_id}
3. Vá até a seção "Assinatura Eletrônica"

**Resultado Esperado:**

- ✅ Apenas o botão azul "Enviar Contrato para Assinatura (ClickSign)" está visível
- ❌ Link de assinatura NÃO deve estar visível
- ❌ Botão "Gerar Novo Link" NÃO deve estar visível

---

### **CENÁRIO 2: Primeiro Envio**

**Objetivo:** Verificar transição do estado inicial para posterior

**Passos:**

1. Com proposta no estado inicial, clique em "Enviar Contrato para Assinatura (ClickSign)"
2. Aguarde processamento
3. Observe mudanças na interface

**Resultado Esperado:**

- 🔄 Botão muda para "Enviando para ClickSign..." (loading)
- ✅ Toast de sucesso aparece
- 📤 Link de assinatura aparece em caixa verde
- 🔄 Botão "Gerar Novo Link" aparece
- ❌ Botão azul inicial desaparece

**Console Debug Esperado:**

```
🚀 [CLICKSIGN] Enviando CCB para proposta: {id}
✅ [CLICKSIGN] Resposta recebida: {signUrl: "...", envelopeId: "..."}
```

---

### **CENÁRIO 3: Regeneração (Bug Corrigido)**

**Objetivo:** Verificar que o link nunca desaparece durante regeneração

**Passos:**

1. Com link já visível, clique em "Gerar Novo Link"
2. Observe o comportamento da interface
3. Aguarde processamento completo

**Resultado Esperado:**

- ✅ **Link permanece visível o tempo todo**
- 🔄 Botão muda para "Regenerando..." (loading)
- ✅ Toast "Link Regenerado" aparece (duração 4s)
- 📝 Novo link substitui o anterior
- ❌ **NÃO deve aparecer toast "Atualização em tempo real"**

**Console Debug Esperado:**

```
🔄 [CLICKSIGN] Regenerando link para proposta: {id}
📊 [CLICKSIGN] Estado atual: {signUrl: "...", envelopeId: "..."}
✅ [CLICKSIGN] Novo link gerado: {signUrl: "...", envelopeId: "..."}
```

---

### **CENÁRIO 4: Navegação e Persistência**

**Objetivo:** Verificar que a timeline persiste mesmo saindo da tela

**Passos:**

1. Com link gerado, saia da tela de formalização
2. Navegue para outra seção do sistema
3. Volte para a tela de formalização
4. Verifique se o estado se mantém

**Resultado Esperado:**

- ✅ Link continua visível após voltar
- ✅ Botão "Gerar Novo Link" continua presente
- ❌ NÃO volta para o estado inicial

**Console Debug Esperado:**

```
🔄 [CLICKSIGN] Dados iniciais recebidos: {signUrl: "...", envelopeId: "..."}
```

---

### **CENÁRIO 5: Timeline Realtime**

**Objetivo:** Verificar que atualizações via webhook não interferem na UX

**Passos:**

1. Simule uma atualização via webhook (assinatura completa)
2. Observe se aparecem toasts desnecessários
3. Verifique se a timeline é atualizada silenciosamente

**Resultado Esperado:**

- ✅ Timeline atualiza automaticamente
- ❌ **NÃO deve aparecer toast "Atualização em tempo real"**
- 📝 Logs mostram atualização silenciosa

**Console Debug Esperado:**

```
📡 [REALTIME] Evento recebido: {eventType: "UPDATE", ...}
🔄 [REALTIME] Proposta atualizada silenciosamente
```

---

## 🔧 TESTE MANUAL RÁPIDO

### **URL de Teste:**

```
/formalizacao/88a44696-9b63-42ee-aa81-15f9519d24cb
```

### **Estados da Máquina:**

1. **Estado Inicial:** `!proposta.clicksignSignUrl && !clickSignData`
2. **Estado Posterior:** `clickSignData?.signUrl || proposta.clicksignSignUrl`

### **Ações de Debug:**

- Abrir Console (F12) para ver logs
- Observar transições de estado
- Verificar toasts e suas mensagens

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Estado inicial mostra apenas botão azul
- [ ] Primeiro envio funciona corretamente
- [ ] Link nunca desaparece durante regeneração
- [ ] Timeline persiste após navegação
- [ ] Toasts desnecessários eliminados
- [ ] Console logs informativos funcionais
- [ ] 0 erros de TypeScript
- [ ] Interface responsiva em todos os estados
