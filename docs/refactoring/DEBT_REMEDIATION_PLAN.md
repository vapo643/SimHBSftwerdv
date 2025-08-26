# Plano de Remediação de Débito Técnico - Tipagem AuthenticatedRequest

**Data:** 2025-08-26  
**PAM V6.0 - Operação Fênix P1.5**  
**Executado por:** Diagnóstico de Ferramentas + Arquiteto de Refatoração  

---

## 1. Diagnóstico da Discrepância LSP/TSC

### 🔍 **CAUSA RAIZ IDENTIFICADA**

A discrepância entre `get_latest_lsp_diagnostics` (0 erros) e `npx tsc --noEmit` (centenas de erros) é causada por **10 definições duplicadas e inconsistentes** do tipo `AuthenticatedRequest` espalhadas pelo codebase.

### **ANÁLISE TÉCNICA:**

#### **A. Definição Oficial (Correta)**
**Localização:** `server/lib/jwt-auth-middleware.ts:5`
```typescript
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string | null;
    full_name?: string | null;
    loja_id?: number | null;
  };
  sessionID?: string;
}
```

#### **B. Definições Duplicadas (Inconsistentes)**
**Exemplo:** `server/routes/documents.ts:10`
```typescript
interface AuthenticatedRequest extends Request {
  userId?: string;  // ❌ CONFLITA com oficial: user.id
  user?: any;       // ❌ TIPO GENÉRICO vs estruturado
  file?: any;       // ❌ PROPRIEDADE EXTRA não oficial
}
```

**Arquivos com Definições Duplicadas:**
1. `server/routes/documents.ts:10`
2. `server/routes/cobrancas.ts:11`
3. `server/routes/security-api.ts:12`
4. `server/routes/security-scanners.ts:11`
5. `server/routes/auth/index.ts:12`
6. `server/lib/role-guard.ts:3`
7. E mais 4 arquivos originais

### **C. Por que LSP vs TSC Diferem**

- **LSP (Language Server):** Prioriza definições locais e pode ignorar conflitos entre módulos diferentes
- **TSC (TypeScript Compiler):** Aplica verificação rigorosa entre todas as definições e detecta incompatibilidades
- **Resultado:** LSP reporta "tudo limpo" enquanto TSC detecta centenas de erros de compatibilidade

### **D. Configurações Analisadas**

- **`tsconfig.json`:** Configuração robusta com `strict: true` e `noEmit: true`
- **`eslint.config.js`:** Não afeta verificação de tipos (foco em linting)
- **`.replit`:** Ambiente padrão sem configurações específicas LSP

---

## 2. Roadmap de Remediação de Tipagem

### **FASE A: Definição do Tipo Canônico**

#### **A.1. Consolidação em Arquivo Central**
**Localização Proposta:** `shared/types/express.ts`

```typescript
import { Request } from 'express';

/**
 * Interface canônica para requests autenticados
 * Extende Express Request com dados de usuário validados
 * 
 * @interface AuthenticatedRequest
 * @extends Request
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Dados completos do usuário autenticado
   * Preenchido pelo jwtAuthMiddleware após validação
   */
  user?: {
    /** ID único do usuário (UUID) */
    id: string;
    /** Email do usuário */
    email: string;
    /** Role/função do usuário no sistema */
    role: string | null;
    /** Nome completo do usuário */
    full_name?: string | null;
    /** ID da loja associada (se aplicável) */
    loja_id?: number | null;
  };
  
  /**
   * ID da sessão Express (compatibilidade express-session)
   */
  sessionID?: string;
  
  /**
   * Dados de arquivo para upload (compatibilidade multer)
   * Presente apenas em routes de upload
   */
  file?: Express.Multer.File;
  
  /**
   * Múltiplos arquivos para upload (compatibilidade multer)
   */
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Type alias para middlewares que requerem autenticação
 */
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
```

#### **A.2. Migração do JWT Middleware**
**Ação:** Atualizar `server/lib/jwt-auth-middleware.ts` para importar de `shared/types/express.ts`

#### **A.3. Atualização do tsconfig.json**
**Adicionar ao paths:**
```json
{
  "paths": {
    "@/*": ["./client/src/*"],
    "@shared/*": ["./shared/*"],
    "@types/*": ["./shared/types/*"]
  }
}
```

---

### **FASE B: Plano de Rollout Incremental**

