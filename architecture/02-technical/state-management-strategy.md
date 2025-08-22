# Estratégia de Gestão de Estado no Cliente - Sistema Simpix

**Documento Técnico:** State Management Strategy  
**Versão:** 1.0  
**Data:** 22 de Agosto de 2025  
**Status:** Oficial - Manual de Regras  
**Aprovação:** Pendente Ratificação do Arquiteto Chefe  

---

## 📋 **SUMÁRIO EXECUTIVO**

Este documento formaliza a estratégia de gestão de estado no frontend do Sistema Simpix, estabelecendo regras claras sobre quando e como usar cada ferramenta de gestão de estado. Constitui o "manual de regras" que previne complexidade acidental, prop drilling e estado inconsistente, garantindo uma UI previsível, performática e de fácil manutenção.

**Ponto de Conformidade:** Remediação do Ponto 59 - Gestão de Estado  
**Criticidade:** P1 (Alta)  
**Impacto:** Padronização e consistência na gestão de estado  

---

## 🎯 **1. A DOUTRINA DE SEPARAÇÃO DE ESTADO**

### 1.1 Taxonomia Fundamental do Estado

```typescript
// ====================================
// TAXONOMIA DE ESTADO - DEFINIÇÕES FUNDAMENTAIS
// ====================================

type StateCategory = 
  | 'ServerCacheState'  // Dados que vivem no backend
  | 'ClientUIState'     // Dados que vivem apenas no navegador
  | 'HybridState';      // Dados que sincronizam entre ambos

interface StateClassification {
  // Estado do Servidor (Server Cache State)
  serverState: {
    definition: 'Dados que são a fonte da verdade no backend',
    characteristics: [
      'Pode ser compartilhado entre múltiplos clientes',
      'Persiste além da sessão do usuário',
      'Requer sincronização com o servidor',
      'Sujeito a stale-while-revalidate'
    ],
    examples: [
      'Lista de propostas',
      'Dados do cliente',
      'Configurações de produtos',
      'Relatórios financeiros'
    ],
    management: 'TanStack Query (React Query)'
  };
  
  // Estado da UI (Client UI State)
  clientState: {
    definition: 'Dados que existem apenas no contexto do navegador',
    characteristics: [
      'Específico para a sessão atual do usuário',
      'Não persiste por padrão',
      'Não compartilhado entre clientes',
      'Performance crítica (sem latência de rede)'
    ],
    examples: [
      'Modal aberto/fechado',
      'Tab selecionada',
      'Filtros temporários',
      'Estado de formulário não salvo'
    ],
    management: 'Context API | useReducer | useState'
  };
}
```

### 1.2 Matriz de Decisão de Estado

```typescript
// Decision Matrix for State Management
const stateDecisionMatrix = {
  criteria: {
    persistence: 'Precisa sobreviver ao refresh?',
    sharing: 'Compartilhado entre componentes?',
    complexity: 'Lógica de atualização complexa?',
    frequency: 'Frequência de atualização?',
    source: 'Fonte da verdade é o servidor?'
  },
  
  decision: (answers: StateAnswers): StateStrategy => {
    if (answers.source === 'server') {
      return 'TanStack Query';
    }
    
    if (answers.sharing === 'global') {
      return 'Context API';
    }
    
    if (answers.complexity === 'high') {
      return 'useReducer + Context';
    }
    
    if (answers.persistence === 'required') {
      return 'LocalStorage + Context';
    }
    
    return 'useState'; // Local simples
  }
};
```

### 1.3 Princípios Fundamentais

```typescript
// Core Principles of State Management
const coreStatePrinciples = {
  // 1. Single Source of Truth
  singleSource: {
    rule: 'Cada pedaço de estado tem UMA fonte da verdade',
    implementation: 'Server state no backend, UI state no frontend',
    antiPattern: 'Duplicar server state em useState'
  },
  
  // 2. Minimal State
  minimalState: {
    rule: 'Armazenar apenas o estado essencial',
    implementation: 'Derivar valores sempre que possível',
    antiPattern: 'Armazenar valores calculáveis'
  },
  
  // 3. Colocação Correta
  stateColocation: {
    rule: 'Colocar estado o mais próximo possível de onde é usado',
    implementation: 'Preferir useState local antes de Context global',
    antiPattern: 'Todo estado no Context global'
  },
  
  // 4. Imutabilidade
  immutability: {
    rule: 'Nunca mutar estado diretamente',
    implementation: 'Usar spread operators ou immer',
    antiPattern: 'array.push(), object.prop = value'
  }
};
```

