# Plano de Refatoração: Migração para Modelo de Domínio Rico (P2.1)

## 1. Lógicas de Negócio a Serem Repatriadas

### 1.1. Cálculo de Parcela Mensal (DUPLICAÇÃO CRÍTICA)

- **Lógica Identificada:** Método `calculateMonthlyPaymentRaw` - Cálculo financeiro usando fórmula de juros compostos.
- **Localização Atual (Origem):** `server/modules/proposal/infrastructure/ProposalRepository.ts` (linhas 318-327)
- **Justificativa:** A forma como uma parcela é calculada é uma regra de negócio intrínseca da proposta, não um detalhe de persistência. Além disso, já existe o método `calculateMonthlyPayment()` no domínio, criando duplicação desnecessária.
- **Plano de Ação:**
  1. **REMOVER** o método duplicado `calculateMonthlyPaymentRaw` do `ProposalRepository.ts`
  2. **REFATORAR** o call site na linha 309 do `ProposalRepository.findByCriteriaLightweight()` para usar o método do domínio
  3. **VALIDAR** que o método `calculateMonthlyPayment()` no domínio implementa a mesma lógica financeira
  4. **DOCUMENTAR** a remoção da duplicação para evitar regressão futura

### 1.2. Taxa de Juros Padrão (REGRA DE NEGÓCIO NO CONTROLLER)

- **Lógica Identificada:** Taxa padrão `2.5%` hardcoded como fallback
- **Localização Atual (Origem):** `server/modules/proposal/presentation/proposalController.ts` (linha 102)
- **Justificativa:** A política de taxa de juros padrão é uma regra de negócio do domínio financeiro, não uma responsabilidade de apresentação.
- **Plano de Ação:**
  1. **CRIAR** método `getDefaultInterestRate(): number` na classe `Proposal`
  2. **MOVER** a constante `2.5` para dentro do domínio como regra de negócio
  3. **REFATORAR** o controller para chamar o método do domínio quando `taxaJuros` não for fornecida
  4. **CONSIDERAR** futura parametrização via configuração ou produto específico

### 1.3. Geração de Número Sequencial (ANÁLISE REQUERIDA)

- **Lógica Identificada:** Método `getNextNumeroProposta` - Geração de numeração sequencial iniciando em 300001
- **Localização Atual (Origem):** `server/modules/proposal/infrastructure/ProposalRepository.ts` (linhas 398-405)
- **Justificativa:** **ANÁLISE NECESSÁRIA** - Esta pode ser legitimamente infraestrutura (geração de IDs) ou uma regra de domínio (política de numeração de propostas).
- **Plano de Ação:**
  1. **ANALISAR** se a numeração `300001+` é uma regra de negócio específica ou apenas um detalhe técnico
  2. **DECIDIR** se deve permanecer no Repository (ID técnico) ou mover para domínio (regra de negócio)
  3. **DOCUMENTAR** a decisão arquitetural tomada

## 2. Lista de "Call Sites" a Serem Atualizados

### 2.1. ProposalRepository.ts

- **Linha 309**: `valor_parcela: this.calculateMonthlyPaymentRaw(...)`
  - **Mudança**: Substituir por chamada ao método do domínio
  - **Nova implementação**: Instanciar o agregado ou receber como parâmetro e chamar `proposal.calculateMonthlyPayment()`

### 2.2. proposalController.ts

- **Linha 102**: `taxaJuros: req.body.taxaJuros ? parseFloat(req.body.taxaJuros) : 2.5`
  - **Mudança**: Remover o valor hardcoded e delegar para o domínio
  - **Nova implementação**: `taxaJuros: req.body.taxaJuros ? parseFloat(req.body.taxaJuros) : Proposal.getDefaultInterestRate()`

## 3. Estado Atual vs. Estado Desejado

### 3.1. Estado Atual (MODELO ANÊMICO PARCIAL)

- ✅ Agregado `Proposal` possui alguns métodos ricos (`calculateMonthlyPayment`, `calculateTotalAmount`)
- ❌ Repository duplica lógica de cálculo com versão "raw"
- ❌ Controller define regras de negócio (taxa padrão)
- ⚠️ Mistura de responsabilidades entre camadas

### 3.2. Estado Desejado (MODELO RICO CONSOLIDADO)

- ✅ Todo cálculo financeiro centralizado no agregado `Proposal`
- ✅ Controller apenas coordena, sem lógica de negócio
- ✅ Repository apenas persiste, sem duplicação de lógica
- ✅ Regras de negócio encapsuladas no domínio

## 4. Validação e Riscos

### 4.1. Riscos Identificados

- **ALTO**: Alterar `calculateMonthlyPaymentRaw` pode impactar queries de listagem que dependem do cálculo
- **MÉDIO**: Mudança na taxa padrão pode afetar propostas em criação sem taxa explícita
- **BAIXO**: Geração de números sequenciais já está isolada em método específico

### 4.2. Estratégias de Mitigação

- **TESTES**: Validar que `calculateMonthlyPayment()` do domínio produz os mesmos resultados que `calculateMonthlyPaymentRaw`
- **ROLLBACK**: Manter versão antiga comentada durante período de validação
- **MONITORAMENTO**: Verificar se propostas continuam sendo criadas com valores corretos pós-refatoração

---

## ⚡ CONCLUSÃO DA AUDITORIA P2.1

**RESULTADO**: Identificadas **2 lógicas críticas** + **1 análise pendente** para migração ao domínio.

**PRÓXIMO PASSO**: Aguardar aprovação deste plano para prosseguir com a **Fase P2.2 - Execução da Migração**.

**IMPACTO ESTIMADO**: Eliminação de duplicação de código + Consolidação de regras de negócio no domínio + Melhoria da aderência aos princípios DDD.
