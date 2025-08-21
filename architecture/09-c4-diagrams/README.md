# 📊 C4 Model - Documentação Arquitetural

**Sistema:** Simpix Credit Management System  
**Última Atualização:** 21/08/2025  
**Autor:** GEM 02 (Dev Specialist)

---

## 🎯 Objetivo

Esta documentação utiliza o **C4 Model** (Context, Container, Component, Code) para visualizar a arquitetura do sistema Simpix em diferentes níveis de abstração.

## 📚 Estrutura da Documentação

### **Diagramas Disponíveis:**

1. **[Level 1 - System Context](./c4-level1-context.md)**
   - Visão de alto nível do sistema
   - Atores e sistemas externos
   - Fronteiras e integrações

2. **[Level 2 - Container Diagram](./c4-level2-container.md)**
   - Containers técnicos (apps, databases)
   - Tecnologias utilizadas
   - Comunicação entre containers

3. **Level 3 - Component Diagram** *(Em construção)*
   - Componentes dentro de cada container
   - Responsabilidades detalhadas
   - Interfaces e dependências

4. **Level 4 - Code Diagram** *(Planejado)*
   - Classes e módulos principais
   - Padrões de design implementados
   - Estrutura de código

---

## 🔧 Como Usar Esta Documentação

### **Para Desenvolvedores:**
- Comece pelo Level 2 para entender a estrutura técnica
- Use Level 3 para navegar no código
- Consulte durante refatorações

### **Para Arquitetos:**
- Level 1 para visão estratégica
- Level 2 para decisões de infraestrutura
- Use para planejar migrações

### **Para Gestores:**
- Level 1 para entender dependências externas
- Identifique riscos e custos
- Planeje roadmap com base nas evoluções TO-BE

---

## 🛠️ Ferramentas de Visualização

### **Mermaid (Atual)**
- Integrado no Markdown
- Renderização automática no GitHub/GitLab
- Versionado com o código

### **Migração Futura:**
- **Structurizr** - Diagrams as Code
- **PlantUML** - Para diagramas complexos
- **draw.io** - Para apresentações

---

## 📈 Estado Atual (AS-IS)

### **Resumo Arquitetural:**
- **Padrão:** Monolito modular
- **Deployment:** Single container (Replit)
- **Database:** PostgreSQL (Supabase)
- **Integrações:** 4 sistemas externos

### **Principais Características:**
✅ Autenticação centralizada (Supabase)  
✅ Background jobs com BullMQ  
✅ Cache L2 implementado  
✅ Observabilidade básica (Sentry + Logs)  
⚠️ Acoplamento com Supabase  
⚠️ Single point of failure  
❌ Sem API Gateway  
❌ Sem service mesh  

---

## 🚀 Evolução Planejada (TO-BE)

### **Fase 0 - Fundação (ATUAL)**
- ✅ Documentação C4 Levels 1-2
- ✅ Migração de secrets
- ✅ Observabilidade básica
- 🔄 CI/CD pipeline
- 🔄 Ambientes separados

### **Fase 1 - Desacoplamento**
- Repository Pattern
- API Gateway
- Cache distribuído
- Circuit breakers completos

### **Fase 2 - Containerização**
- Docker images
- Kubernetes deployment
- Service mesh
- Horizontal scaling

### **Fase Final - Azure Migration**
- Azure Container Apps
- Azure SQL Database
- Azure Service Bus
- Azure Monitor

---

## 📊 Métricas de Arquitetura

| Métrica | Atual | Meta Fase 1 | Meta Final |
|---------|--------|-------------|------------|
| **Acoplamento** | Alto | Médio | Baixo |
| **Disponibilidade** | 98% | 99% | 99.9% |
| **Deployment Time** | Manual | 30min | 5min |
| **Recovery Time** | 4h | 1h | 15min |
| **Scaling** | Vertical | Manual | Auto |

---

## 🔍 Princípios Arquiteturais

1. **Separation of Concerns** - Cada container tem responsabilidade única
2. **Loose Coupling** - Minimizar dependências entre módulos
3. **High Cohesion** - Agrupar funcionalidades relacionadas
4. **Cloud Native** - Preparado para escalar horizontalmente
5. **Security by Design** - Segurança em todas as camadas

---

## 📝 Convenções de Documentação

### **Notação de Criticidade:**
- 🔴 **Crítico** - Falha impacta todo sistema
- 🟡 **Alto** - Degradação significativa
- 🟢 **Médio** - Impacto localizado
- ⚪ **Baixo** - Funcionalidade auxiliar

### **Status de Implementação:**
- ✅ Implementado
- 🔄 Em progresso
- ❌ Não implementado
- ⚠️ Necessita refatoração

---

## 🤝 Contribuindo

Para atualizar os diagramas:
1. Edite os arquivos `.md` correspondentes
2. Mantenha a notação Mermaid válida
3. Atualize a data de versão
4. Documente mudanças significativas

---

## 📚 Referências

- [C4 Model Official](https://c4model.com/)
- [Mermaid Documentation](https://mermaid-js.github.io/)
- [Structurizr](https://structurizr.com/)
- [Azure Architecture Center](https://docs.microsoft.com/en-us/azure/architecture/)

---

**Mantido por:** Equipe de Arquitetura Simpix  
**Revisado por:** GEM 01 (Arquiteto Senior)