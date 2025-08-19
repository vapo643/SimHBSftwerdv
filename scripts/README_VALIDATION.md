## INSTRUÇÕES DE USO DO SCRIPT ##

### Executar validação de consistência:
```bash
tsx scripts/validate-status-consistency.ts
```

### Interpretação dos Resultados:
- **Taxa de Cobertura**: Percentual de propostas com status contextual
- **Inconsistências**: Propostas onde status legado != status contextual
- **Propostas Órfãs**: Propostas sem registro em status_contextuais

### Códigos de Saída:
- 0: Sucesso (sem inconsistências)
- 1: Inconsistências encontradas
- 2: Erro fatal na execução
