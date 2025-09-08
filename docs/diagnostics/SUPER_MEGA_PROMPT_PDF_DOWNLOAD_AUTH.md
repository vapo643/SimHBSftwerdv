# SUPER MEGA PROMPT - ERRO CRÍTICO DE AUTENTICAÇÃO NO DOWNLOAD DE PDF

## CONTEXTO EMERGENCIAL

Estamos com um sistema de gerenciamento de crédito em produção (Simpix) que está falhando consistentemente no download de PDFs de boletos. O sistema funciona perfeitamente em todas as outras funcionalidades, mas falha especificamente ao fazer download de PDFs através de uma rota protegida por JWT.

## STACK TECNOLÓGICO

- Frontend: React 18 + TypeScript + Vite
- Backend: Express.js + TypeScript
- Auth: Supabase Auth com JWT customizado
- Database: PostgreSQL com Drizzle ORM
- File Storage: Supabase Storage

## PROBLEMA ESPECÍFICO

Quando o usuário clica no botão "Baixar PDF" na tela de formalização, o sistema tenta fazer download mas falha com erro de autenticação, mesmo que:

1. O usuário esteja autenticado (outras APIs funcionam)
2. O JWT seja válido (logs mostram "hasError: false")
3. O token esteja sendo enviado no header Authorization

## CÓDIGO ATUAL - FRONTEND

### Arquivo: client/src/pages/formalizacao.tsx (linha ~1232)

```typescript
onClick={async () => {
  try {
    // Importar TokenManager para obter token válido
    const { TokenManager } = await import('@/lib/apiClient');
    const tokenManager = TokenManager.getInstance();
    const token = await tokenManager.getValidToken();

    if (!token) {
      throw new Error('Não autenticado');
    }

    const response = await fetch(boleto.linkPdf, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleto-parcela-${boleto.numeroParcela}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      throw new Error('Erro ao baixar PDF');
    }
  } catch (error) {
    console.error('Erro ao baixar PDF:', error);
    toast({
      title: "Erro ao baixar PDF",
      description: "Não foi possível baixar o boleto",
      variant: "destructive",
    });
  }
}}
```

## CÓDIGO ATUAL - BACKEND

### Arquivo: server/routes/inter-collections.ts (linha ~110)

```typescript
/**
 * Download do PDF de um boleto específico
 * GET /api/inter/collections/:propostaId/:codigoSolicitacao/pdf
 */
router.get(
  '/:propostaId/:codigoSolicitacao/pdf',
  jwtAuthMiddleware,
  requireAnyRole,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { codigoSolicitacao } = req.params;

      console.log(`[INTER COLLECTIONS] Downloading PDF for collection: ${codigoSolicitacao}`);

      const interService = interBankService;
      const pdfData = await interService.obterPdfBoleto(codigoSolicitacao);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="boleto-${codigoSolicitacao}.pdf"`
      );
      res.send(pdfData);
    } catch (error) {
      console.error('[INTER COLLECTIONS] Error downloading PDF:', error);
      res.status(500).json({ error: 'Erro ao baixar PDF do boleto' });
    }
  }
);
```

### JWT Middleware: server/lib/jwt-auth-middleware.ts

```typescript
export const jwtAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Erro ao validar token' });
  }
};
```

## TENTATIVAS JÁ REALIZADAS (TODAS FALHARAM)

1. **localStorage.getItem('token')** - Falhou
2. **Supabase session.access_token** - Falhou
3. **TokenManager.getValidToken()** - Falhou (tentativa atual)
4. **apiRequest com responseType: 'blob'** - Falhou

## LOGS DE SUCESSO EM OUTRAS ROTAS

```
🔐 JWT VALIDATION: {
  hasError: false,
  errorType: null,
  hasUser: true,
  userId: 'a65efc54-90cd-4b94-b971-c8a560104032',
  timestamp: '2025-08-05T12:28:16.943Z'
}
```

## O QUE PRECISAMOS

1. **Diagnóstico**: Por que o JWT funciona em todas as outras rotas mas falha especificamente no download de PDF?
2. **Solução**: Como fazer o download de PDF funcionar mantendo a segurança JWT?
3. **Alternativa**: Se não for possível via fetch direto, qual seria a melhor abordagem?

## REQUISITOS CRÍTICOS

- Manter segurança JWT (não pode ser rota pública)
- Download deve funcionar cross-browser
- Solução deve ser compatível com Supabase Auth
- Não pode quebrar outras funcionalidades existentes

## OBSERVAÇÕES IMPORTANTES

- O erro parece estar relacionado ao formato/envio do token especificamente para download de arquivos
- Outras APIs protegidas funcionam perfeitamente com o mesmo token
- O backend está recebendo requisições mas rejeitando com 401
- Não temos acesso aos logs detalhados do erro 401 (precisamos adicionar mais logging?)

## PERGUNTA FINAL

Como resolver este problema de autenticação JWT especificamente para download de PDFs, considerando que o mesmo token funciona perfeitamente para todas as outras rotas da aplicação?

Preciso de uma solução que:

1. Identifique a causa raiz do problema
2. Forneça código corrigido (frontend e/ou backend)
3. Seja testável e confiável em produção
4. Mantenha a segurança da aplicação

Por favor, analise profundamente este problema e forneça uma solução definitiva.
