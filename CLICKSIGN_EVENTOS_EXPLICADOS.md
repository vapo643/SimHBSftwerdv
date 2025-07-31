# 📋 EVENTOS CLICKSIGN - GUIA EXPLICATIVO

## 🎯 EVENTOS ESSENCIAIS (Configure estes)

### ⭐ `envelope.finished` - MAIS IMPORTANTE
**O que é**: Disparado quando TODOS os signatários assinaram
**O que faz no sistema**:
- ✅ Marca proposta como "contratos_assinados"
- ✅ **DISPARA BOLETO AUTOMÁTICO no Banco Inter**
- ✅ Atualiza data de assinatura
- ✅ Log: "CCB assinado com sucesso"

### 🚫 `envelope.cancelled`
**O que é**: Disparado quando envelope é cancelado
**O que faz no sistema**:
- ❌ Marca proposta como cancelada
- 📝 Log: "Envelope cancelado no ClickSign"

### ⏰ `envelope.expired` 
**O que é**: Disparado quando prazo de assinatura expira
**O que faz no sistema**:
- ⏰ Marca como expirado
- 📝 Log: "Prazo para assinatura excedido"

## 📊 EVENTOS INFORMATIVOS (Opcionais mas úteis)

### 📄 `envelope.created`
**O que é**: Disparado quando envelope é criado
**O que faz**: Apenas log informativo

### ✍️ `signer.signed`
**O que é**: Disparado quando UMA pessoa assina (individual)
**O que faz**: Log de quem assinou e quando

### ❌ `signer.refused`
**O que é**: Disparado quando alguém recusa assinar
**O que faz**: Log de recusa + marca proposta

## ❌ EVENTOS DESNECESSÁRIOS (Não configure)

- `envelope.updated` - Muitos disparos desnecessários
- `document.created` - Redundante
- `document.signed` - Use `signer.signed` 
- `signer.updated` - Pouco relevante

## 🎯 CONFIGURAÇÃO RECOMENDADA

**Para começar (mínimo):**
```
✅ envelope.finished
✅ envelope.cancelled  
✅ envelope.expired
```

**Para monitoramento completo:**
```
✅ envelope.finished
✅ envelope.cancelled
✅ envelope.expired
✅ envelope.created
✅ signer.signed
✅ signer.refused
```

## 🔄 FLUXO TÍPICO

1. **Cliente assina CCB** → `signer.signed` (informativo)
2. **Todos assinaram** → `envelope.finished` ⭐ **DISPARA BOLETO**
3. **Sistema atualiza** → Proposta vira "contratos_assinados"
4. **Boleto gerado** → Cliente recebe para pagamento

## ⚡ RESUMO

**O evento mais importante é `envelope.finished`** - é ele que faz toda a mágica acontecer automaticamente. Os outros são para logs e controle.

Configure pelo menos os 3 essenciais, e o sistema vai funcionar perfeitamente!