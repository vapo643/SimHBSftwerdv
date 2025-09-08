# 📋 BLUEPRINT: Modal de Preenchimento Automático CPF

**PROTOCOLO:** PAM V1.0 - Operação Aceleração de Originação (TRACK 1, FASE 2)  
**MISSÃO:** Arquitetura UX/UI para Substituição de `window.confirm()`  
**DATA:** 2025-09-03  
**ARQUITETO:** Replit Agent AI

---

## 🎯 SUMÁRIO EXECUTIVO

**OBJETIVO:** Substituir o `window.confirm()` existente no componente `ClientDataStep.tsx` por um modal customizado utilizando a biblioteca `shadcn/ui`, proporcionando uma experiência de usuário superior, consistente e profissional.

**IMPACTO ESPERADO:**

- ✅ UX profissional alinhada com o design system
- ✅ Controle total sobre estilo e comportamento
- ✅ Melhor acessibilidade e responsividade
- ✅ Integração nativa com o theme da aplicação

---

## 🔍 ANÁLISE TÉCNICA

### **Estado Atual (Current State)**

**Localização:** `client/src/components/propostas/ClientDataStep.tsx` (linhas 172-174)

```typescript
// PROBLEMA: Uso de window.confirm() - interface genérica e inconsistente
const userConfirmed = window.confirm(
  `Cliente já cadastrado!\n\nEncontramos dados de: ${data.nome}\n\nDeseja usar os dados existentes para esta nova proposta?`
);

if (userConfirmed) {
  // Lógica de preenchimento (funcional)
  updateClient({ ...data });
  toast({ title: 'Dados carregados!', description: '...' });
}
```

**Problemas Identificados:**

- ❌ Interface visualmente inconsistente com o design system
- ❌ Limitações de styling e customização
- ❌ Experiência de usuário inadequada para aplicação bancária
- ❌ Bloqueio do thread principal do navegador
- ❌ Não responsivo em dispositivos móveis

---

## 🎨 ARQUITETURA DA SOLUÇÃO

### **1. Seleção de Componente**

**RECOMENDAÇÃO:** `AlertDialog` (shadcn/ui)

**JUSTIFICATIVA TÉCNICA:**

- ✅ **Comportamento Correto:** Exige resposta explícita do usuário (não pode ser fechado acidentalmente)
- ✅ **Semântica Apropriada:** `role="alertdialog"` para leitores de tela
- ✅ **Acessibilidade Avançada:** Foco inicial no botão seguro (Cancelar)
- ✅ **Componente Já Disponível:** `ConfirmationDialog.tsx` existente pode ser reutilizado

**Comparação AlertDialog vs Dialog:**

| Aspecto                       | AlertDialog              | Dialog                |
| ----------------------------- | ------------------------ | --------------------- |
| **Fechamento ao clicar fora** | ❌ Não                   | ✅ Sim                |
| **Resposta obrigatória**      | ✅ Sim                   | ❌ Não                |
| **Uso recomendado**           | ✅ Confirmações críticas | ❌ Formulários gerais |
| **Papel ARIA**                | `alertdialog`            | `dialog`              |

---

### **2. Estratégia de Gestão de Estado**

**MODELO DE ESTADO REATIVO:**

```typescript
// Estados adicionais no ClientDataStep.tsx
const [clientFoundData, setClientFoundData] = useState<ClientDataApiResponse['data'] | null>(null);
const [showClientConfirmDialog, setShowClientConfirmDialog] = useState(false);

// Fluxo de controle
1. Busca da API → Armazena dados no estado
2. Ativa modal → Usuário toma decisão
3. Ação confirmada → Preenche formulário + fecha modal
4. Ação cancelada → Apenas fecha modal
```

**VANTAGENS:**

- ✅ Estado reativo e controlado
- ✅ Separação clara entre dados e UI
- ✅ Fácil testabilidade
- ✅ Performance otimizada (não bloqueia thread)

---

