# 📋 Definição de Escopo - MVP Simpix Credit Management System
**Versão:** 1.0  
**Data:** 21/08/2025  
**Autor:** GEM 02 (Dev Specialist)  
**Status:** Draft - Aguardando Ratificação

---

## 1. Definição do MVP

### **Objetivo Principal**
O MVP (Minimum Viable Product) do Simpix é um sistema de gestão de crédito completo que permite a digitalização end-to-end do processo de concessão de crédito, desde a proposta inicial até a formalização do contrato e acompanhamento dos pagamentos.

### **Proposta de Valor**
- **Para instituições financeiras e parceiros comerciais** que precisam gerenciar propostas de crédito
- **O Simpix** é uma plataforma de gestão de crédito
- **Que** automatiza o fluxo completo de análise, aprovação e formalização
- **Diferentemente** de processos manuais ou sistemas fragmentados
- **Nosso produto** oferece uma solução integrada com assinatura digital e processamento de pagamentos automatizado

### **Métricas de Sucesso do MVP**
- Redução de 70% no tempo médio de aprovação de propostas
- Taxa de adoção digital > 80% pelos parceiros
- Zero falhas de segurança em transações financeiras
- Disponibilidade do sistema > 98%

---

## 2. Funcionalidades "In-Scope" (Dentro do Escopo)

### **2.1 Gestão de Propostas de Crédito**
- ✅ Criação de novas propostas com validação em tempo real
- ✅ Fluxo de análise multi-etapas (dados cliente → condições → referências → documentos)
- ✅ Sistema de aprovação hierárquica com workflow configurável
- ✅ Status FSM com 24 estados distintos e transições auditadas
- ✅ Histórico completo de alterações (audit log)

### **2.2 Motor de Cálculo Financeiro**
- ✅ Cálculo de TAC (Taxa de Abertura de Crédito)
- ✅ Simulações de crédito com múltiplos cenários
- ✅ Cálculo de IOF conforme legislação vigente
- ✅ Geração de tabela de parcelas com diferentes modalidades
- ✅ Cálculo de CET (Custo Efetivo Total) usando Newton-Raphson

### **2.3 Integração Bancária - Banco Inter**
- ✅ Geração automatizada de boletos bancários
- ✅ Geração de PIX com QR Code
- ✅ Recebimento de webhooks para notificação de pagamentos
- ✅ Sincronização de status de pagamento em tempo real
- ✅ Autenticação OAuth 2.0 com mTLS

### **2.4 Formalização Digital - ClickSign**
- ✅ Geração de contratos CCB (Cédula de Crédito Bancário) em PDF
- ✅ Envio automatizado para assinatura eletrônica
- ✅ Tracking de status de assinatura via webhook
- ✅ Armazenamento seguro de contratos assinados
- ✅ Validação HMAC de callbacks

### **2.5 Dashboard e Analytics Básico**
- ✅ Visão consolidada de propostas por status
- ✅ Métricas de conversão do funil de vendas
- ✅ Relatórios de pagamentos e inadimplência
- ✅ Exportação de dados em CSV/PDF
- ✅ Filtros avançados e busca por múltiplos critérios

### **2.6 Gestão de Acesso e Segurança**
- ✅ Sistema RBAC (Role-Based Access Control) com 5 perfis
- ✅ Autenticação via Supabase Auth com JWT
- ✅ Auditoria completa de ações (quem, quando, o quê)
- ✅ Criptografia de dados sensíveis
- ✅ Rate limiting em duas camadas
- ✅ Proteção CSRF e sanitização de inputs

### **2.7 Infraestrutura Técnica Base**
- ✅ API RESTful com documentação OpenAPI
- ✅ Sistema de filas assíncronas (BullMQ)
- ✅ Cache L2 para otimização de queries
- ✅ Backup automático diário
- ✅ Health checks e monitoramento básico
- ✅ Logging estruturado com correlation IDs

---

## 3. Funcionalidades "Out-of-Scope" (Fora do Escopo)

### **3.1 Aplicação Móvel**
- ❌ Apps nativos iOS/Android
- ❌ Progressive Web App (PWA)
- ❌ Push notifications mobile
- **Justificativa:** Foco inicial em desktop para operadores internos

### **3.2 Integrações Bancárias Adicionais**
- ❌ Integração com Santander, Bradesco, Itaú, etc.
- ❌ Open Banking/PIX automático multi-banco
- ❌ Conciliação bancária automatizada
- **Justificativa:** Complexidade e custo de múltiplas integrações

### **3.3 Business Intelligence Avançado**
- ❌ Data warehouse dedicado
- ❌ Dashboards customizáveis pelo usuário
- ❌ Machine Learning para scoring de crédito
- ❌ Previsões e análises preditivas
- **Justificativa:** Requer infraestrutura de dados madura

