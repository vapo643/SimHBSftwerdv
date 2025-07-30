# Checklist de Requisitos OWASP ASVS Level 1 Pendentes - Projeto Simpix

**Data da Análise**: 31 de Janeiro de 2025
**Arquiteto de Segurança**: Análise Baseada em Código
**Standard**: OWASP ASVS 5.0.0 - Level 1

## Sumário Executivo

Esta análise identificou requisitos ASVS Level 1 pendentes nas três áreas críticas identificadas pela avaliação SAMM. Os requisitos abaixo representam gaps específicos que devem ser implementados para alcançar conformidade completa com ASVS Level 1.

---

## V8: AUTHORIZATION (Autorização)

### 8.1 Documentação de Autorização

**[✅ IMPLEMENTADO] 8.1.1** - Verificar que a documentação de autorização define regras para acesso a funções e dados
- **Situação Atual**: ✅ Documentação formal criada em SECURITY_POLICY.md
- **Evidência**: 
  - Documento completo com matriz de permissões
  - RLS policies documentadas por tabela
  - Processo de revisão estabelecido
- **Implementação**: 31/01/2025 - SECURITY_POLICY.md criado com:
  - Matriz de permissões (role x recurso)
  - Regras de isolamento de dados por loja_id
  - Fluxo de autorização da aplicação
  - Processo de revisão trimestral

**[❌ PENDENTE] 8.1.4** - Verificar que existe um processo documentado para revisar e atualizar regras de autorização
- **Situação Atual**: Não existe processo formal de revisão
- **Ação Necessária**: Estabelecer processo periódico de revisão com:
  - Frequência de revisão (ex: trimestral)
  - Responsáveis pela revisão
  - Checklist de verificação

### 8.3 Outros Controles de Autorização

**[❌ PENDENTE] 8.3.1** - Verificar que informações sensíveis e APIs são protegidas contra IDOR
- **Situação Atual**: Proteção implementada via RLS mas sem documentação de testes
- **Ação Necessária**: Documentar testes de IDOR realizados e criar suite de testes automatizados

---

## V7: SESSION MANAGEMENT (Gestão de Sessão)

### 7.1 Gestão Fundamental de Sessão

**[❌ PENDENTE] 7.1.1** - Verificar que a aplicação nunca revela tokens de sessão em parâmetros de URL
- **Situação Atual**: Tokens passados em headers mas sem validação automatizada
- **Evidência**: JWT sempre em Authorization header mas sem testes
- **Ação Necessária**: Implementar teste automatizado para garantir tokens nunca aparecem em URLs

### 7.2 Vinculação de Sessão

**[❌ PENDENTE] 7.2.2** - Verificar que tokens de sessão possuem pelo menos 64 bits de entropia
- **Situação Atual**: Usando JWT do Supabase mas sem documentação de entropia
- **Ação Necessária**: Documentar análise de entropia dos tokens JWT gerados

### 7.3 Timeout de Sessão

**[❌ PENDENTE] 7.3.1** - Verificar que tokens de sessão expiram após período de inatividade
- **Situação Atual**: JWT tem expiração absoluta mas NÃO por inatividade
- **Evidência**: Tokens expiram em 1 hora independente de uso
- **Ação Necessária**: Implementar timeout por inatividade:
  - 30 minutos sem atividade = logout automático
  - Renovação de token em cada request válido

**[❌ PENDENTE] 7.3.3** - Verificar que a aplicação permite logout em todas as páginas protegidas
- **Situação Atual**: Botão de logout existe mas não em todas as páginas
- **Ação Necessária**: Adicionar opção de logout global acessível de qualquer página

### 7.4 Término de Sessão

**[❌ PENDENTE] 7.4.3** - Verificar que usuários são capazes de visualizar lista de sessões ativas
- **Situação Atual**: Funcionalidade não implementada
- **Ação Necessária**: Criar página para usuário ver/gerenciar suas sessões ativas

---

## V6: AUTHENTICATION (Autenticação)

### 6.1 Segurança de Credenciais

**[❌ PENDENTE] 6.1.3** - Verificar que usuários podem alterar nome de usuário/email
- **Situação Atual**: Email usado como login mas não pode ser alterado
- **Ação Necessária**: Implementar funcionalidade de mudança de email com:
  - Verificação do novo email
  - Notificação ao email antigo

### 6.2 Segurança de Senhas

**[❌ PENDENTE] 6.2.4** - Verificar que senhas são validadas contra lista de pelo menos 3000 senhas comuns
- **Situação Atual**: Apenas validação de tamanho mínimo (8 caracteres)
- **Evidência**: `password: z.string().min(8)` em routes.ts
- **Ação Necessária**: Integrar biblioteca como `zxcvbn` ou lista NIST de senhas fracas

**[❌ PENDENTE] 6.2.7** - Verificar que senhas submetidas são verificadas contra regras de complexidade
- **Situação Atual**: Sem regras de complexidade
- **Ação Necessária**: Implementar validação para exigir:
  - 1 letra maiúscula
  - 1 letra minúscula
  - 1 número
  - 1 caractere especial

### 6.3 Recuperação de Credenciais

**[❌ PENDENTE] 6.3.1** - Verificar que recuperação de senha não revela se conta existe
- **Situação Atual**: Mensagem diferente para conta inexistente
- **Ação Necessária**: Padronizar mensagem: "Se o email existir, você receberá instruções"

### 6.5 Autenticação Sem Senha

**[❌ PENDENTE] 6.5.5** - Verificar que autenticadores são revogáveis caso comprometidos
- **Situação Atual**: Tokens podem ser blacklisted mas não há UI para isso
- **Ação Necessária**: Criar interface para usuário revogar tokens/sessões específicas

---

## Plano de Implementação Prioritário

### Fase 1 - Documentação (1 semana)
1. **[V8.1.1]** Documentar matriz de autorização e RLS policies
2. **[V7.2.2]** Documentar análise de entropia dos tokens
3. **[V8.1.4]** Criar processo de revisão de autorização

### Fase 2 - Quick Wins (2 semanas)
4. **[V6.2.4]** Implementar validação contra senhas comuns
5. **[V6.2.7]** Adicionar regras de complexidade de senha
6. **[V6.3.1]** Padronizar mensagens de recuperação de senha
7. **[V7.3.3]** Garantir logout disponível em todas as páginas

### Fase 3 - Funcionalidades Novas (3 semanas)
8. **[V7.3.1]** Implementar timeout por inatividade
9. **[V7.4.3]** Criar página de gerenciamento de sessões
10. **[V6.5.5]** Adicionar UI para revogação de tokens
11. **[V6.1.3]** Implementar mudança de email

### Fase 4 - Testes e Validação (1 semana)
12. **[V7.1.1]** Criar testes automatizados para tokens em URLs
13. **[V8.3.1]** Documentar e automatizar testes de IDOR

---

## Conclusão

Total de requisitos ASVS Level 1 pendentes identificados: **13**

Com a implementação destes requisitos, o projeto Simpix alcançará conformidade completa com OWASP ASVS Level 1 nas áreas de Autorização, Gestão de Sessão e Autenticação.

A maioria dos requisitos pendentes são relacionados a documentação e validações adicionais, indicando que a base de segurança está sólida mas precisa de formalização e algumas melhorias pontuais.