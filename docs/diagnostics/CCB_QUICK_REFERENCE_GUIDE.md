# 🚀 CCB Template - Quick Reference Guide

## ✅ Verificação de Saúde do Sistema

### 1. Template Validation

```bash
# Comando de verificação:
ls -la server/templates/template_ccb.pdf

# Resultado esperado:
-rw-r--r-- 1 runner runner 564692 Aug 7 16:44 server/templates/template_ccb.pdf

# ⚠️ ALERTA: Se mostrar 16525 bytes = TEMPLATE ERRADO!
```

### 2. Logs de Geração Saudável

```
📄 [CCB] Template carregado: 564692 bytes ✅
📄 [CCB] PDF carregado: 1 páginas ✅
📄 [CCB] Preenchimento com mapeamento SIMPIX ✅
✅ [CCB] Template preservado com logo e formatação
```

## 🛠️ Comandos de Emergência

### Restaurar Template Correto:

```bash
cp "./attached_assets/CCB SIMPIX (1)_1754063031025.pdf" server/templates/template_ccb.pdf
```

### Verificar Serviços Ativos:

```bash
grep -r "ccbGenerator\|ccbTemplateGenerator" server/ --include="*.ts" | grep -v ".LEGADO"
# Resultado deve ser: 0 (nenhum import antigo ativo)
```

## 📍 Sistema de Coordenadas

### Mapeamento Base (ccbFieldMapping.ts):

- **Nome Cliente:** x:120, y:120px do topo
- **CPF Cliente:** x:120, y:145px do topo
- **Valor Empréstimo:** x:200, y:240px do topo
- **Número Parcelas:** x:180, y:270px do topo
- **Valor Parcela:** x:200, y:300px do topo
- **Data Emissão:** x:100, y:650px do topo

### Ajustes Comuns:

```typescript
// Mover campos para direita:
{ fieldName: 'nomeCliente', deltaX: 10, deltaY: 0 }

// Mover campos para baixo:
{ fieldName: 'nomeCliente', deltaX: 0, deltaY: -20 }
```

## 🔥 Resolução de Problemas

### Problema: CCB sem logo Simpix

**Causa:** Template genérico (16KB)  
**Solução:** Restaurar template original (564KB)

### Problema: Dados em posições erradas

**Causa:** Coordenadas inadequadas  
**Solução:** Usar sistema de ajustes dinâmicos

### Problema: Serviços antigos executando

**Causa:** Imports não corrigidos  
**Solução:** Verificar todos os arquivos em routes/

## 📞 Arquivos de Suporte

- **Documentação completa:** `/error_docs/CCB_TEMPLATE_BREAKTHROUGH_DOCUMENTATION.md`
- **Mapeamento:** `/server/services/ccbFieldMapping.ts`
- **Ajustes:** `/server/services/ccbCoordinateMapper.ts`
- **Testes:** `/server/routes/ccb-coordinate-test.ts`