---

## 🔄 **2. ESTRATÉGIA PARA ESTADO DO SERVIDOR**

### 2.1 TanStack Query como Padrão Obrigatório

```typescript
// ====================================
// TANSTACK QUERY - CONFIGURAÇÃO PADRÃO
// ====================================

import { QueryClient } from '@tanstack/react-query';

// Configuração Global Obrigatória
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Política de Cache
      staleTime: 5 * 60 * 1000,      // 5 minutos - dados considerados frescos
      cacheTime: 10 * 60 * 1000,     // 10 minutos - mantém em cache
      
      // Política de Retry
      retry: 3,                       // 3 tentativas em caso de erro
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Política de Refetch
      refetchOnWindowFocus: true,    // Atualiza ao focar janela
      refetchOnReconnect: true,      // Atualiza ao reconectar
      refetchInterval: false,        // Sem polling por padrão
      
      // Performance
      suspense: false,                // Não usar Suspense por padrão
      useErrorBoundary: false        // Tratamento manual de erros
    },
    
    mutations: {
      // Retry automático desabilitado para mutações
      retry: 0,
      
      // Error handling
      useErrorBoundary: false
    }
  }
});
```

### 2.2 Políticas de Cache por Domínio

```typescript
// ====================================
// POLÍTICAS DE CACHE ESPECÍFICAS POR DOMÍNIO
// ====================================

const cachePolicies = {
  // Dados estáticos (raramente mudam)
  static: {
    staleTime: 24 * 60 * 60 * 1000,  // 24 horas
    cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 dias
    examples: ['produtos', 'tabelas_comerciais', 'configurações']
  },
  
  // Dados dinâmicos (mudam frequentemente)
  dynamic: {
    staleTime: 1 * 60 * 1000,        // 1 minuto
    cacheTime: 5 * 60 * 1000,        // 5 minutos
    examples: ['propostas', 'notificações', 'dashboard']
  },
  
  // Dados críticos (sempre frescos)
  critical: {
    staleTime: 0,                    // Sempre stale
    cacheTime: 30 * 1000,            // 30 segundos
    examples: ['saldo', 'pagamentos', 'status_contrato']
  },
  
  // Dados em tempo real
  realtime: {
    staleTime: 0,
    cacheTime: 0,
    refetchInterval: 5000,           // Polling a cada 5s
    examples: ['alertas', 'mensagens', 'status_processamento']
  }
};

// Implementação com hooks customizados
export const usePropostas = (filters?: PropostaFilters) => {
  return useQuery({
    queryKey: ['propostas', filters],
    queryFn: () => fetchPropostas(filters),
    ...cachePolicies.dynamic
  });
};

export const useProdutos = () => {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: fetchProdutos,
    ...cachePolicies.static
  });
};
```

### 2.3 Sincronização e Invalidação

```typescript
// ====================================
// ESTRATÉGIA DE INVALIDAÇÃO APÓS MUTAÇÕES
// ====================================

const invalidationStrategy = {
  // Invalidação Específica (Preferida)
  specific: {
    pattern: 'Invalidar apenas queries afetadas',
    implementation: `
      // Após criar proposta
      onSuccess: (newProposta) => {
        queryClient.invalidateQueries(['propostas']);
        queryClient.invalidateQueries(['dashboard-stats']);
        // NÃO invalidar ['produtos'] - não foi afetado
      }
    `
  },
  
  // Invalidação em Cascata
  cascade: {
    pattern: 'Invalidar queries relacionadas',
    implementation: `
      // Após atualizar cliente
      onSuccess: (cliente) => {
        queryClient.invalidateQueries(['clientes', cliente.id]);
        queryClient.invalidateQueries(['propostas', { clienteId: cliente.id }]);
        queryClient.invalidateQueries(['contratos', { clienteId: cliente.id }]);
      }
    `
  },
  
  // Atualização Otimista
  optimistic: {
    pattern: 'Atualizar UI antes da confirmação do servidor',
    implementation: `
      useMutation({
        mutationFn: updateProposta,
        onMutate: async (newData) => {
          // Cancelar refetches
          await queryClient.cancelQueries(['propostas', id]);
          
          // Snapshot do estado anterior
          const previousProposta = queryClient.getQueryData(['propostas', id]);
          
          // Atualização otimista
          queryClient.setQueryData(['propostas', id], newData);
          
          // Retornar contexto para rollback
          return { previousProposta };
        },
        onError: (err, newData, context) => {
          // Rollback em caso de erro
          queryClient.setQueryData(
            ['propostas', id], 
            context.previousProposta
          );
        },
        onSettled: () => {
          // Sempre revalidar após conclusão
          queryClient.invalidateQueries(['propostas', id]);
        }
      })
    `
  }
};
```

