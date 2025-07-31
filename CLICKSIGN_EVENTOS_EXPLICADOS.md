# 📋 EVENTOS CLICKSIGN - GUIA EXPLICATIVO

## 🎯 EVENTOS ESSENCIAIS (Configure estes)

### ⭐ `auto_close` - MAIS IMPORTANTE
**O que é**: Disparado quando documento é finalizado automaticamente após última assinatura
**O que faz no sistema**:
- ✅ Marca proposta como "contratos_assinados"
- ✅ **DISPARA BOLETO AUTOMÁTICO no Banco Inter**
- ✅ Atualiza data de assinatura
- ✅ Log: "CCB assinado com sucesso"

### 📄 `document_closed`
**O que é**: Disparado quando documento assinado está pronto para download
**O que faz no sistema**:
- 📄 Confirma que documento está finalizado
- 📝 Log: "Documento pronto para download"

### 🚫 `cancel`
**O que é**: Disparado quando documento é cancelado manualmente
**O que faz no sistema**:
- ❌ Marca proposta como cancelada
- 📝 Log: "Documento cancelado no ClickSign"

### ⏰ `deadline` 
**O que é**: Disparado quando data limite é atingida
**O que faz no sistema**:
- ⏰ Marca como expirado se não foi assinado
- ⏰ Finaliza se tem pelo menos uma assinatura
- 📝 Log: "Prazo para assinatura excedido"

## 📊 EVENTOS INFORMATIVOS (Opcionais mas úteis)

### 📤 `upload`
**O que é**: Disparado quando documento é enviado
**O que faz**: Log de upload do CCB

### ✍️ `sign`
**O que é**: Disparado quando UMA pessoa assina (individual)
**O que faz**: Log de quem assinou e quando

### ❌ `refusal`
**O que é**: Disparado quando documento é recusado
**O que faz**: Log de recusa + marca proposta

### 👥 `add_signer`
**O que é**: Disparado quando signatários são adicionados
**O que faz**: Log informativo

## ❌ EVENTOS DESNECESSÁRIOS (Não configure)

- `add_image` - Não relevante para CCB
- `remove_signer` - Raramente usado
- `close` - Use `auto_close` 
- `update_deadline` - Pouco relevante
- `update_auto_close` - Configuração, não negócio
- `custom` - Específico demais
- Todos os eventos de WhatsApp/Biometria (se não usar)

## 🎯 CONFIGURAÇÃO RECOMENDADA

**Para começar (mínimo):**
```
✅ auto_close
✅ cancel  
✅ deadline
```

**Para monitoramento completo:**
```
✅ auto_close
✅ document_closed
✅ cancel
✅ deadline
✅ upload
✅ sign
✅ refusal
```

## 🔄 FLUXO TÍPICO

1. **Cliente assina CCB** → `sign` (informativo)
2. **Todos assinaram** → `auto_close` ⭐ **DISPARA BOLETO**
3. **Documento pronto** → `document_closed` (confirmação)
4. **Sistema atualiza** → Proposta vira "contratos_assinados"
5. **Boleto gerado** → Cliente recebe para pagamento

## ⚡ RESUMO

**O evento mais importante é `auto_close`** - é ele que faz toda a mágica acontecer automaticamente. Os outros são para logs e controle.

Configure pelo menos os 3 essenciais, e o sistema vai funcionar perfeitamente!