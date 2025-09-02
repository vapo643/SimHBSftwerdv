# ADR-011: Resolução da Incompatibilidade de Tipos em `propostas.analista_id`

**Status:** Proposta  
**Data:** 2025-09-02  
**Decisores:** Arquitetura de Sistema  
**Contexto:** OPERAÇÃO RAIO-X - FASE 3.4 (Correção de Dívida Arquitetural)

## Contexto

Durante a análise forense do schema da entidade `propostas` (Operação Raio-X Fase 3.1), foi identificada uma incompatibilidade crítica de tipos de dados que impede a implementação de constraints de integridade referencial:

### Problema Identificado
- **Coluna:** `propostas.analista_id`
- **Tipo Atual:** `text` (sem foreign key constraint)
- **Problema:** Indefinição sobre qual tabela referenciar e que tipo usar

### Estado Arquitetural Dual
O sistema apresenta **dois modelos de usuário coexistentes**:

1. **Sistema Legado (`users`):**
   - Tipo: `serial('id')` (integer autoincrement)
   - Uso: Tabela `gerente_lojas` ainda referencia
   - Características: IDs sequenciais, simples

2. **Sistema Moderno (`profiles`):**
   - Tipo: `uuid('id')` (integração Supabase Auth)
   - Uso: Tabela `user_sessions` já referencia
   - Características: UUIDs globalmente únicos, integração nativa com auth.users

### Impacto da Decisão
Esta decisão definirá o **padrão arquitetural de identificação de usuários** para todas as futuras relações no sistema, estabelecendo um precedente crítico.

## Opções Consideradas

### Opção A: Alterar `propostas.analista_id` para Integer

**Implementação:**
```sql
ALTER TABLE propostas 
ALTER COLUMN analista_id TYPE integer USING analista_id::integer;

ALTER TABLE propostas 
ADD CONSTRAINT fk_propostas_analista 
FOREIGN KEY (analista_id) REFERENCES users(id);
```

#### Prós
- **Simplicidade Imediata:** Menor complexidade de implementação
- **Compatibilidade Legado:** Alinha com sistema `users` existente
- **Performance:** Joins com integers são marginalmente mais rápidos
- **Menor Migração:** Dados existentes podem ser convertidos facilmente

#### Contras
- **Direção Arquitetural Regressiva:** Vai contra a migração para Supabase Auth
- **ID Mutável:** IDs seriais podem mudar em raros cenários de reorganização
- **Fragmentação de Sistema:** Mantém dualidade entre `users` e `profiles`
- **Futuro Comprometido:** Todas as novas features terão que escolher entre os dois sistemas
- **Desalinhamento com RLS:** Policies RLS usam `auth.uid()` que retorna UUID
- **Inconsistência com Sessões:** `user_sessions` já usa `profiles.id` (UUID)

#### Análise de Impacto
- **Migração de Dados:** Simples conversão de string para integer
- **Refatoração de Código:** Mínima, apenas ajuste de tipos
- **Performance:** Impacto positivo mínimo em joins

---

### Opção B: Usar UUID do Supabase Auth

**Implementação:**
```sql
ALTER TABLE propostas 
ALTER COLUMN analista_id TYPE uuid USING analista_id::uuid;

ALTER TABLE propostas 
ADD CONSTRAINT fk_propostas_analista 
FOREIGN KEY (analista_id) REFERENCES profiles(id);
```

#### Prós
- **Alinhamento Estratégico:** Direciona sistema para Supabase Auth
- **ID Imutável:** UUIDs nunca mudam, garantindo estabilidade
- **Segurança Aprimorada:** IDs não sequenciais não vazam informações do schema
- **Integração Nativa com RLS:** `auth.uid()` retorna UUID diretamente
- **Consistência de Sistema:** Alinha com `user_sessions` e práticas modernas
- **Escalabilidade Global:** UUIDs funcionam em sistemas distribuídos
- **Padrão da Indústria:** Seguindo melhores práticas do Supabase e PostgreSQL moderno