### 2.4 Background Sync Strategy

```typescript
// ====================================
// SINCRONIZAÇÃO EM BACKGROUND
// ====================================

class BackgroundSyncManager {
  private syncInterval: number = 30000; // 30 segundos
  private criticalQueries = ['propostas', 'pagamentos', 'alertas'];
  
  startSync() {
    // Sincronização periódica para queries críticas
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.criticalQueries.forEach(queryKey => {
          queryClient.invalidateQueries([queryKey], {
            refetchType: 'active' // Apenas queries ativas
          });
        });
      }
    }, this.syncInterval);
    
    // Sincronização em eventos específicos
    window.addEventListener('online', () => {
      queryClient.refetchQueries({
        type: 'all',
        stale: true
      });
    });
    
    // WebSocket para atualizações em tempo real
    this.setupWebSocket();
  }
  
  private setupWebSocket() {
    const ws = new WebSocket(process.env.VITE_WS_URL);
    
    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      
      switch (type) {
        case 'PROPOSTA_UPDATED':
          queryClient.invalidateQueries(['propostas', payload.id]);
          break;
        case 'PAYMENT_RECEIVED':
          queryClient.invalidateQueries(['pagamentos']);
          queryClient.invalidateQueries(['dashboard-stats']);
          break;
        case 'NOTIFICATION':
          queryClient.invalidateQueries(['notificacoes']);
          break;
      }
    };
  }
}
```

---

## 🌍 **3. ESTRATÉGIA PARA ESTADO GLOBAL DA UI**

### 3.1 React Context API - Casos de Uso Aprovados

```typescript
// ====================================
// CONTEXTOS GLOBAIS OBRIGATÓRIOS
// ====================================

// 1. CONTEXTO DE AUTENTICAÇÃO
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  permissions: Permission[];
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  // Sincronizar com Supabase Auth
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const userData = await fetchUserProfile(session.user.id);
          setUser(userData);
        } else {
          setUser(null);
        }
      }
    );
    
    return () => authListener.subscription.unsubscribe();
  }, []);
  
  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    permissions: user?.permissions || [],
    login: async (credentials) => {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
    },
    logout: () => supabase.auth.signOut(),
    refreshToken: () => supabase.auth.refreshSession()
  }), [user]);
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook customizado obrigatório
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 3.2 Theme Context Implementation

```typescript
// 2. CONTEXTO DE TEMA
interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    // Recuperar do localStorage
    const stored = localStorage.getItem('theme');
    return (stored as any) || 'system';
  });
  
  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
    }
    return theme;
  }, [theme]);
  
  // Aplicar tema no documento
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Persistir preferência
    localStorage.setItem('theme', theme);
  }, [theme, resolvedTheme]);
  
  // Ouvir mudanças do sistema
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system'); // Trigger re-render
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);
  
  const value = useMemo(() => ({
    theme,
    setTheme: setThemeState,
    resolvedTheme
  }), [theme, resolvedTheme]);
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
```

### 3.3 Feature Flags Context

```typescript
// 3. CONTEXTO DE FEATURE FLAGS
interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  isEnabled: (flag: string) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export const FeatureFlagsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Usar TanStack Query para sincronizar com servidor
  const { data: flags = {}, isLoading, refetch } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 60 * 1000 // Auto-refresh cada minuto
  });
  
  const value = useMemo(() => ({
    flags,
    isEnabled: (flag: string) => flags[flag] === true,
    isLoading,
    refresh: refetch
  }), [flags, isLoading, refetch]);
  
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

