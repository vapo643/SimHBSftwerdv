# 🎯 GUIA COMPLETO: Como Fornecer 100% das Coordenadas CCB

## PASSO 1: BAIXE O PDF COM GRADE DE COORDENADAS

```bash
# Execute este comando para baixar o PDF de diagnóstico:
curl -o template_ccb_DEBUG_GRID.pdf "http://localhost:5000/api/ccb-diagnostics/generate-grid"
```

✅ **PDF gerado com sucesso!** Agora você tem um arquivo `template_ccb_DEBUG_GRID.pdf` com:

- Grade de coordenadas sobreposta no template
- Linhas verticais e horizontais numeradas
- Coordenadas X e Y marcadas a cada 50 pontos
- Pontos de referência importantes

## PASSO 2: VISUALIZE E MAPEIE

### Como Ler as Coordenadas:

- **Eixo X:** Cresce da ESQUERDA para DIREITA
- **Eixo Y:** Cresce de BAIXO para CIMA (não do topo!)
- **Origem (0,0):** Canto INFERIOR ESQUERDO da página
- **Unidade:** Pontos (1 polegada = 72 pontos)

### Dimensões do Template:

- **Largura:** 595.5 pontos
- **Altura:** 842.25 pontos

## PASSO 3: IDENTIFIQUE OS CAMPOS POR PÁGINA

### 📄 PÁGINA 1 - CAPA E IDENTIFICAÇÃO

Procure no PDF e anote as coordenadas onde devem aparecer:

```typescript
// Exemplo de como preencher:
page1: {
    numeroCCB: { x: 450, y: 750, fontSize: 12, bold: true, align: 'right' },
    //          ↑     ↑     ↑        ↑         ↑
    //         X=450 Y=750 Tamanho  Negrito   Alinhado à direita

    dataEmissao: { x: 450, y: 730, fontSize: 10, align: 'right' },
    nomeCliente: { x: 297, y: 400, fontSize: 14, bold: true, align: 'center' },
    cpfCliente: { x: 297, y: 380, fontSize: 12, align: 'center' },
    // ... continue para todos os campos
},
```

### 📄 PÁGINA 2 - QUALIFICAÇÃO DO EMITENTE

Campos principais a mapear:

- Nome completo
- CPF, RG, Órgão expedidor
- Data de nascimento
- Estado civil
- Nome/CPF do cônjuge (se aplicável)
- Profissão
- Endereço residencial completo
- CEP, telefone, email
- Dados profissionais
- Referências pessoais

### 📄 PÁGINA 3 - DADOS DO CRÉDITO

Campos financeiros a mapear:

- Valor principal
- Taxas de juros (mensal/anual)
- CET (mensal/anual)
- IOF, TAC, Seguro
- Valor total a pagar
- Forma de pagamento
- Parcelas e vencimentos

### 📄 PÁGINAS 4-8

Continue o mesmo processo para garantias, declarações, autorização de débito e assinaturas.

## PASSO 4: ATUALIZE O ARQUIVO DE COORDENADAS

Abra o arquivo: `server/config/ccbCoordinates.ts`

Substitua os valores `0` pelas coordenadas reais que você identificou:

```typescript
// ANTES (placeholder):
numeroCCB: { x: 0, y: 0, fontSize: 12, bold: true },

// DEPOIS (coordenada real):
numeroCCB: { x: 450, y: 750, fontSize: 12, bold: true, align: 'right' },
```

## PASSO 5: TESTE SUAS COORDENADAS

```bash
# Gere um PDF de teste com suas coordenadas:
curl -o template_ccb_TEST.pdf "http://localhost:5000/api/ccb-diagnostics/test-fill"
```

## FERRAMENTAS AUXILIARES

### Converter de Topo para Base (se necessário):

```typescript
// Se você mediu do topo da página:
const yFromTop = (pageHeight: number, pixelsFromTop: number) => {
  return pageHeight - pixelsFromTop;
};

// Exemplo: Campo a 100 pontos do topo em página de 842.25 de altura
const yReal = yFromTop(842.25, 100); // = 742.25
```

### Alinhamentos Disponíveis:

- `align: 'left'` - Alinhado à esquerda (padrão)
- `align: 'center'` - Centralizado
- `align: 'right'` - Alinhado à direita

### Para Campos Multi-linha:

```typescript
enderecoResidencial: {
    x: 150,
    y: 540,
    fontSize: 10,
    maxWidth: 400  // ← Largura máxima para quebra automática
},
```

## DICAS IMPORTANTES

### ✅ MEDIÇÃO PRECISA:

1. Use o zoom máximo no PDF
2. Posicione o cursor no início exato onde o texto deve começar
3. Leia as coordenadas X,Y na grade
4. Para texto centralizado, meça o centro do campo

### ✅ TESTE ITERATIVO:

1. Atualize algumas coordenadas
2. Gere o PDF de teste
3. Verifique se está correto
4. Ajuste conforme necessário
5. Repita até ficar perfeito

### ✅ CAMPOS CONDICIONAIS:

Alguns campos só aparecem em certas condições:

- Nome/CPF do cônjuge (apenas se casado)
- Dados de garantia (apenas se houver)
- Referências (podem variar)

## PROCESSO RECOMENDADO

### Ordem de Mapeamento:

1. **Página 1 primeiro** (mais simples, poucos campos)
2. **Teste** com PDF de diagnóstico
3. **Página 2** (dados pessoais)
4. **Página 3** (dados financeiros - mais críticos)
5. **Páginas 4-8** (completar o restante)

### Validação Final:

- Todos os campos importantes mapeados
- Textos não sobrepostos
- Alinhamentos corretos
- Tamanhos de fonte apropriados

## RESULTADO ESPERADO

Após mapear 100% das coordenadas, você terá:

- CCBs geradas com layout perfeito
- Todos os campos no lugar correto
- Formatação profissional
- Template Simpix preservado com dados dinâmicos

**Tempo estimado:** 2-3 horas para mapeamento completo e preciso de todas as 8 páginas.