#### **B.1. Grupo Piloto (5 arquivos críticos)**
**Prioridade P0 - Sistema Core:**
1. `server/routes/auth/index.ts` - Autenticação
2. `server/routes/documents.ts` - Documentos (já testado)
3. `server/routes/security-api.ts` - Segurança
4. `server/lib/role-guard.ts` - Guards de permissão
5. `server/routes/integracao/inter.ts` - Integrações

**Estratégia:**
- Remover definições locais
- Adicionar: `import { AuthenticatedRequest } from '@types/express';`
- Ajustar uso de `req.userId` para `req.user?.id`
- Validar tipos específicos (`any` → tipos estruturados)

#### **B.2. Grupo Secundário (50+ arquivos)**
**Prioridade P1 - Controllers e Services:**
- Todos os arquivos em `server/routes/`
- Arquivos de middleware personalizados
- Services que usam AuthenticatedRequest

**Metodologia:**
- Implementar em lotes de 10 arquivos por iteração
- Testes de regressão após cada lote
- Monitoramento de erros TSC por lote

#### **B.3. Grupo Final (Cleanup)**
**Prioridade P2 - Arquivos Originais e Backups:**
- Arquivos `*-original.ts`
- Arquivos `.backup`
- Documentação e testes

---

### **FASE C: Estratégia de Validação**

#### **C.1. Métricas de Sucesso**

**Linha Base Atual:**
- LSP Diagnostics: 0 erros
- TSC Erros: ~300+ erros
- AuthenticatedRequest duplicações: 10 definições

**Metas por Fase:**

**Fase A (Pós-Consolidação):**
- TSC Erros: <200 (-100 erros)
- AuthenticatedRequest duplicações: 1 definição oficial

**Fase B.1 (Pós-Piloto):**
- TSC Erros: <150 (-50 erros)
- AuthenticatedRequest imports: 5 arquivos migrados

**Fase B.2 (Pós-Secundário):**
- TSC Erros: <50 (-100 erros)
- AuthenticatedRequest coverage: 80% dos controllers

**Fase Final:**
- TSC Erros: 0 erros
- LSP Diagnostics: 0 erros (mantido)
- 100% consistência de tipos

#### **C.2. Comandos de Validação**

```bash
# Validação completa de tipos
npx tsc --noEmit

# Contagem de definições duplicadas
grep -r "interface.*AuthenticatedRequest" server/ | wc -l

# Verificação LSP
# (Via ferramenta LSP do editor)

# Análise específica de AuthenticatedRequest
grep -r "AuthenticatedRequest" server/ --include="*.ts" | grep -E "(interface|import|type)"
```

#### **C.3. Critérios de Rollback**

**Triggers de Rollback:**
- Aumento de erros TSC em >20% após migração
- Falha em testes de integração críticos
- Erro de compilação em produção

**Estratégia de Rollback:**
- Git commit por fase permite rollback granular
- Backup de definições originais em `docs/rollback/`
- Plan B: Type assertions temporários (`as AuthenticatedRequest`)

---

### **ESTIMATIVAS E CRONOGRAMA**

**Fase A:** 2-4 horas (Consolidação e setup)
**Fase B.1:** 4-6 horas (Piloto + validação)
**Fase B.2:** 8-12 horas (Rollout principal)
**Fase C:** 2-4 horas (Validação final + cleanup)

**Total Estimado:** 16-26 horas de trabalho técnico

---

### **RISCOS E CONTRAMEDIDAS**

**Risco Alto:** Quebra de funcionalidade durante migração
**Contramedida:** Testes automatizados obrigatórios + rollback incremental

**Risco Médio:** Tipos mal definidos causando runtime errors
**Contramedida:** Validação rigorosa com TSC + type guards

**Risco Baixo:** Performance impact de type checking
**Contramedida:** Build times monitorados + otimizações TSC

---

### **CONCLUSÃO**

Este plano resolve sistematicamente o débito técnico de tipagem através de:

1. **Consolidação:** Uma única definição oficial e robusta
2. **Migração Incremental:** Baixo risco com validação contínua  
3. **Validação Rigorosa:** Métricas claras de sucesso
4. **Estratégia de Segurança:** Rollback granular se necessário

**Resultado Esperado:** Sistema de tipos consistente, TSC limpo, e fundação sólida para desenvolvimento futuro.