// Hook com fallback seguro
export const useFeatureFlag = (flag: string, defaultValue = false): boolean => {
  const context = useContext(FeatureFlagsContext);
  if (!context) return defaultValue;
  return context.isEnabled(flag);
};
```

### 3.4 Regras para Novos Contextos

```typescript
// ====================================
// CRITÉRIOS PARA CRIAR NOVO CONTEXTO GLOBAL
// ====================================

const contextCreationCriteria = {
  mustHave: [
    'Estado compartilhado por >50% dos componentes',
    'Estado que precisa ser acessado em diferentes níveis da árvore',
    'Estado que não vem do servidor'
  ],
  
  niceToHave: [
    'Lógica de atualização complexa',
    'Necessidade de performance (evitar prop drilling)',
    'Estado que persiste entre navegações'
  ],
  
  antiPatterns: [
    'Estado que vem do servidor (usar TanStack Query)',
    'Estado local de um componente (usar useState)',
    'Estado de formulário (usar react-hook-form)',
    'Estado derivado (calcular on-the-fly)'
  ],
  
  template: `
    // Template para novo contexto global
    interface ${Name}ContextValue {
      // Estado
      state: StateType;
      
      // Ações
      actions: {
        update: (newState: Partial<StateType>) => void;
        reset: () => void;
      };
      
      // Computados
      computed: {
        derivedValue: ComputedType;
      };
    }
    
    const ${Name}Context = createContext<${Name}ContextValue | null>(null);
    
    export const use${Name} = () => {
      const context = useContext(${Name}Context);
      if (!context) {
        throw new Error('use${Name} must be used within ${Name}Provider');
      }
      return context;
    };
  `
};
```

---

## 🔧 **4. ESTRATÉGIA PARA ESTADO LOCAL COMPLEXO**

### 4.1 useReducer Pattern para Formulários Multi-Step

```typescript
// ====================================
// FORMULÁRIO MULTI-STEP COM useReducer
// ====================================

// Estado do formulário de proposta (exemplo complexo)
interface ProposalFormState {
  currentStep: number;
  maxStepReached: number;
  
  // Dados por step
  clientData: ClientFormData;
  creditConditions: CreditConditionsData;
  documents: DocumentData[];
  analysis: AnalysisData;
  
  // Meta estado
  validation: Record<number, ValidationResult>;
  isDirty: boolean;
  isSubmitting: boolean;
  lastSavedAt?: Date;
}

// Ações possíveis
type ProposalFormAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'UPDATE_CLIENT_DATA'; payload: Partial<ClientFormData> }
  | { type: 'UPDATE_CREDIT_CONDITIONS'; payload: Partial<CreditConditionsData> }
  | { type: 'ADD_DOCUMENT'; payload: DocumentData }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'VALIDATE_STEP'; payload: { step: number; result: ValidationResult } }
  | { type: 'SAVE_DRAFT' }
  | { type: 'SUBMIT_FORM' }
  | { type: 'RESET_FORM' };

// Reducer com lógica complexa
const proposalFormReducer = (
  state: ProposalFormState,
  action: ProposalFormAction
): ProposalFormState => {
  switch (action.type) {
    case 'SET_STEP':
      // Validar step atual antes de mudar
      if (!state.validation[state.currentStep]?.isValid) {
        return state; // Bloquear navegação se inválido
      }
      return {
        ...state,
        currentStep: action.payload,
        maxStepReached: Math.max(state.maxStepReached, action.payload)
      };
      
    case 'NEXT_STEP':
      const nextStep = state.currentStep + 1;
      if (nextStep > 4) return state; // Max 4 steps
      return {
        ...state,
        currentStep: nextStep,
        maxStepReached: Math.max(state.maxStepReached, nextStep)
      };
      
    case 'UPDATE_CLIENT_DATA':
      return {
        ...state,
        clientData: { ...state.clientData, ...action.payload },
        isDirty: true
      };
      
    case 'VALIDATE_STEP':
      return {
        ...state,
        validation: {
          ...state.validation,
          [action.payload.step]: action.payload.result
        }
      };
      
    case 'SAVE_DRAFT':
      // Salvar no localStorage
      localStorage.setItem(
        'proposal-draft',
        JSON.stringify({
          clientData: state.clientData,
          creditConditions: state.creditConditions,
          documents: state.documents
        })
      );
      return {
        ...state,
        isDirty: false,
        lastSavedAt: new Date()
      };
      
    case 'RESET_FORM':
      localStorage.removeItem('proposal-draft');
      return initialProposalFormState;
      
    default:
      return state;
  }
};

