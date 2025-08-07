# Guia Completo: Mapeamento de Coordenadas CCB

## 🎯 PROBLEMA IDENTIFICADO

Suas coordenadas foram mapeadas no sistema **VISUAL** (topo = 0), mas o PDF usa sistema **NATIVO** (base = 0).

## 📍 SISTEMAS DE COORDENADAS

### 1. Sistema VISUAL (Ferramenta de Mapeamento)
```
┌─────────────────┐ ← (0,0) ORIGEM
│                 │
│     PÁGINA      │ ↓ Y cresce para BAIXO
│                 │
│                 │
└─────────────────┘
```

### 2. Sistema PDF (pdf-lib)
```
┌─────────────────┐
│                 │
│     PÁGINA      │ ↑ Y cresce para CIMA  
│                 │
│                 │
└─────────────────┘ ← (0,0) ORIGEM
```

## 🔧 COMO CORRIGIR

### Opção 1: Converter Y Visual → Y PDF
```javascript
const pageHeight = 842.25; // A4 em points
const pdfY = pageHeight - visualY;

// Exemplo:
// Visual Y = 100 (100px do topo)
// PDF Y = 842.25 - 100 = 742.25
```

### Opção 2: Informar Tipo de Referência
Suas coordenadas são do:
- ✅ **CENTRO** do campo? (mais comum)
- ❌ **INÍCIO** do texto (esquerda)?
- ❌ **FIM** do texto (direita)?

## 🧪 FERRAMENTAS DE TESTE CRIADAS

### 1. Teste de Coordenada Única
```bash
POST /api/ccb-debug/test-single-coordinate
{
  "x": 150,
  "y": 100,
  "testText": "TESTE",
  "page": 1
}
```

### 2. Interface Visual
```
http://seu-app.com/coordinate-mapper
```

### 3. Conversão Automática
```bash
POST /api/ccb-debug/convert-coordinates
{
  "coordinates": [
    {"x": 150, "y": 100, "field": "nome"}
  ],
  "fromVisual": true,
  "pageHeight": 842.25
}
```

## 🎯 PROCESSO DE CALIBRAÇÃO

### Passo 1: Testar Uma Coordenada
1. Pegue um campo que você sabe a posição (ex: nome)
2. Use `/test-single-coordinate` com seus valores
3. Baixe o PDF de teste
4. Veja qual interpretação ficou correta:
   - **LEFT**: Texto começa na coordenada
   - **CENTER**: Texto fica centralizado na coordenada  
   - **RIGHT**: Texto termina na coordenada

### Passo 2: Ajustar Sistema
Com base no teste, escolha:
- **Se LEFT ficou certo**: Usar coordenadas como estão
- **Se CENTER ficou certo**: Marcar todas como `align: 'center'`
- **Se Y ficou invertido**: Converter Y = 842.25 - Y_original

### Passo 3: Aplicar Correção
```javascript
// Exemplo de correção no ccbCoordinates.ts
export const ccbCoordinates = {
  page1: {
    nomeCliente: { 
      x: 150, 
      y: 742.25, // Era 100, convertido: 842.25 - 100
      fontSize: 11,
      align: 'center' // Baseado no teste
    }
  }
}
```

## 🚀 TESTE RÁPIDO

Vou gerar um PDF de teste agora com sua coordenada (150, 100):

```bash
# Comando executado:
curl -X POST "/api/ccb-debug/test-single-coordinate" \
-d '{"x": 150, "y": 100, "testText": "NOME DO CLIENTE", "page": 1}'
```

O PDF mostrará 4 interpretações:
- 🔴 **Ponto vermelho**: Coordenada exata
- 🔵 **NOME DO CLIENTE (LEFT)**: Texto começando na coordenada
- 🟢 **NOME DO CLIENTE (CENTER)**: Texto centralizado na coordenada
- 🟣 **NOME DO CLIENTE (RIGHT)**: Texto terminando na coordenada

## ❓ PRÓXIMAS AÇÕES

**Qual interpretação ficou correta no seu template?**

1. Se **CENTER** ficou certo → Marcar todos os campos como `align: 'center'`
2. Se **Y estava invertido** → Converter todos: `Y = 842.25 - Y_original`
3. Se **LEFT** ficou certo → Usar coordenadas normalmente

**Diga qual ficou correto que eu ajusto todas as coordenadas automaticamente!**