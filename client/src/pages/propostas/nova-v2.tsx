import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useProposal, ProposalProvider } from "@/contexts/ProposalContext";
import { useProposalEffects } from "@/hooks/useProposalEffects";
import { documentUploadService } from "@/services/documentUpload";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Upload, X, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CurrencyInput } from "@/components/ui/currency-input";

// Main component wrapped with ProposalProvider
export default function NovaPropostaPage() {
  return (
    <ProposalProvider>
      <NovaPropostaContent />
    </ProposalProvider>
  );
}

function NovaPropostaContent() {
  const { state, dispatch } = useProposal();
  const effects = useProposalEffects({ state, dispatch });
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Tab navigation based on current step
  const handleTabChange = (value: string) => {
    dispatch({ type: 'SET_STEP', payload: value as any });
  };

  // Submission mutation
  const submitProposal = useMutation({
    mutationFn: async () => {
      // Validate all steps
      if (!effects.validateClientData()) {
        dispatch({ type: 'SET_STEP', payload: 'client' });
        throw new Error('Por favor, preencha todos os dados do cliente');
      }
      
      if (!effects.validateLoanData()) {
        dispatch({ type: 'SET_STEP', payload: 'loan' });
        throw new Error('Por favor, preencha todos os dados do empréstimo');
      }
      
      if (!effects.validateDocuments()) {
        dispatch({ type: 'SET_STEP', payload: 'documents' });
        throw new Error('Por favor, anexe todos os documentos obrigatórios');
      }

      // Create proposal with documents
      const proposal = await documentUploadService.createProposal({
        clientData: state.clientData,
        loanData: state.loanData,
        documents: state.documents,
      });

      // Upload documents in background
      if (state.documents.length > 0) {
        documentUploadService.uploadDocuments(proposal.id, state.documents)
          .then(results => {
            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
              toast({
                title: "Alguns documentos falharam no upload",
                description: "A proposta foi criada, mas alguns documentos precisam ser re-enviados.",
                variant: "destructive",
              });
            }
          });
      }

      return proposal;
    },
    onSuccess: () => {
      toast({
        title: "Proposta criada com sucesso!",
        description: "A proposta foi enviada para análise.",
      });
      dispatch({ type: 'RESET' });
      setLocation("/propostas");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Loading state while context is loading
  if (!state.context) {
    return (
      <DashboardLayout title="Nova Proposta de Crédito">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Nova Proposta de Crédito">
      <div className="max-w-4xl mx-auto">
        {/* Header with context info */}
        <div className="mb-6 p-4 bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Atendente: {state.context.atendente.nome}</p>
              <p className="text-sm text-gray-400">Loja: {state.context.atendente.loja.nome} ({state.context.atendente.loja.parceiro.nome})</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">
                Valor: R$ {state.context.limites.valorMinimo.toLocaleString()} - R$ {state.context.limites.valorMaximo.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">Prazo máximo: {state.context.limites.prazoMaximo} meses</p>
            </div>
          </div>
        </div>

        <Tabs value={state.currentStep} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="client">Dados do Cliente</TabsTrigger>
            <TabsTrigger value="loan" disabled={!state.clientData.nome}>Condições do Empréstimo</TabsTrigger>
            <TabsTrigger value="documents" disabled={!state.loanData.produtoId}>Documentos</TabsTrigger>
          </TabsList>

          {/* Client Data Tab */}
          <TabsContent value="client">
            <ClientDataForm />
          </TabsContent>

          {/* Loan Conditions Tab */}
          <TabsContent value="loan">
            <LoanDataForm />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <DocumentsForm />
          </TabsContent>
        </Tabs>

        {/* Submit button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => submitProposal.mutate()}
            disabled={submitProposal.isPending}
            className="btn-simpix-accent"
          >
            {submitProposal.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Proposta"
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Client Data Form Component
function ClientDataForm() {
  const { state, dispatch } = useProposal();
  const { clientData, errors } = state;

  const handleChange = (field: keyof typeof clientData, value: string | number) => {
    dispatch({ type: 'UPDATE_CLIENT', payload: { [field]: value } });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={clientData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              className={errors.nome ? 'border-red-500' : ''}
            />
            {errors.nome && <p className="text-sm text-red-500 mt-1">{errors.nome}</p>}
          </div>

          <div>
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              value={clientData.cpf}
              onChange={(e) => handleChange('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className={errors.cpf ? 'border-red-500' : ''}
            />
            {errors.cpf && <p className="text-sm text-red-500 mt-1">{errors.cpf}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={clientData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
            <Input
              id="telefone"
              value={clientData.telefone}
              onChange={(e) => handleChange('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              className={errors.telefone ? 'border-red-500' : ''}
            />
            {errors.telefone && <p className="text-sm text-red-500 mt-1">{errors.telefone}</p>}
          </div>

          <div>
            <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={clientData.dataNascimento}
              onChange={(e) => handleChange('dataNascimento', e.target.value)}
              className={errors.dataNascimento ? 'border-red-500' : ''}
            />
            {errors.dataNascimento && <p className="text-sm text-red-500 mt-1">{errors.dataNascimento}</p>}
          </div>

          <div>
            <Label htmlFor="renda">Renda Mensal *</Label>
            <CurrencyInput
              value={clientData.renda}
              onChange={(e) => handleChange('renda', e.target.value)}
              className={errors.renda ? 'border-red-500' : ''}
            />
            {errors.renda && <p className="text-sm text-red-500 mt-1">{errors.renda}</p>}
          </div>

          <div>
            <Label htmlFor="rg">RG *</Label>
            <Input
              id="rg"
              value={clientData.rg}
              onChange={(e) => handleChange('rg', e.target.value)}
              className={errors.rg ? 'border-red-500' : ''}
            />
            {errors.rg && <p className="text-sm text-red-500 mt-1">{errors.rg}</p>}
          </div>

          <div>
            <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
            <Input
              id="orgaoEmissor"
              value={clientData.orgaoEmissor}
              onChange={(e) => handleChange('orgaoEmissor', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="estadoCivil">Estado Civil</Label>
            <Select value={clientData.estadoCivil} onValueChange={(value) => handleChange('estadoCivil', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="uniao_estavel">União Estável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nacionalidade">Nacionalidade</Label>
            <Input
              id="nacionalidade"
              value={clientData.nacionalidade}
              onChange={(e) => handleChange('nacionalidade', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="cep">CEP *</Label>
            <Input
              id="cep"
              value={clientData.cep}
              onChange={(e) => handleChange('cep', e.target.value)}
              placeholder="00000-000"
              className={errors.cep ? 'border-red-500' : ''}
            />
            {errors.cep && <p className="text-sm text-red-500 mt-1">{errors.cep}</p>}
          </div>

          <div>
            <Label htmlFor="ocupacao">Ocupação/Profissão</Label>
            <Input
              id="ocupacao"
              value={clientData.ocupacao}
              onChange={(e) => handleChange('ocupacao', e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="endereco">Endereço Completo *</Label>
          <Textarea
            id="endereco"
            value={clientData.endereco}
            onChange={(e) => handleChange('endereco', e.target.value)}
            rows={3}
            className={errors.endereco ? 'border-red-500' : ''}
          />
          {errors.endereco && <p className="text-sm text-red-500 mt-1">{errors.endereco}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// Loan Data Form Component
function LoanDataForm() {
  const { state, dispatch } = useProposal();
  const effects = useProposalEffects({ state, dispatch });
  const { loanData, simulation, errors } = state;

  const handleChange = (field: keyof typeof loanData, value: any) => {
    dispatch({ type: 'UPDATE_LOAN', payload: { [field]: value } });
  };

  const handleProductChange = (productId: string) => {
    dispatch({ type: 'SELECT_PRODUCT', payload: parseInt(productId) });
  };

  const handleTabelaChange = (tabelaId: string) => {
    dispatch({ type: 'SELECT_TABELA', payload: parseInt(tabelaId) });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="produto">Produto *</Label>
            <Select 
              value={loanData.produtoId?.toString() || ''} 
              onValueChange={handleProductChange}
            >
              <SelectTrigger className={errors.produtoId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {state.context?.produtos.map((produto) => (
                  <SelectItem key={produto.id} value={produto.id.toString()}>
                    {produto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.produtoId && <p className="text-sm text-red-500 mt-1">{errors.produtoId}</p>}
          </div>

          <div>
            <Label htmlFor="tabela">Tabela Comercial *</Label>
            <Select 
              value={loanData.tabelaComercialId?.toString() || ''} 
              onValueChange={handleTabelaChange}
              disabled={!loanData.produtoId}
            >
              <SelectTrigger className={errors.tabelaComercialId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecione uma tabela" />
              </SelectTrigger>
              <SelectContent>
                {effects.tabelasDisponiveis.map((tabela) => (
                  <SelectItem key={tabela.id} value={tabela.id.toString()}>
                    {tabela.nome} - {tabela.taxaJuros}% a.m.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tabelaComercialId && <p className="text-sm text-red-500 mt-1">{errors.tabelaComercialId}</p>}
          </div>

          <div>
            <Label htmlFor="valor">Valor Solicitado *</Label>
            <CurrencyInput
              value={loanData.valor.toString()}
              onChange={(e) => handleChange('valor', parseFloat(e.target.value) || 0)}
              className={errors.valor ? 'border-red-500' : ''}
            />
            {errors.valor && <p className="text-sm text-red-500 mt-1">{errors.valor}</p>}
          </div>

          <div>
            <Label htmlFor="prazo">Prazo (meses) *</Label>
            <Select 
              value={loanData.prazo.toString()} 
              onValueChange={(value) => handleChange('prazo', parseInt(value))}
              disabled={!effects.selectedTabela}
            >
              <SelectTrigger className={errors.prazo ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecione o prazo" />
              </SelectTrigger>
              <SelectContent>
                {effects.prazosDisponiveis.map((prazo) => (
                  <SelectItem key={prazo} value={prazo.toString()}>
                    {prazo} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.prazo && <p className="text-sm text-red-500 mt-1">{errors.prazo}</p>}
          </div>

          <div>
            <Label htmlFor="finalidade">Finalidade do Empréstimo *</Label>
            <Input
              id="finalidade"
              value={loanData.finalidade}
              onChange={(e) => handleChange('finalidade', e.target.value)}
              placeholder="Ex: Capital de giro, reforma, etc."
              className={errors.finalidade ? 'border-red-500' : ''}
            />
            {errors.finalidade && <p className="text-sm text-red-500 mt-1">{errors.finalidade}</p>}
          </div>

          <div>
            <Label htmlFor="garantia">Garantias *</Label>
            <Input
              id="garantia"
              value={loanData.garantia}
              onChange={(e) => handleChange('garantia', e.target.value)}
              placeholder="Ex: Imóvel, veículo, avalista"
              className={errors.garantia ? 'border-red-500' : ''}
            />
            {errors.garantia && <p className="text-sm text-red-500 mt-1">{errors.garantia}</p>}
          </div>

          <div>
            <Label htmlFor="dataVencimento">Data 1º Vencimento *</Label>
            <Input
              id="dataVencimento"
              type="date"
              value={loanData.dataVencimento}
              onChange={(e) => handleChange('dataVencimento', e.target.value)}
              className={errors.dataVencimento ? 'border-red-500' : ''}
            />
            {errors.dataVencimento && <p className="text-sm text-red-500 mt-1">{errors.dataVencimento}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluirTac"
              checked={loanData.incluirTac}
              onCheckedChange={(checked) => handleChange('incluirTac', checked)}
            />
            <Label htmlFor="incluirTac" className="cursor-pointer">
              Incluir TAC
              {effects.selectedProduct && (
                <span className="text-sm text-gray-400 ml-2">
                  ({effects.selectedProduct.tacTipo === 'fixo' 
                    ? `R$ ${effects.selectedProduct.tacValor}` 
                    : `${effects.selectedProduct.tacValor}%`})
                </span>
              )}
            </Label>
          </div>
        </div>

        {/* Simulation Results */}
        {simulation && (
          <div className="mt-6 p-4 bg-gray-900 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Resumo da Simulação</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Valor da Parcela</p>
                <p className="text-xl font-bold">R$ {simulation.valorParcela.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Taxa de Juros</p>
                <p className="text-xl font-bold">{simulation.taxaJurosMensal}% a.m.</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">IOF</p>
                <p className="text-xl font-bold">R$ {simulation.iof.toFixed(2)}</p>
              </div>
              {loanData.incluirTac && (
                <div>
                  <p className="text-sm text-gray-400">TAC</p>
                  <p className="text-xl font-bold">R$ {simulation.valorTac.toFixed(2)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-400">CET Anual</p>
                <p className="text-xl font-bold">{simulation.cet}%</p>
              </div>
            </div>
          </div>
        )}

        {effects.isSimulating && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Calculando simulação...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Documents Form Component
function DocumentsForm() {
  const { state, dispatch } = useProposal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const validation = documentUploadService.validateFile(file);
      if (!validation.valid) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: { field: 'documents', message: validation.error! } 
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        dispatch({
          type: 'ADD_DOCUMENT',
          payload: {
            file,
            preview: e.target?.result as string,
            status: 'pending',
            uploadId: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        });
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeDocument = (uploadId: string) => {
    dispatch({ type: 'REMOVE_DOCUMENT', payload: uploadId });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Documentos Obrigatórios</h3>
          <ul className="list-disc list-inside text-sm text-gray-400 mb-4">
            {state.context?.documentosObrigatorios.map((doc, index) => (
              <li key={index}>{doc}</li>
            ))}
          </ul>
        </div>

        {state.errors.documents && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.errors.documents}</AlertDescription>
          </Alert>
        )}

        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-400 mb-2">Arraste arquivos aqui ou</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar Arquivos
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            PDF, JPG, PNG, DOC, DOCX (máx. 10MB cada)
          </p>
        </div>

        {/* Document List */}
        {state.documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Documentos Anexados</h4>
            {state.documents.map((doc) => (
              <div
                key={doc.uploadId}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">{doc.file.name}</p>
                    <p className="text-xs text-gray-400">
                      {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {doc.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {doc.status === 'uploaded' && (
                    <span className="text-green-500 text-sm">✓</span>
                  )}
                  {doc.status === 'failed' && (
                    <span className="text-red-500 text-sm">✗</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.uploadId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}