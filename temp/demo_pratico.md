# 🎯 DEMONSTRAÇÃO PRÁTICA: Como Funciona o Sistema

## **SITUAÇÃO ATUAL**
Você tem coordenadas manuais no `ccbFieldMapping.ts`:
```typescript
nomeCliente: { x: 120, y: 680, size: 12 }
valorEmprestimo: { x: 200, y: 580, size: 12 } 
cpfCliente: { x: 120, y: 655, size: 11 }
```

## **PROBLEMA COMUM**
- ❓ As coordenadas estão corretas?
- ❓ Como fica com nomes longos?
- ❓ O texto está bem posicionado?
- ❓ Precisa ajustar alguma coordenada?

## **SOLUÇÃO: SISTEMA DE CALIBRAÇÃO**

### **PASSO 1: Teste Visual Rápido**
```bash
# Via API (quando logado no sistema)
POST /api/ccb-calibration/quick-test

# Ou via linha de comando
cd temp && npx tsx exemplo_teste_coordenadas.ts
```

**O que acontece:**
1. Sistema pega suas coordenadas do `ccbFieldMapping.ts`
2. Aplica dados de teste: "João Silva Santos", "R$ 50.000,00", etc.
3. Gera PDF com dados posicionados nas suas coordenadas
4. Pontos vermelhos mostram exatamente onde cada campo fica

### **PASSO 2: Análise Visual**
Você abre o PDF gerado e vê:
- ✅ Nome "João Silva" aparece na posição x:120, y:680
- ❌ Valor "R$ 50.000,00" fica sobreposto a uma linha
- ✅ CPF fica bem posicionado

### **PASSO 3: Gerar Grid de Referência**
```bash
# Gera grid com coordenadas X/Y sobre o template
POST /api/ccb-calibration/generate-grid
```

**O que gera:**
- Linhas verticais a cada 50px (50, 100, 150...)
- Linhas horizontais a cada 50px
- Números mostrando coordenadas X/Y
- Campos destacados em verde

### **PASSO 4: Ajustar Coordenadas**
Com base no que viu:
```typescript
// ANTES (estava sobre a linha)
valorEmprestimo: { x: 200, y: 580, size: 12 }

// DEPOIS (subiu 10 pixels)  
valorEmprestimo: { x: 200, y: 590, size: 12 }
```

### **PASSO 5: Testar Novamente**
Execute o teste novamente para validar o ajuste.

## **FLUXO COMPLETO EM AÇÃO**

```
SUAS COORDENADAS → SISTEMA DE TESTE → PDF VISUAL → ANÁLISE → AJUSTE → REPETE
      ↓                    ↓              ↓           ↓         ↓
 ccbFieldMapping.ts → API calibração → temp/test.pdf → Você vê → Edita código
```

## **VANTAGENS DO SISTEMA**

1. **Visual**: Vê exatamente onde cada campo fica
2. **Rápido**: Teste em segundos, não precisar gerar CCB completa
3. **Iterativo**: Ajusta → Testa → Ajusta → Testa
4. **Preciso**: Grid mostra coordenadas exatas
5. **Dados Reais**: Testa com nomes longos, valores grandes

## **COMANDOS PRÁTICOS**

```bash
# 1. Testar suas coordenadas atuais
curl -X POST "localhost:5000/api/ccb-calibration/quick-test"

# 2. Gerar grid visual  
curl -X POST "localhost:5000/api/ccb-calibration/generate-grid" \
  -d '{"gridSpacing": 50, "showCoordinates": true}'

# 3. Testar com seus próprios dados
curl -X POST "localhost:5000/api/ccb-calibration/test-positions" \
  -d '{"testData": {"nomeCliente": "Maria Santos", "valorEmprestimo": "R$ 75.000,00"}}'
```

## **RESULTADO FINAL**
Coordenadas testadas visualmente, ajustadas com precisão, prontas para produção.