### **3. Design do Componente**

#### **3.1 Reutilização vs. Criação**

**RECOMENDAÇÃO:** Reutilizar `ConfirmationDialog` existente com pequenos ajustes

**ANÁLISE DO COMPONENTE EXISTENTE:**

```typescript
// ConfirmationDialog já possui API completa:
interface ConfirmationDialogProps {
  isOpen: boolean; // ✅ Controle de visibilidade
  onClose: () => void; // ✅ Callback de fechamento
  onConfirm: () => void; // ✅ Callback de confirmação
  title: string; // ✅ Título customizável
  description: string; // ✅ Descrição customizável
  confirmText?: string; // ✅ Texto do botão de ação
  cancelText?: string; // ✅ Texto do botão de cancelar
  variant?: 'destructive' | 'default'; // ✅ Variante visual
  isLoading?: boolean; // ✅ Estado de carregamento
}
```

#### **3.2 Props Específicas para o Caso de Uso**

```typescript
// Configuração otimizada para nosso caso:
const clientConfirmDialogProps = {
  isOpen: showClientConfirmDialog,
  onClose: () => setShowClientConfirmDialog(false),
  onConfirm: handleUseExistingClientData,
  title: 'Cliente Encontrado',
  description: `Encontramos dados de: ${clientFoundData?.nome}\n\nDeseja preencher a proposta com os dados existentes?`,
  confirmText: 'Usar Dados',
  cancelText: 'Não Usar',
  variant: 'default' as const,
  isLoading: loadingCpfData,
};
```

#### **3.3 Conteúdo Visual Otimizado**

**TÍTULO:** "Cliente Encontrado"  
**DESCRIÇÃO:** "Encontramos dados de: **[Nome do Cliente]**\n\nDeseja preencher a proposta com os dados existentes?"  
**BOTÃO PRIMÁRIO:** "Usar Dados" (ação positiva)  
**BOTÃO SECUNDÁRIO:** "Não Usar" (ação segura - foco inicial)  
**ÍCONE:** ✅ Ícone de usuário ou checkmark para reforçar positividade

---

## 🔧 PLANO DE IMPLEMENTAÇÃO

### **4. Refatoração do ClientDataStep.tsx**

#### **4.1 Importações Adicionais**

```typescript
// ADICIONAR no topo do arquivo:
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
```

#### **4.2 Estados Adicionais**

```typescript
// ADICIONAR após os estados existentes:
const [clientFoundData, setClientFoundData] = useState<ClientDataApiResponse['data'] | null>(null);
const [showClientConfirmDialog, setShowClientConfirmDialog] = useState(false);
```

#### **4.3 Refatoração da Função fetchClientDataByCpf**

**ANTES:**

```typescript
const fetchClientDataByCpf = useCallback(
  async (cpf: string) => {
    // ... código de busca ...

    if (response && response.exists && response.data) {
      const data = response.data;

      // ❌ REMOVER: window.confirm()
      const userConfirmed = window.confirm(
        `Cliente já cadastrado!\n\nEncontramos dados de: ${data.nome}\n\nDeseja usar os dados existentes para esta nova proposta?`
      );

      if (userConfirmed) {
        updateClient({ ...dados... });
        toast({ title: 'Dados carregados!', description: '...' });
      }
    }
  },
  [updateClient, toast]
);
```

**DEPOIS:**

```typescript
const fetchClientDataByCpf = useCallback(
  async (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return;

    setLoadingCpfData(true);
    try {
      const response = (await apiRequest(`/api/clientes/cpf/${cleanCPF}`, {
        method: 'GET',
      })) as ClientDataApiResponse;

      if (response && response.exists && response.data) {
        // ✅ NOVO: Armazenar dados e abrir modal
        setClientFoundData(response.data);
        setShowClientConfirmDialog(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error);
    } finally {
      setLoadingCpfData(false);
    }
  },
  [setClientFoundData, setShowClientConfirmDialog]
);
```

