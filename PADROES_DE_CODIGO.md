# 📋 Padrões de Código - Sistema Simpix

## 🎯 Diretrizes Obrigatórias de Desenvolvimento

### **NOVA REGRA MANDATÓRIA: Criação de Páginas**

**Para criar qualquer nova página no sistema, o desenvolvedor deve obrigatoriamente:**

1. **Copiar o template base**: `cp client/src/pages/_template.tsx client/src/pages/nova-pagina.tsx`
2. **Renomear o componente**: `MinhaNovaPageTemplate` → `MinhaNovaPagina`
3. **Jamais criar páginas do zero** - isto garante a consistência do layout

### **Por que esta regra existe?**

Esta regra foi criada para resolver um problema crítico recorrente: **páginas criadas do zero não incluem o menu lateral**, quebrando a consistência da interface e tornando a navegação inutilizável.

### **Estrutura Correta de uma Página**

```tsx
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MinhaPagina() {
  return (
    <DashboardLayout title="Título da Página">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Título da Seção</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Seu conteúdo aqui */}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

### **❌ Estrutura INCORRETA (Proibida)**

```tsx
// NUNCA faça isto - causa perda do menu lateral
export default function MinhaPagina() {
  return (
    <div className="container mx-auto py-8">
      {/* conteúdo sem DashboardLayout */}
    </div>
  );
}
```

### **✅ Como Validar se está Correto**

1. Ao navegar para a nova página, o **menu lateral deve estar sempre visível**
2. A página deve seguir o padrão visual consistente do sistema
3. Todos os estados (loading, erro, vazio) devem estar dentro do `DashboardLayout`

### **📁 Arquivo de Referência**

- **Template padrão**: `client/src/pages/_template.tsx`
- **Exemplo funcional**: `client/src/pages/dashboard.tsx`
- **Exemplo corrigido**: `client/src/pages/GestaoContratos.tsx`

---

## 🔧 Outras Diretrizes de Código

### **Estrutura de Componentes**
- Use sempre componentes shadcn/ui quando disponíveis
- Mantenha consistência visual com `Card`, `CardHeader`, `CardContent`
- Implemente estados de loading, erro e vazio

### **Gerenciamento de Estado**
- Use TanStack Query para dados do servidor
- Implemente cache adequado com `staleTime` e `refetchInterval`
- Use loading states com `isLoading` e skeletons

### **Controle de Acesso**
- Sempre verifique permissões com `user?.role`
- Implemente mensagens de "Acesso Negado" dentro do layout
- Use redirecionamentos adequados para usuários não autorizados

### **Qualidade de Código**
- Execute `npx lint-staged` antes de commits
- Siga as regras do ESLint configurado no projeto
- Use nomes de variáveis e funções descritivos em português

---

**⚠️ IMPORTANTE**: Esta documentação deve ser consultada sempre que surgirem dúvidas sobre padrões de desenvolvimento. Atualize-a conforme necessário para manter os padrões atualizados.