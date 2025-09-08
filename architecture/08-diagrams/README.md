# 📊 Architecture Diagrams - Simpix

## Conteúdo desta pasta

Diagramas arquiteturais:

- C4 Model
- Entity Relationship
- Sequence diagrams
- User journeys
- System overview

## Documentos

| Arquivo                   | Descrição             | Status   |
| ------------------------- | --------------------- | -------- |
| c4-level-1-context.puml   | System Context        | Pendente |
| c4-level-2-container.puml | Container Diagram     | Pendente |
| c4-level-3-component.puml | Component Diagram     | Pendente |
| erd-current.sql           | ERD atual             | Pendente |
| erd-target.sql            | ERD target            | Pendente |
| sequence-auth.puml        | Fluxo de autenticação | Pendente |
| sequence-payment.puml     | Fluxo de pagamento    | Pendente |
| user-journey.md           | Jornada do usuário    | Pendente |

## Ferramentas Recomendadas

- **PlantUML:** Para diagramas C4 e sequência
- **dbdiagram.io:** Para ERDs
- **Mermaid:** Para diagramas simples em Markdown
- **draw.io:** Para diagramas visuais complexos

## Template PlantUML

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(user, "User", "Sistema user")
System(simpix, "Simpix", "Credit Management System")

Rel(user, simpix, "Uses")
@enduml
```
