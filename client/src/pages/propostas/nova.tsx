import React, { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ProposalProvider, useProposal, useProposalActions } from "@/contexts/ProposalContext";
import { useProposalEffects } from "@/hooks/useProposalEffects";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CalendarDays, 
  DollarSign, 
  FileText, 
  Upload, 
  X, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  User
} from "lucide-react";
import { ClientDataStep } from "@/components/propostas/ClientDataStep";
import { LoanConditionsStep } from "@/components/propostas/LoanConditionsStep";
import { DocumentsStep } from "@/components/propostas/DocumentsStep";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Component that uses the ProposalContext
function ProposalForm() {
  const { state } = useProposal();
  const { setContext, setStep, setLoading } = useProposalActions();
  const { toast } = useToast();

  // Apply proposal effects (auto-simulation, validation, etc.)
  useProposalEffects();

  // Load origination context on mount
  const { isLoading: loadingContext, error: contextError, data: contextData } = useQuery({
    queryKey: ['/api/origination/context'],
    queryFn: async () => {
      const response = await apiRequest('/api/origination/context', {
        method: 'GET'
      });
      return response;
    }
  });

  // Handle context data
  React.useEffect(() => {
    if (contextData) {
      setContext(contextData);
      setLoading(false);
    }
  }, [contextData, setContext, setLoading]);

  // Handle errors
  React.useEffect(() => {
    if (contextError) {
      console.error('Erro ao carregar contexto:', contextError);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados necessários. Por favor, recarregue a página.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [contextError, toast, setLoading]);

  // Submit mutation
  const submitProposal = useMutation({
    mutationFn: async () => {
      // Prepare proposal data
      const proposalData = {
        clientData: state.clientData,
        loanData: state.loanData,
        documents: state.documents.map(doc => ({
          name: doc.name,
          type: doc.type,
          size: doc.size,
        })),
      };

      const response = await apiRequest('/api/propostas', {
        method: 'POST',
        body: JSON.stringify(proposalData),
      });

      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Proposta criada com sucesso!',
        description: 'A proposta foi encaminhada para análise.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar proposta',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao criar a proposta.',
        variant: 'destructive',
      });
    },
  });

  if (loadingContext || state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (contextError || !state.context) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar dados necessários. Por favor, recarregue a página.
        </AlertDescription>
      </Alert>
    );
  }

  const handleStepChange = (value: string) => {
    const stepMap: Record<string, number> = {
      'dados-cliente': 0,
      'condicoes-emprestimo': 1,
      'anexo-documentos': 2,
    };
    setStep(stepMap[value] || 0);
  };

  const currentTabValue = ['dados-cliente', 'condicoes-emprestimo', 'anexo-documentos'][state.currentStep];

  return (
    <Tabs value={currentTabValue} onValueChange={handleStepChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="dados-cliente">
          <User className="h-4 w-4 mr-2" />
          Dados do Cliente
        </TabsTrigger>
        <TabsTrigger value="condicoes-emprestimo">
          <DollarSign className="h-4 w-4 mr-2" />
          Condições do Empréstimo
        </TabsTrigger>
        <TabsTrigger value="anexo-documentos">
          <FileText className="h-4 w-4 mr-2" />
          Anexo de Documentos
        </TabsTrigger>
      </TabsList>

      <div className="mt-6">
        <TabsContent value="dados-cliente">
          <ClientDataStep />
        </TabsContent>

        <TabsContent value="condicoes-emprestimo">
          <LoanConditionsStep />
        </TabsContent>

        <TabsContent value="anexo-documentos">
          <DocumentsStep />
        </TabsContent>
      </div>

      <div className="mt-8 flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(Math.max(0, state.currentStep - 1))}
          disabled={state.currentStep === 0}
        >
          Voltar
        </Button>

        {state.currentStep < 2 ? (
          <Button
            type="button"
            onClick={() => setStep(state.currentStep + 1)}
          >
            Próximo
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submitProposal.mutate()}
            disabled={submitProposal.isPending || state.documents.length === 0}
          >
            {submitProposal.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Proposta'
            )}
          </Button>
        )}
      </div>
    </Tabs>
  );
}

// Main component that wraps everything with ProposalProvider
const NovaProposta: React.FC = () => {
  return (
    <ProposalProvider>
      <DashboardLayout title="Nova Proposta de Crédito">
        <ProposalForm />
      </DashboardLayout>
    </ProposalProvider>
  );
};

export default NovaProposta;
