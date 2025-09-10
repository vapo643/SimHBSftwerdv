import React from 'react';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ProposalProvider,
  useProposal,
  useProposalActions,
  useStepValidation,
} from '@/contexts/ProposalContext';
import { useProposalEffects } from '@/hooks/useProposalEffects';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  Users,
} from 'lucide-react';
import { ClientDataStep } from '@/components/propostas/ClientDataStep';
import { LoanConditionsStep } from '@/components/propostas/LoanConditionsStep';
import { DocumentsStep } from '@/components/propostas/DocumentsStep';
import { PersonalReferencesStep } from '@/components/propostas/PersonalReferencesStep';
import { ProposalProgressIndicator } from '@/components/ProposalProgressIndicator';

// Component that uses the ProposalContext
function ProposalForm() {
  const { state } = useProposal();
  const { setContext, setStep, setLoading } = useProposalActions();
  const { isStepValid } = useStepValidation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Apply proposal effects (auto-simulation, validation, etc.)
  useProposalEffects();

  // Load origination context on mount
  const {
    isLoading: loadingContext,
    error: contextError,
    data: contextData,
  } = useQuery({
    queryKey: ['/api/origination/context'],
    queryFn: async () => {
      const response = await apiRequest('/api/origination/context', {
        method: 'GET',
      });
      return response;
    },
  });

  // Handle context data
  React.useEffect(() => {
    if (contextData) {
      setContext(contextData as any); // Fix LSP error
      setLoading(false);
    }
  }, [contextData]); // Removed unstable functions from dependencies

  // Handle errors
  React.useEffect(() => {
    if (contextError) {
      console.error('Erro ao carregar contexto:', contextError);
      toast({
        title: 'Erro ao carregar dados',
        description:
          'Não foi possível carregar os dados necessários. Por favor, recarregue a página.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [contextError, toast]); // Removed setLoading from dependencies

  // Submit mutation
  const submitProposal = useMutation({
    mutationFn: async () => {
      // NOVO FLUXO: Criar proposta primeiro, depois upload com ID real
      // 1. PRIMEIRO: Criar a proposta sem documentos
      const proposalData = {
        // ===== TIPO DE PESSOA E DADOS BÁSICOS =====
        tipoPessoa: state.clientData.tipoPessoa, // PF ou PJ

        // Dados Pessoa Física
        clienteNome: state.clientData.nome,
        clienteCpf: state.clientData.cpf,

        // Dados Pessoa Jurídica (quando aplicável)
        clienteRazaoSocial: state.clientData.razaoSocial || null,
        clienteCnpj: state.clientData.cnpj || null,

        // ===== DOCUMENTAÇÃO COMPLETA (RG) =====
        clienteRg: state.clientData.rg,
        clienteOrgaoEmissor: state.clientData.orgaoEmissor,
        clienteRgUf: state.clientData.rgUf, // NOVO: UF de emissão do RG
        clienteRgDataEmissao: state.clientData.rgDataEmissao, // NOVO: Data de emissão do RG

        // ===== DADOS PESSOAIS =====
        clienteEmail: state.clientData.email,
        clienteTelefone: state.clientData.telefone,
        clienteDataNascimento: state.clientData.dataNascimento,
        clienteLocalNascimento: state.clientData.localNascimento, // NOVO: Local de nascimento
        clienteEstadoCivil: state.clientData.estadoCivil,
        clienteNacionalidade: state.clientData.nacionalidade,

        // ===== ENDEREÇO DETALHADO =====
        clienteCep: state.clientData.cep,
        clienteLogradouro: state.clientData.logradouro, // NOVO: Rua/Avenida separado
        clienteNumero: state.clientData.numero, // NOVO: Número do imóvel
        clienteComplemento: state.clientData.complemento, // NOVO: Complemento
        clienteBairro: state.clientData.bairro, // NOVO: Bairro
        clienteCidade: state.clientData.cidade, // NOVO: Cidade
        clienteUf: state.clientData.estado, // NOVO: Estado/UF

        // Manter endereço concatenado para compatibilidade
        clienteEndereco:
          `${state.clientData.logradouro || ''}, ${state.clientData.numero || ''}${state.clientData.complemento ? ', ' + state.clientData.complemento : ''}, ${state.clientData.bairro || ''}, ${state.clientData.cidade || ''}/${state.clientData.estado || ''} - CEP: ${state.clientData.cep || ''}`.trim(),

        // ===== DADOS PROFISSIONAIS =====
        clienteOcupacao: state.clientData.ocupacao,
        clienteRenda: state.clientData.rendaMensal,
        clienteTelefoneEmpresa: state.clientData.telefoneEmpresa,

        // ===== MÉTODO DE PAGAMENTO =====
        metodoPagamento: state.clientData.metodoPagamento, // 'conta_bancaria' ou 'pix'

        // Dados bancários (quando conta_bancaria)
        dadosPagamentoBanco: state.clientData.dadosPagamentoBanco || null,
        dadosPagamentoAgencia: state.clientData.dadosPagamentoAgencia || null,
        dadosPagamentoConta: state.clientData.dadosPagamentoConta || null,
        dadosPagamentoDigito: state.clientData.dadosPagamentoDigito || null,

        // Dados PIX (quando pix)
        dadosPagamentoPix: state.clientData.dadosPagamentoPix || null, // Chave PIX
        dadosPagamentoTipoPix: state.clientData.dadosPagamentoTipoPix || null, // Tipo da chave
        dadosPagamentoPixBanco: state.clientData.dadosPagamentoPixBanco || null,
        dadosPagamentoPixNomeTitular: state.clientData.dadosPagamentoPixNomeTitular || null,
        dadosPagamentoPixCpfTitular: state.clientData.dadosPagamentoPixCpfTitular || null,

        // ===== REFERÊNCIAS PESSOAIS =====
        referenciaPessoal: state.personalReferences,

        // ===== DADOS DO EMPRÉSTIMO =====
        produtoId: state.loanData.produtoId,
        tabelaComercialId: state.loanData.tabelaComercialId,
        valor: parseFloat(state.loanData.valorSolicitado.replace(/[^\d,]/g, '').replace(',', '.')),
        prazo: state.loanData.prazo,

        // Valores calculados da simulação
        valorTac: state.simulation?.valorTAC ? parseFloat(state.simulation.valorTAC) : 0,
        valorIof: state.simulation?.valorIOF ? parseFloat(state.simulation.valorIOF) : 0,
        valorTotalFinanciado: state.simulation?.valorTotalFinanciado
          ? parseFloat(state.simulation.valorTotalFinanciado)
          : 0,

        // Data de carência (se houver)
        dataCarencia: state.loanData.dataCarencia || null,
        incluirTac: state.loanData.incluirTac,

        // ===== DADOS ADMINISTRATIVOS =====
        status: 'aguardando_analise',
        lojaId: state.context?.atendente?.loja?.id,
        finalidade: 'Empréstimo pessoal',
        garantia: 'Sem garantia',

        // 🎯 CORREÇÃO: Enviar direto para análise em vez de rascunho
        submitForAnalysis: true,

        // ===== CAMPOS OPCIONAIS PARA CCB =====
        // Estes podem ser preenchidos posteriormente ou com valores padrão
        formaLiberacao: 'deposito', // Como será liberado: deposito, ted, pix
        formaPagamento: 'boleto', // Como cliente pagará: boleto, pix, debito
        pracaPagamento: 'São Paulo', // Cidade de pagamento
      };

      console.log(`[DEBUG] Criando proposta primeiro...`);
      const propostaResponse = await apiRequest('/api/propostas', {
        method: 'POST',
        body: proposalData,
      });

      // --- INÍCIO DO BLOCO DE DIAGNÓSTICO OBRIGATÓRIO ---
      console.log('--- DIAGNÓSTICO DE ALERTA VERMELHO ---');
      console.log('TIPO DO OBJETO propostaResponse:', typeof propostaResponse);
      console.log('CONTEÚDO BRUTO DO propostaResponse:', JSON.stringify(propostaResponse, null, 2));
      console.log('CHAVES DISPONÍVEIS NO OBJETO:', Object.keys(propostaResponse as any));
      console.log('--- FIM DO DIAGNÓSTICO ---');
      // --- FIM DO BLOCO DE DIAGNÓSTICO OBRIGATÓRIO ---

      const propostaId = (propostaResponse as any).proposalId;
      console.log(`[DEBUG] Proposta criada com ID: ${propostaId}`);

      // 2. SEGUNDO: Upload dos documentos com ID real da proposta
      const uploadedDocuments: string[] = [];

      if (state.documents.length > 0) {
        console.log(
          `[DEBUG] Iniciando upload de ${state.documents.length} documentos para proposta ${propostaId}`
        );

        for (const doc of state.documents) {
          try {
            const timestamp = Date.now();
            const fileName = `${timestamp}-${doc.name}`;

            // Upload usando apiRequest com FormData
            const formData = new FormData();
            formData.append('file', doc.file);
            formData.append('filename', fileName);
            formData.append('proposalId', propostaId); // Usar ID real da proposta

            const uploadResponse = await apiRequest('/api/upload', {
              method: 'POST',
              body: formData,
            });

            console.log(`[DEBUG] Documento ${doc.name} enviado com sucesso:`, uploadResponse);
            uploadedDocuments.push(fileName);
          } catch (uploadError) {
            console.error(`[ERROR] Falha ao enviar documento ${doc.name}:`, uploadError);
            throw new Error(`Falha ao enviar documento ${doc.name}. Tente novamente.`);
          }
        }

        console.log(`[DEBUG] Todos os ${uploadedDocuments.length} documentos enviados com sucesso`);

        // 3. TERCEIRO: Associar documentos na proposta via API específica
        if (uploadedDocuments.length > 0) {
          try {
            await apiRequest(`/api/propostas/${propostaId}/documentos`, {
              method: 'POST',
              body: { documentos: uploadedDocuments },
            });
            console.log(
              `[DEBUG] ${uploadedDocuments.length} documentos associados à proposta ${propostaId}`
            );
          } catch (associationError) {
            console.error(`[ERROR] Falha ao associar documentos:`, associationError);
            // Não falhar a operação, documentos já estão no storage
          }
        }
      }

      return propostaResponse;
    },
    onSuccess: (data) => {
      toast({
        title: 'Proposta criada com sucesso!',
        description: `Proposta ${(data as any).id} foi encaminhada para análise com ${state.documents.length} documento(s) anexado(s).`,
      });

      // Limpar documentos após sucesso
      if (state.context) {
        setContext(state.context);
      }
      setStep(0);
      
      // Redirecionar automaticamente para o dashboard
      setLocation('/dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar proposta',
        description:
          error instanceof Error ? error.message : 'Ocorreu um erro ao criar a proposta.',
        variant: 'destructive',
      });
    },
  });

  if (loadingContext || state.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
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
      'referencias-pessoais': 1,
      'condicoes-emprestimo': 2,
      'anexo-documentos': 3,
    };
    setStep(stepMap[value] || 0);
  };

  const currentTabValue = [
    'dados-cliente',
    'referencias-pessoais',
    'condicoes-emprestimo',
    'anexo-documentos',
  ][state.currentStep];

  return (
    <div className="w-full">
      {/* UX-005: Indicador de progresso visual */}
      <ProposalProgressIndicator currentStep={state.currentStep} totalSteps={4} />

      <Tabs value={currentTabValue} onValueChange={handleStepChange} className="w-full">
        {/* TabsList mantida para funcionalidade, mas visualmente oculta */}
        <TabsList className="hidden">
          <TabsTrigger value="dados-cliente">
            <User className="mr-2 h-4 w-4" />
            Dados do Cliente
          </TabsTrigger>
          <TabsTrigger value="referencias-pessoais">
            <Users className="mr-2 h-4 w-4" />
            Referências
          </TabsTrigger>
          <TabsTrigger value="condicoes-emprestimo">
            <DollarSign className="mr-2 h-4 w-4" />
            Empréstimo
          </TabsTrigger>
          <TabsTrigger value="anexo-documentos">
            <FileText className="mr-2 h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="dados-cliente">
            <ClientDataStep />
          </TabsContent>

          <TabsContent value="referencias-pessoais">
            <PersonalReferencesStep />
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
            data-testid="button-voltar"
          >
            Voltar
          </Button>

          {state.currentStep < 3 ? (
            <Button
              type="button"
              onClick={() => setStep(state.currentStep + 1)}
              data-testid="button-proximo"
            >
              Próximo
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => submitProposal.mutate()}
              disabled={submitProposal.isPending}
              className="min-w-[200px]"
            >
              {submitProposal.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {state.documents.length > 0
                    ? `Enviando ${state.documents.length} documentos...`
                    : 'Criando proposta...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Enviar Proposta
                  {state.documents.length > 0 && (
                    <span className="ml-2 rounded-full bg-green-600 px-2 py-1 text-xs">
                      {state.documents.length} doc(s)
                    </span>
                  )}
                </>
              )}
            </Button>
          )}
        </div>
      </Tabs>
    </div>
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