#### Contras
- **Migração Complexa:** Requer sincronização entre `users` e `profiles`
- **Overhead de Storage:** 16 bytes vs 8 bytes por ID
- **Refatoração de Código:** Ajustes em todos os pontos que referenciam analistas
- **Performance Marginal:** Joins com UUID são ~10% mais lentos em escala massiva

#### Análise de Impacto
- **Migração de Dados:** Complexa, requer mapeamento users → profiles
- **Refatoração de Código:** Significativa, mudança de tipos em várias camadas
- **Performance:** Impacto negativo mínimo para escala atual

## Fatores Decisórios Críticos

### 1. **Direção Arquitetural**
O sistema **já está migrando** para Supabase Auth:
- `user_sessions` referencia `profiles.id` (UUID)
- RLS policies usam `auth.uid()` (UUID)
- Provider de autenticação retorna `user.id` como UUID

### 2. **Precedente Estabelecido**
Decisão criar **padrão obrigatório** para todas as futuras tabelas que referenciam usuários.

### 3. **Princípios de Segurança**
Sistema bancário exige:
- IDs não sequenciais (anti-enumeration)
- Chaves imutáveis
- Integração robusta com autenticação

### 4. **Conformidade com Melhores Práticas**
Supabase recomenda oficialmente:
- Sempre referenciar `auth.users(id)` (UUID)
- Usar `on delete cascade` para integridade
- Evitar referências a colunas mutáveis

## Decisão Final Recomendada

### ✅ **OPÇÃO B: Implementar UUID do Supabase Auth**

**Justificativa Técnica:**

1. **Alinhamento Estratégico:** O sistema já está em transição para Supabase Auth. Escolher integer seria uma regressão arquitetural que criaria maior dívida técnica a longo prazo.

2. **Conformidade com Padrões:** Seguindo as melhores práticas oficiais do Supabase e PostgreSQL moderno para sistemas financeiros.

3. **Segurança Bancária:** UUIDs atendem requisitos de anti-enumeration e imutabilidade críticos para sistemas financeiros.

4. **Consistência de Sistema:** Alinha com `user_sessions`, RLS policies e provider de autenticação existentes.

5. **Custo-Benefício:** O overhead de migração é um investimento único que resolve a dualidade arquitetural permanentemente.

### Estratégia de Implementação Recomendada

1. **Fase 1:** Sincronizar dados `users` → `profiles`
2. **Fase 2:** Migrar `propostas.analista_id` para UUID
3. **Fase 3:** Deprecar tabela `users` legado (longo prazo)

### Impacto Quantificado
- **Migração de Dados:** ~500 registros propostas existentes
- **Refatoração de Código:** ~15 arquivos afetados
- **Tempo de Implementação:** 2-3 dias
- **Benefício de Longo Prazo:** Eliminação de dualidade arquitetural

## Consequências

### Positivas
- Sistema unificado de identificação de usuários
- Conformidade total com Supabase Auth
- Base sólida para futuras features
- Eliminação de dívida arquitetural
- Melhoria de segurança

### Negativas
- Migração de dados necessária
- Refatoração de código significativa
- Overhead de storage mínimo

### Riscos e Mitigações
- **Risco:** Dados órfãos durante migração
- **Mitigação:** Transação atômica e rollback automático
- **Risco:** Quebra de funcionalidade existente
- **Mitigação:** Suíte de testes abrangente

## Notas de Implementação

### ⚠️ **CONSTRAINTS DE SEGURANÇA**
- Migração deve ser **atômica** (transação única)
- Backup obrigatório antes da execução
- Validação completa de integridade referencial
- Teste de rollback obrigatório

### 📋 **CHECKLIST DE IMPLEMENTAÇÃO**
- [ ] Sincronização de dados `users` → `profiles`
- [ ] Migração de `propostas.analista_id` para UUID
- [ ] Atualização de foreign key constraints
- [ ] Refatoração de código (tipos, repositories, use cases)
- [ ] Atualização de testes
- [ ] Validação de RLS policies
- [ ] Teste end-to-end de autenticação

---

**Decisão Validada:** OPERAÇÃO RAIO-X FASE 3.4  
**Próxima Fase:** 3.5 (Alinhamento de Suíte de Testes)  
**Status:** Aguardando implementação