// Context Provider para o formulário
export const ProposalFormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(proposalFormReducer, initialProposalFormState, (initial) => {
    // Recuperar draft do localStorage se existir
    const draft = localStorage.getItem('proposal-draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      return { ...initial, ...parsed, isDirty: false };
    }
    return initial;
  });
  
  // Auto-save a cada 30 segundos se dirty
  useEffect(() => {
    if (!state.isDirty) return;
    
    const timer = setTimeout(() => {
      dispatch({ type: 'SAVE_DRAFT' });
    }, 30000);
    
    return () => clearTimeout(timer);
  }, [state.isDirty, state.clientData, state.creditConditions]);
  
  // Mutations com TanStack Query
  const submitMutation = useMutation({
    mutationFn: submitProposal,
    onSuccess: () => {
      dispatch({ type: 'RESET_FORM' });
      toast.success('Proposta enviada com sucesso!');
    }
  });
  
  const value = useMemo(() => ({
    ...state,
    dispatch,
    actions: {
      nextStep: () => dispatch({ type: 'NEXT_STEP' }),
      previousStep: () => dispatch({ type: 'PREVIOUS_STEP' }),
      updateClientData: (data: Partial<ClientFormData>) => 
        dispatch({ type: 'UPDATE_CLIENT_DATA', payload: data }),
      saveDraft: () => dispatch({ type: 'SAVE_DRAFT' }),
      submit: () => submitMutation.mutate(state)
    }
  }), [state, submitMutation]);
  
  return (
    <ProposalFormContext.Provider value={value}>
      {children}
    </ProposalFormContext.Provider>
  );
};
```

### 4.2 Padrões para Estado Local Complexo

```typescript
// ====================================
// QUANDO USAR useReducer vs useState
// ====================================

const useReducerCriteria = {
  useWhen: [
    'Estado tem múltiplas sub-propriedades interdependentes',
    'Próximo estado depende do estado anterior',
    'Lógica de atualização é complexa (>3 condições)',
    'Múltiplos componentes precisam disparar as mesmas ações',
    'Necessidade de desfazer/refazer (undo/redo)'
  ],
  
  examples: [
    'Formulários multi-step',
    'Carrinho de compras',
    'Wizards de configuração',
    'Editores com estado complexo',
    'Dashboards configuráveis'
  ],
  
  pattern: `
    // Estrutura recomendada
    const [state, dispatch] = useReducer(reducer, initialState, init);
    
    // Sempre criar ações tipadas
    type Action = 
      | { type: 'ACTION_1'; payload: Type1 }
      | { type: 'ACTION_2'; payload: Type2 };
    
    // Reducer puro e testável
    const reducer = (state: State, action: Action): State => {
      // Sem side effects
      // Sempre retornar novo estado
      // Usar immer se necessário para simplificar
    };
    
    // Wrapper com Context se compartilhado
    const StateContext = createContext(null);
    const DispatchContext = createContext(null);
  `
};

// Exemplo com Immer para simplificar updates
import { produce } from 'immer';

const complexReducer = produce((draft: ComplexState, action: Action) => {
  switch (action.type) {
    case 'UPDATE_NESTED':
      // Mutação segura com Immer
      draft.deeply.nested.property = action.payload;
      break;
      
    case 'ADD_TO_ARRAY':
      draft.items.push(action.payload);
      break;
      
    case 'REMOVE_FROM_ARRAY':
      const index = draft.items.findIndex(item => item.id === action.payload);
      if (index !== -1) draft.items.splice(index, 1);
      break;
  }
});
```

### 4.3 Composição de Reducers

```typescript
// ====================================
// COMPOSIÇÃO DE REDUCERS PARA ESTADO MUITO COMPLEXO
// ====================================