#### **4.4 Nova Função de Confirmação**

```typescript
// ✅ ADICIONAR: Handler para confirmação do modal
const handleUseExistingClientData = useCallback(() => {
  if (!clientFoundData) return;

  // Mesmo código de preenchimento existente
  updateClient({
    nome: clientFoundData.nome || '',
    email: clientFoundData.email || '',
    telefone: clientFoundData.telefone || '',
    dataNascimento: clientFoundData.dataNascimento || '',
    rg: clientFoundData.rg || '',
    orgaoEmissor: clientFoundData.orgaoEmissor || '',
    rgUf: clientFoundData.rgUf || '',
    rgDataEmissao: clientFoundData.rgDataEmissao || '',
    localNascimento: clientFoundData.localNascimento || '',
    estadoCivil: clientFoundData.estadoCivil || '',
    nacionalidade: clientFoundData.nacionalidade || '',
    cep: clientFoundData.cep || '',
    logradouro: clientFoundData.logradouro || '',
    numero: clientFoundData.numero || '',
    complemento: clientFoundData.complemento || '',
    bairro: clientFoundData.bairro || '',
    cidade: clientFoundData.cidade || '',
    estado: clientFoundData.estado || '',
    ocupacao: clientFoundData.ocupacao || '',
    rendaMensal: clientFoundData.rendaMensal || '',
    telefoneEmpresa: clientFoundData.telefoneEmpresa || '',
    metodoPagamento:
      (clientFoundData.metodoPagamento as 'conta_bancaria' | 'pix') || 'conta_bancaria',
    dadosPagamentoBanco: clientFoundData.dadosPagamentoBanco || '',
    dadosPagamentoAgencia: clientFoundData.dadosPagamentoAgencia || '',
    dadosPagamentoConta: clientFoundData.dadosPagamentoConta || '',
    dadosPagamentoDigito: clientFoundData.dadosPagamentoDigito || '',
    dadosPagamentoPix: clientFoundData.dadosPagamentoPix || '',
    dadosPagamentoTipoPix: clientFoundData.dadosPagamentoTipoPix || '',
    dadosPagamentoPixBanco: clientFoundData.dadosPagamentoPixBanco || '',
    dadosPagamentoPixNomeTitular: clientFoundData.dadosPagamentoPixNomeTitular || '',
    dadosPagamentoPixCpfTitular: clientFoundData.dadosPagamentoPixCpfTitular || '',
  });

  toast({
    title: 'Dados carregados!',
    description: 'Dados do cliente preenchidos automaticamente.',
  });

  // Fechar modal e limpar dados temporários
  setShowClientConfirmDialog(false);
  setClientFoundData(null);
}, [clientFoundData, updateClient, toast]);
```

#### **4.5 Renderização do Modal**

