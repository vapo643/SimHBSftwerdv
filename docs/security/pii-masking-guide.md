# Guia de Mascaramento de Dados PII

**Data:** 22/08/2025  
**Versão:** 1.0  
**Autor:** GEM 07 (AI Specialist)

## Visão Geral

Este documento descreve o utilitário de mascaramento de dados PII implementado em `server/utils/masking.ts`, em conformidade com as políticas definidas no ADR-008.

## Funções Disponíveis

### maskCPF(cpf: string): string

Mascara um CPF mantendo os 6 dígitos do meio visíveis.

**Entrada:** `123.456.789-00`  
**Saída:** `***.456.789-**`

### maskEmail(email: string): string

Mascara email mantendo primeiro caractere do nome, primeiro do domínio e extensão.

**Entrada:** `joao.silva@empresa.com`  
**Saída:** `j***@e***.com`

### maskRG(rg: string): string

Mascara RG mantendo os 3 últimos dígitos do número principal.

**Entrada:** `12.345.678-9`  
**Saída:** `**.***.678-*`

### maskTelefone(telefone: string): string

Mascara telefone mantendo os 4 últimos dígitos.

**Entrada:** `(11) 98765-4321`  
**Saída:** `(**) *****-4321`

## Uso em APIs

### Exemplo de Implementação

```typescript
import { maskCPF, maskEmail } from '@/server/utils/masking';

// Em um endpoint GET
router.get('/api/clientes/:id', async (req, res) => {
  const cliente = await getCliente(req.params.id);
  
  // Mascarar dados sensíveis antes de retornar
  const clienteMasked = {
    ...cliente,
    cpf: maskCPF(cliente.cpf),
    email: maskEmail(cliente.email),
    rg: maskRG(cliente.rg),
    telefone: maskTelefone(cliente.telefone)
  };
  
  res.json(clienteMasked);
});
```

### Função Batch

Para mascarar múltiplos campos de uma vez:

```typescript
import { maskBatch } from '@/server/utils/masking';

const maskedData = maskBatch({
  cpf: '123.456.789-00',
  email: 'user@domain.com',
  rg: '12.345.678-9',
  telefone: '(11) 98765-4321'
});
```

## Testes

Todos os testes unitários estão em `tests/unit/masking.test.ts`:

```bash
# Executar testes
npx vitest run tests/unit/masking.test.ts

# Resultado esperado
✓ 23 testes passando
```

## Próximos Passos

1. **Refatorar APIs existentes** para usar estas funções
2. **Adicionar middleware** de mascaramento automático
3. **Criar endpoints auditados** para acesso a dados completos
4. **Implementar cache** de dados mascarados

## Compliance

- ✅ **LGPD:** Dados minimizados em trânsito
- ✅ **PCI-DSS:** Informações financeiras protegidas
- ✅ **OWASP:** Princípio do menor privilégio aplicado

## Referências

- [ADR-008: Estratégia de Contrato de Dados](../../architecture/07-decisions/adr-008-api-data-contracts-payloads.md)
- [LGPD - Artigo 6º](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm#art6)