// Reducer composition pattern
const combineReducers = <S extends Record<string, any>>(
  reducers: { [K in keyof S]: Reducer<S[K], any> }
): Reducer<S, any> => {
  return (state, action) => {
    const newState = {} as S;
    let hasChanged = false;
    
    for (const key in reducers) {
      const reducer = reducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      
      newState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    
    return hasChanged ? newState : state;
  };
};

// Uso com múltiplos sub-reducers
const appReducer = combineReducers({
  proposals: proposalsReducer,
  filters: filtersReducer,
  ui: uiReducer,
  notifications: notificationsReducer
});

// Middleware pattern para side effects
const withLogger = (reducer: Reducer<any, any>) => {
  return (state: any, action: any) => {
    console.group(action.type);
    console.log('Previous State:', state);
    console.log('Action:', action);
    const nextState = reducer(state, action);
    console.log('Next State:', nextState);
    console.groupEnd();
    return nextState;
  };
};

const withPersistence = (reducer: Reducer<any, any>, key: string) => {
  return (state: any, action: any) => {
    const nextState = reducer(state, action);
    localStorage.setItem(key, JSON.stringify(nextState));
    return nextState;
  };
};

// Aplicar middlewares
const enhancedReducer = withLogger(withPersistence(appReducer, 'app-state'));
```

---

## 💾 **5. ESTRATÉGIA DE PERSISTÊNCIA DE ESTADO NO CLIENTE**

### 5.1 Política de Uso do LocalStorage

```typescript
// ====================================
// REGRAS PARA PERSISTÊNCIA LOCAL
// ====================================

interface PersistencePolicy {
  allowed: {
    items: [
      'Preferências de UI (tema, idioma)',
      'Drafts de formulários não submetidos',
      'Filtros e ordenação de tabelas',
      'Estado de componentes colapsáveis',
      'Tokens de autenticação (com cuidado)'
    ],
    maxSize: '5MB total',
    encryption: 'Obrigatório para dados sensíveis'
  };
  
  forbidden: {
    items: [
      'Dados de clientes (PII)',
      'Informações financeiras',
      'Senhas em texto plano',
      'Dados que vêm do servidor (usar cache do Query)'
    ]
  };
  
  implementation: {
    wrapper: 'StorageManager class obrigatória',
    versioning: 'Incluir versão no schema',
    migration: 'Estratégia de migração entre versões',
    cleanup: 'TTL e garbage collection'
  };
}
```

### 5.2 StorageManager Implementation

```typescript
// ====================================
// STORAGE MANAGER - CLASSE OBRIGATÓRIA
// ====================================

class StorageManager {
  private readonly prefix = 'simpix_';
  private readonly version = '1.0.0';
  
  // Criptografia simples para dados sensíveis
  private encrypt(data: string): string {
    // Em produção, usar crypto-js ou similar
    return btoa(encodeURIComponent(data));
  }
  
  private decrypt(data: string): string {
    return decodeURIComponent(atob(data));
  }
  
  // Set com TTL opcional
  set<T>(key: string, value: T, ttlMinutes?: number): void {
    const fullKey = `${this.prefix}${key}`;
    
    const data = {
      value,
      version: this.version,
      timestamp: Date.now(),
      ttl: ttlMinutes ? ttlMinutes * 60 * 1000 : null
    };
    
    try {
      const serialized = JSON.stringify(data);
      const toStore = this.shouldEncrypt(key) 
        ? this.encrypt(serialized) 
        : serialized;
      
      localStorage.setItem(fullKey, toStore);
    } catch (error) {
      // Quota exceeded ou outro erro
      console.error('Storage error:', error);
      this.cleanup(); // Tentar limpar espaço
    }
  }
  
  // Get com validação de TTL
  get<T>(key: string, defaultValue?: T): T | undefined {
    const fullKey = `${this.prefix}${key}`;
    
    try {
      const stored = localStorage.getItem(fullKey);
      if (!stored) return defaultValue;
      
      const decrypted = this.shouldEncrypt(key) 
        ? this.decrypt(stored) 
        : stored;
      
      const data = JSON.parse(decrypted);
      
      // Verificar versão
      if (data.version !== this.version) {
        this.migrate(key, data);
      }
      
      // Verificar TTL
      if (data.ttl && Date.now() - data.timestamp > data.ttl) {
        this.remove(key);
        return defaultValue;
      }
      
      return data.value;
    } catch (error) {
      console.error('Storage read error:', error);
      return defaultValue;
    }
  }
  
  // Remover item
  remove(key: string): void {
    const fullKey = `${this.prefix}${key}`;
    localStorage.removeItem(fullKey);
  }
  
  // Limpar itens expirados
  cleanup(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (!key.startsWith(this.prefix)) return;
      
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.ttl && now - data.timestamp > data.ttl) {
          localStorage.removeItem(key);
        }
      } catch {
        // Item corrompido, remover
        localStorage.removeItem(key);
      }
    });
  }
  
  // Verificar se deve criptografar
  private shouldEncrypt(key: string): boolean {
    const sensitiveKeys = ['auth_token', 'refresh_token', 'user_data'];
    return sensitiveKeys.includes(key);
  }
  
  // Migração entre versões
  private migrate(key: string, data: any): void {
    // Implementar lógica de migração específica
    console.log(`Migrating ${key} from ${data.version} to ${this.version}`);
  }
  
  // Obter tamanho usado
  getUsedSpace(): number {
    let size = 0;
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        const item = localStorage.getItem(key);
        if (item) size += item.length;
      }
    });
    
    return size;
  }
  
  // Verificar espaço disponível
  hasSpace(bytes: number): boolean {
    try {
      const test = 'x'.repeat(bytes);
      localStorage.setItem('__test__', test);
      localStorage.removeItem('__test__');
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const storage = new StorageManager();
```

### 5.3 React Hooks para Persistência

```typescript
// ====================================
// HOOKS CUSTOMIZADOS PARA PERSISTÊNCIA
// ====================================

// Hook para estado persistido
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: {
    ttlMinutes?: number;
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void] {
  // Inicializar do storage ou default
  const [state, setState] = useState<T>(() => {
    return storage.get(key, defaultValue) ?? defaultValue;
  });
  
  // Sincronizar com storage
  useEffect(() => {
    storage.set(key, state, options?.ttlMinutes);
  }, [key, state, options?.ttlMinutes]);
  
  // Ouvir mudanças de outras abas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `simpix_${key}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          setState(data.value);
        } catch {}
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);
  
  return [state, setState];
}