```typescript
// ✅ ADICIONAR no final do return, antes do fechamento da div principal:
return (
  <div className="space-y-6">
    {/* ... todo o conteúdo existente ... */}

    {/* Modal de Confirmação de Cliente Encontrado */}
    <ConfirmationDialog
      isOpen={showClientConfirmDialog}
      onClose={() => {
        setShowClientConfirmDialog(false);
        setClientFoundData(null);
      }}
      onConfirm={handleUseExistingClientData}
      title="Cliente Encontrado"
      description={`Encontramos dados de: ${clientFoundData?.nome || 'Cliente'}\n\nDeseja preencher a proposta com os dados existentes?`}
      confirmText="Usar Dados"
      cancelText="Não Usar"
      variant="default"
      isLoading={loadingCpfData}
    />
  </div>
);
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Fase 1: Preparação**

- [ ] ✅ Verificar que `ConfirmationDialog` está disponível
- [ ] ✅ Confirmar imports do `@/components/ui/alert-dialog`
- [ ] 🔍 Analisar se há conflitos de estado existentes

### **Fase 2: Refatoração**

- [ ] 🔧 Adicionar estados `clientFoundData` e `showClientConfirmDialog`
- [ ] 🔧 Refatorar função `fetchClientDataByCpf`
- [ ] 🔧 Implementar `handleUseExistingClientData`
- [ ] 🔧 Adicionar renderização do `ConfirmationDialog`

### **Fase 3: Testes**

- [ ] 🧪 Testar fluxo completo com CPF demo (12345678901)
- [ ] 🧪 Testar cancelamento do modal
- [ ] 🧪 Verificar responsividade em mobile
- [ ] 🧪 Validar acessibilidade (navegação por teclado)

### **Fase 4: Polimento**

- [ ] 🎨 Ajustar textos se necessário
- [ ] 🎨 Considerar ícones adicionais (User, CheckCircle)
- [ ] 📝 Atualizar documentação/comentários
- [ ] 🔍 Code review e otimização

---

## 🎯 BENEFÍCIOS ESPERADOS

### **Experiência do Usuário**

- ✅ **Interface Consistente:** Alinhada com design system da aplicação
- ✅ **Acessibilidade Aprimorada:** Navegação por teclado, ARIA labels
- ✅ **Responsividade:** Funciona perfeitamente em desktop e mobile
- ✅ **Feedback Visual:** Estados de loading e transições suaves

### **Experiência do Desenvolvedor**

- ✅ **Manutenibilidade:** Código mais limpo e organizando
- ✅ **Testabilidade:** Estados controláveis e isolados
- ✅ **Reutilização:** Aproveita componente existente
- ✅ **Typing:** TypeScript robusto com tipos bem definidos

### **Performance**

- ✅ **Não-Bloqueante:** Remove bloqueio do thread principal
- ✅ **Otimizada:** Re-renders controlados via React state
- ✅ **Memória:** Estados temporários são limpos adequadamente

---

## 🚨 CONSIDERAÇÕES DE SEGURANÇA

### **Dados Sensíveis**

- ✅ **Mascaramento PII:** Dados já vêm mascarados da API
- ✅ **Estado Temporário:** `clientFoundData` é limpo após uso
- ✅ **Não Persistência:** Modal não persiste dados between sessions

### **Acessibilidade**

- ✅ **Focus Management:** AlertDialog gerencia foco automaticamente
- ✅ **Screen Readers:** ARIA labels e descriptions nativas
- ✅ **Keyboard Navigation:** ESC fecha, Tab navega, Enter confirma

---

## 📊 MÉTRICAS DE SUCESSO

### **Quantitativas**

- 🎯 **Zero regressões** no fluxo de preenchimento existente
- 🎯 **100% responsividade** em dispositivos mobile/tablet/desktop
- 🎯 **Acessibilidade** WCAG 2.1 AA compliance

### **Qualitativas**

- 🎯 **UX profissional** alinhada com padrões bancários
- 🎯 **Código maintível** seguindo patterns da aplicação
- 🎯 **Performance** sem degradação perceptível

---

## 🔮 EXTENSÕES FUTURAS

### **Curto Prazo (Opcional)**

- 💡 **Ícones Contextuais:** User icon, CheckCircle para reforçar positività
- 💡 **Animações Suaves:** Micro-interactions para melhor feedback
- 💡 **Preset Messages:** Templates de mensagem baseados no tipo de cliente

### **Médio Prazo (Roadmap)**

- 💡 **Preview de Dados:** Mostrar resumo dos dados no modal antes de confirmar
- 💡 **Histórico:** "Este cliente tem X propostas anteriores"
- 💡 **Campos Seletivos:** Permitir escolher quais campos preencher

---

**ASSINATURA DIGITAL:** PAM V1.0 ✓ DECD V1.0 ✓ CONTEXTO V2.0 ✓  
**BLUEPRINT APROVADO:** 2025-09-03 00:35:00 UTC

---

_Este blueprint está pronto para implementação seguindo as práticas de engenharia estabelecidas no projeto Simpix._
