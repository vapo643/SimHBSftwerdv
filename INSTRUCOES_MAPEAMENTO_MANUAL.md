# INSTRUÇÕES PARA MAPEAMENTO MANUAL DAS COORDENADAS

## ✅ RESPOSTA DIRETA:

**Para pdf-lib, você deve mapear onde o TEXTO COMEÇA (primeira letra), NÃO o centro do campo.**

## 📝 COMO FAZER:

### 1. **Abra o template CCB no visualizador**
### 2. **Para cada campo, clique onde a PRIMEIRA LETRA deve ficar**
### 3. **Anote X e Y no formato:**

```javascript
nomeCampo: { x: [VALOR_X], y: [VALOR_Y_CONVERTIDO], fontSize: 11 }
```

## 🔄 **CONVERSÃO DE Y (OBRIGATÓRIA):**

**Sistema Visual** (tela): Y=0 no topo, cresce para baixo  
**Sistema PDF** (código): Y=0 na base, cresce para cima

**FÓRMULA:** `Y_PDF = 842.25 - Y_VISUAL`

**Exemplos:**
- Se você clicou Y=100 (100px do topo) → Use Y=742.25  
- Se você clicou Y=200 (200px do topo) → Use Y=642.25
- Se você clicou Y=300 (300px do topo) → Use Y=542.25

## 📍 **FORMATO DO ARQUIVO (ccbCoordinates.ts):**

```javascript
export const ccbCoordinates = {
  page1: {
    // Exemplo: Nome clicado em X=150, Y=100 visual
    nomeCliente: { x: 150, y: 742.25, fontSize: 11 }, // 842.25 - 100 = 742.25
    
    // Exemplo: CPF clicado em X=300, Y=150 visual  
    cpfCliente: { x: 300, y: 692.25, fontSize: 10 }, // 842.25 - 150 = 692.25
    
    // Exemplo: Valor clicado em X=200, Y=250 visual
    valorPrincipal: { x: 200, y: 592.25, fontSize: 12, bold: true }, // 842.25 - 250 = 592.25
  },
  
  page2: {
    // Mesma lógica para página 2
  },
  
  page8: {
    // Mesma lógica para página 8
  }
}
```

## ⚡ **PROCESSO RÁPIDO:**

1. **Clique onde o texto deve COMEÇAR** (primeira letra)
2. **Anote X (usar direto) e Y (converter com fórmula)**  
3. **Cole no formato acima**
4. **Repita para todos os campos**

## 🎯 **DICA IMPORTANTE:**

- **X**: Use o valor direto onde clicou
- **Y**: SEMPRE converter com `842.25 - Y_clicado`
- **fontSize**: 10-12 (normal), bold: true (para campos importantes)

**Pronto! Sem ferramentas, direto no código.**