// Hook para form draft
export function useFormDraft<T extends Record<string, any>>(
  formKey: string,
  initialValues: T
): {
  values: T;
  updateField: (field: keyof T, value: any) => void;
  saveDraft: () => void;
  clearDraft: () => void;
  hasDraft: boolean;
} {
  const [values, setValues] = usePersistedState(
    `draft_${formKey}`,
    initialValues,
    { ttlMinutes: 24 * 60 } // 24 horas
  );
  
  const updateField = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, [setValues]);
  
  const saveDraft = useCallback(() => {
    storage.set(`draft_${formKey}`, values, 24 * 60);
    toast.success('Rascunho salvo');
  }, [formKey, values]);
  
  const clearDraft = useCallback(() => {
    storage.remove(`draft_${formKey}`);
    setValues(initialValues);
  }, [formKey, initialValues, setValues]);
  
  const hasDraft = useMemo(() => {
    const draft = storage.get(`draft_${formKey}`);
    return draft !== undefined && draft !== initialValues;
  }, [formKey, initialValues]);
  
  return { values, updateField, saveDraft, clearDraft, hasDraft };
}

// Hook para preferências do usuário
export function useUserPreferences() {
  const [preferences, setPreferences] = usePersistedState('user_preferences', {
    theme: 'system',
    language: 'pt-BR',
    density: 'comfortable',
    notifications: true,
    autoSave: true
  });
  
  const updatePreference = useCallback((key: string, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, [setPreferences]);
  
  return { preferences, updatePreference };
}
```

### 5.4 Estratégia de Cleanup e Manutenção

```typescript
// ====================================
// MANUTENÇÃO AUTOMÁTICA DO STORAGE
// ====================================

class StorageMaintenanceService {
  private readonly maxStorageSize = 5 * 1024 * 1024; // 5MB
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hora
  
  start() {
    // Cleanup inicial
    this.performCleanup();
    
    // Cleanup periódico
    setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
    
    // Cleanup em eventos
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performCleanup();
      }
    });
  }
  
  private performCleanup() {
    const storage = new StorageManager();
    
    // 1. Remover itens expirados
    storage.cleanup();
    
    // 2. Verificar tamanho total
    const usedSpace = storage.getUsedSpace();
    
    if (usedSpace > this.maxStorageSize) {
      // 3. Remover itens mais antigos se necessário
      this.removeOldestItems(usedSpace - this.maxStorageSize);
    }
    
    // 4. Registrar métricas
    console.log(`Storage cleanup: ${(usedSpace / 1024).toFixed(2)}KB used`);
  }
  
  private removeOldestItems(bytesToFree: number) {
    const items: Array<{ key: string; timestamp: number; size: number }> = [];
    
    // Coletar todos os itens com timestamps
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith('simpix_')) return;
      
      try {
        const item = localStorage.getItem(key);
        if (!item) return;
        
        const data = JSON.parse(item);
        items.push({
          key,
          timestamp: data.timestamp || 0,
          size: item.length
        });
      } catch {}
    });
    
    // Ordenar por timestamp (mais antigo primeiro)
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remover até liberar espaço suficiente
    let freedSpace = 0;
    for (const item of items) {
      if (freedSpace >= bytesToFree) break;
      
      localStorage.removeItem(item.key);
      freedSpace += item.size;
    }
  }
}

