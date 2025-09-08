# 🎯 GUIA PRÁTICO: CALIBRAÇÃO DE COORDENADAS CCB

## Como Usar o Sistema na Prática

Você já tem coordenadas manuais. O sistema de calibração serve para **TESTAR e REFINAR** essas coordenadas.

## 🔧 **PASSO 1: Teste Rápido das Suas Coordenadas**

```bash
# Teste suas coordenadas atuais com dados reais
curl -X POST "http://localhost:5000/api/ccb-calibration/quick-test" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"
```

**O que isso faz:**

- Pega suas coordenadas do `ccbFieldMapping.ts`
- Aplica dados de teste (João Silva, CPF, R$ 50.000)
- Gera PDF com dados posicionados nas suas coordenadas
- Pontos vermelhos mostram onde cada campo está posicionado

## 🎨 **PASSO 2: Gerar Grid Visual**

```bash
# Gera grid de coordenadas sobre o template
curl -X POST "http://localhost:5000/api/ccb-calibration/generate-grid" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gridSpacing": 50,
    "showCoordinates": true,
    "highlightFields": ["nomeCliente", "valorEmprestimo", "dataEmissao"]
  }'
```

**O que isso faz:**

- Sobrepõe linhas de grid no template original
- Mostra números X/Y para você identificar coordenadas
- Destaca campos específicos em verde
- Ajuda a ver se suas coordenadas estão corretas

## 🧪 **PASSO 3: Teste com Seus Próprios Dados**

```bash
# Teste com dados específicos
curl -X POST "http://localhost:5000/api/ccb-calibration/test-positions" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testData": {
      "nomeCliente": "Maria Santos de Oliveira",
      "cpfCliente": "987.654.321-00",
      "valorEmprestimo": "R$ 75.500,00",
      "numeroParcelas": "36",
      "dataEmissao": "08/08/2025"
    }
  }'
```

## 📋 **PROCESSO ITERATIVO DE AJUSTE**

### **ETAPA A: Identifique Problemas**

1. Execute teste rápido
2. Abra o PDF gerado
3. Verifique se os textos estão nas posições corretas
4. Anote quais campos precisam ajuste

### **ETAPA B: Ajuste Coordenadas**

```typescript
// No seu ccbFieldMapping.ts, ajuste as coordenadas
nomeCliente: {
  x: 120, // ← Se texto está muito à esquerda, aumente
  y: 680, // ← Se texto está muito baixo, aumente
  size: 12,
},
```

### **ETAPA C: Teste Novamente**

1. Execute teste rápido novamente
2. Compare com versão anterior
3. Repita até ficar perfeito

## 🎯 **EXEMPLO PRÁTICO REAL**

**Suas coordenadas atuais:**

```typescript
nomeCliente: { x: 120, y: 680, size: 12 }
valorEmprestimo: { x: 200, y: 580, size: 12 }
```

**Teste revela problema:**

- Nome aparece cortado (muito longo)
- Valor fica sobre linha do template

**Ajustes:**

```typescript
nomeCliente: {
  x: 120,
  y: 680,
  size: 10, // ← Diminuiu fonte
  maxWidth: 350 // ← Limitou largura
}
valorEmprestimo: {
  x: 200,
  y: 590, // ← Subiu 10 pixels
  size: 12
}
```

## 📊 **DICAS PRÁTICAS**

**Para ajustar posição:**

- **X maior** = move para direita
- **Y maior** = move para cima (PDF usa origem embaixo-esquerda)
- **Size menor** = texto menor, cabe melhor

**Para textos longos:**

- Use `maxWidth` para quebrar linha
- Diminua `size` da fonte
- Teste com nomes/valores reais longos

**Para debug:**

- Grid spacing 25px = precisão alta
- Grid spacing 50px = visão geral
- Destaque campos problemáticos no grid

## ⚡ **FLUXO COMPLETO**

1. **Diagnose** → Analisa seu template
2. **Grid** → Gera overlay visual
3. **Test** → Aplica suas coordenadas
4. **Adjust** → Modifica ccbFieldMapping.ts
5. **Repeat** → Testa até ficar perfeito

**Resultado:** Coordenadas precisas, testadas visualmente, prontas para produção.