### **3.4 Arquitetura Multi-tenant**
- ❌ Isolamento completo por tenant
- ❌ Customização de fluxos por cliente
- ❌ White-label da plataforma
- ❌ Billing por uso/tenant
- **Justificativa:** Complexidade arquitetural prematura

### **3.5 Features Avançadas**
- ❌ Chatbot/Atendimento automatizado
- ❌ Integração com bureaus de crédito (Serasa/SPC)
- ❌ Módulo de cobrança judicial
- ❌ Sistema de comissionamento
- ❌ Portal self-service para clientes finais

---

## 4. Processo de Gestão de Mudanças de Escopo

### **4.1 Requisição Formal**
1. **Solicitação via ADR (Architecture Decision Record)**
   - Template obrigatório em `architecture/decisions/`
   - Justificativa de negócio clara
   - Estimativa preliminar de impacto

### **4.2 Análise de Impacto**
2. **Avaliação pelo Arquiteto Senior (GEM 01)**
   - Análise técnica detalhada
   - Impacto em timeline e recursos
   - Riscos e dependências
   - Trade-offs arquiteturais

### **4.3 Aprovação**
3. **Comitê de Produto**
   - Revisão quinzenal de mudanças propostas
   - Priorização baseada em valor vs esforço
   - Decisão documentada e comunicada
   - Atualização deste documento quando aprovado

### **4.4 Critérios de Aceitação**
Para uma mudança de escopo ser considerada:
- **Valor de Negócio:** ROI mensurável ou redução de risco crítico
- **Viabilidade Técnica:** Sem breaking changes na arquitetura core
- **Recursos Disponíveis:** Time e budget alocados
- **Alinhamento Estratégico:** Consistente com visão de produto

---

## 5. Mapeamento das Premissas Mais Arriscadas

### **🎯 Premissa #1: Adoção Digital pelos Parceiros**
**Hipótese:** Os parceiros comerciais (lojas, correspondentes) adotarão o fluxo 100% digital, abandonando processos em papel.

**Indicadores de Validação:**
- Taxa de adoção > 80% em 3 meses
- Redução de suporte relacionado a papel > 90%
- NPS dos parceiros > 70

**Plano de Mitigação se Falhar:**
- Manter processo híbrido (digital + papel) temporariamente
- Programa de treinamento intensivo
- Incentivos financeiros para early adopters

### **🎯 Premissa #2: Eficácia da Pré-Aprovação Automática**
**Hipótese:** Nossa lógica de pré-aprovação consegue reduzir o tempo de análise manual em 70% sem aumentar a taxa de inadimplência acima de 5%.

**Indicadores de Validação:**
- Tempo médio de aprovação < 30 minutos
- Taxa de inadimplência < 5%
- Taxa de false positives < 10%

**Plano de Mitigação se Falhar:**
- Ajuste gradual dos parâmetros de risco
- Implementação de ML para scoring (Fase 2)
- Revisão manual obrigatória para valores > R$ 10.000

### **🎯 Premissa #3: Estabilidade das Integrações Externas**
**Hipótese:** As APIs do Banco Inter e ClickSign manterão disponibilidade > 99% e não terão breaking changes frequentes.

**Indicadores de Validação:**
- Uptime das integrações > 99%
- Frequência de breaking changes < 1/trimestre
- Tempo de resolução de incidentes < 4 horas

**Plano de Mitigação se Falhar:**
- Circuit breakers com fallback local
- Queue system para retry automático
- Providers alternativos identificados (backup)

---

## 6. Roadmap Pós-MVP

### **Fase 1 (Mês 1-3): Estabilização**
- Performance tuning e otimizações
- Correção de bugs críticos
- Melhorias de UX baseadas em feedback

### **Fase 2 (Mês 4-6): Expansão**
- Segunda integração bancária
- App mobile (PWA)
- Dashboard avançado

### **Fase 3 (Mês 7-12): Escala**
- Multi-tenancy
- Machine Learning para scoring
- Open Banking integration

---

## 7. Referências e Anexos

- [C4 Architecture Diagrams](../09-c4-diagrams/README.md)
- [Technical Architecture](../../replit.md)
- [Database Schema](../../shared/schema.ts)
- [API Documentation](../../docs/api/README.md)

---

## 8. Controle de Versões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | 21/08/2025 | GEM 02 | Documento inicial criado |

---

## 9. Assinaturas e Aprovações

**Status:** ⏳ AGUARDANDO REVISÃO

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Arquiteto Senior | GEM 01 | Pendente | Pendente |
| Product Owner | - | Pendente | Pendente |
| Tech Lead | - | Pendente | Pendente |

---

**FIM DO DOCUMENTO**