// Iniciar serviço de manutenção
export const storageMaintenanceService = new StorageMaintenanceService();
```

---

## 📊 **MÉTRICAS E MONITORAMENTO**

### Indicadores de Saúde do Estado

```typescript
// ====================================
// MÉTRICAS DE GESTÃO DE ESTADO
// ====================================

interface StateHealthMetrics {
  // Performance Metrics
  performance: {
    renderCount: number;
    renderTime: number;
    cacheHitRate: number;
    staleDataServed: number;
  };
  
  // Storage Metrics
  storage: {
    localStorageUsed: number;
    cacheSize: number;
    itemCount: number;
    expiredItems: number;
  };
  
  // Quality Metrics
  quality: {
    propDrillingDepth: number;
    contextCount: number;
    reducerComplexity: number;
    stateUpdateFrequency: number;
  };
}

// Monitoramento em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  // React DevTools Profiler
  const logProfiler = (id: string, phase: string, actualDuration: number) => {
    if (actualDuration > 16) { // > 1 frame
      console.warn(`Slow render in ${id}: ${actualDuration}ms`);
    }
  };
  
  // TanStack Query DevTools
  import('@tanstack/react-query-devtools').then(({ ReactQueryDevtools }) => {
    // Auto-included in development
  });
  
  // Context DevTools
  window.__REACT_CONTEXT_DEVTOOLS_GLOBAL_HOOK__ = {
    onCommitFiberRoot: (id: any, root: any) => {
      // Monitor context updates
    }
  };
}
```

---

## ✅ **CONCLUSÃO E CHECKLIST DE CONFORMIDADE**

### Checklist de Implementação

```typescript
const stateManagementChecklist = {
  serverState: {
    '✅ TanStack Query configurado': true,
    '✅ Políticas de cache definidas': true,
    '✅ Invalidação automática': true,
    '✅ Background sync implementado': true
  },
  
  globalUIState: {
    '✅ AuthContext implementado': true,
    '✅ ThemeContext implementado': true,
    '✅ FeatureFlagsContext implementado': true,
    '✅ Regras para novos contextos': true
  },
  
  complexLocalState: {
    '✅ useReducer patterns definidos': true,
    '✅ Form state management': true,
    '✅ Composition patterns': true,
    '✅ Middleware patterns': true
  },
  
  persistence: {
    '✅ StorageManager implementado': true,
    '✅ Hooks de persistência': true,
    '✅ Cleanup automático': true,
    '✅ Políticas de segurança': true
  }
};
```

### Resumo das Decisões

1. **Server State:** TanStack Query exclusivamente
2. **Global UI State:** Context API para auth, theme, feature flags
3. **Complex Local State:** useReducer com Context local
4. **Simple Local State:** useState
5. **Persistence:** StorageManager com TTL e cleanup

### Governança

- **Revisão:** Trimestral com métricas de performance
- **Aprovação:** Novos patterns requerem aprovação do Tech Lead
- **Documentação:** Manter exemplos atualizados
- **Treinamento:** Workshop mensal sobre patterns

---

**Documento criado por:** GEM-07 AI Specialist System  
**Data:** 2025-08-22  
**Versão:** 1.0  
**Status:** Aguardando ratificação do Arquiteto Chefe  
**Próxima revisão:** Q4 2025