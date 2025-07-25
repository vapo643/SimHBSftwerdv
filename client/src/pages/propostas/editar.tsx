import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchWithToken } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/ui/CurrencyInput";

// Componente separado para documentos
const DocumentsTab: React.FC<{ propostaId: string }> = ({ propostaId }) => {
  const { data: documentos, isLoading } = useQuery({
    queryKey: [`/api/propostas/${propostaId}/documents`],
    enabled: !!propostaId,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando documentos...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-blue-400">Documentos da Proposta</h3>
      
      {documentos?.documentos && documentos.documentos.length > 0 ? (
        <div className="space-y-3">
          {documentos.documentos.map((doc: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">{doc.name || doc.nome || `Documento ${index + 1}`}</p>
                  <p className="text-xs text-gray-400">{doc.size ? `${(doc.size/1024).toFixed(1)} KB` : 'Tamanho não especificado'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => doc.url && window.open(doc.url, '_blank')}
                >
                  Visualizar
                </Button>
                <Button variant="destructive" size="sm" disabled>
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhum documento encontrado para esta proposta</p>
        </div>
      )}

      <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mt-4">
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-gray-400">
            <p className="text-sm font-medium">Clique para adicionar novos documentos</p>
            <p className="text-xs mt-1">PDF, JPG, JPEG, PNG (máx. 10MB cada)</p>
          </div>
        </label>
      </div>
    </div>
  );
};

interface PropostaData {
  id: string;
  status: string;
  motivoPendencia?: string;
  clienteData?: any;
  condicoesData?: any;
  documentosAnexados?: any[];
  // Related entities
  loja?: { id: number; nomeLoja: string };
  parceiro?: { id: number; razaoSocial: string };
  produto?: { id: number; nomeProduto: string; tacValor?: string; tacTipo?: string };
  tabelaComercial?: { id: number; nomeTabela: string; taxaJuros: string; prazos: number[]; comissao: string };
  // Metadata
  createdAt?: string;
  analistaId?: string;
  dataAnalise?: string;
}

const EditarPropostaPendenciada: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados-cliente");
  
  // Estado inicial para os formulários - DEVE estar antes de qualquer retorno condicional
  const [formData, setFormData] = useState({
    clienteData: {},
    condicoesData: {},
  });

  // Buscar dados da proposta
  const { data: proposta, isLoading, error } = useQuery<PropostaData>({
    queryKey: [`/api/propostas/${id}`],
    enabled: !!id,
  });

  // Atualizar formData quando proposta carrega - TODOS OS HOOKS DEVEM ESTAR AQUI NO TOPO
  useEffect(() => {
    if (proposta) {
      console.log('🔍 DADOS DA PROPOSTA CARREGADA:', {
        clienteData: proposta.clienteData,
        ocupacao_atual: proposta.clienteData?.ocupacao,
        renda_atual: proposta.clienteData?.renda,
        ocupacao_vazia: proposta.clienteData?.ocupacao === "",
        renda_vazia: proposta.clienteData?.renda === ""
      });
      setFormData({
        clienteData: proposta.clienteData || {},
        condicoesData: proposta.condicoesData || {},
      });
    }
  }, [proposta]);

  // Mutation para salvar alterações
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return fetchWithToken(`/api/propostas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Alterações salvas",
        description: "As alterações foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/propostas/${id}`] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as alterações.",
      });
      console.error("Erro ao salvar:", error);
    },
  });

  // Mutation para reenviar proposta
  const resubmitMutation = useMutation({
    mutationFn: async () => {
      return fetchWithToken(`/api/propostas/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'aguardando_analise',
          observacao: 'Proposta corrigida e reenviada após pendências'
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Proposta reenviada",
        description: "A proposta foi reenviada para análise com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/propostas'] });
      setLocation('/dashboard');
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao reenviar",
        description: "Ocorreu um erro ao reenviar a proposta.",
      });
      console.error("Erro ao reenviar:", error);
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Editar Proposta Pendenciada">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !proposta) {
    return (
      <DashboardLayout title="Editar Proposta Pendenciada">
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar proposta. Por favor, tente novamente.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  // Verificar se a proposta está pendenciada
  if (proposta.status !== 'pendenciado') {
    return (
      <DashboardLayout title="Editar Proposta">
        <Alert>
          <AlertDescription>
            Esta proposta não está pendenciada e não pode ser editada neste momento.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }



  const handleClientChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      clienteData: {
        ...prev.clienteData,
        [field]: value
      }
    }));
  };

  const handleCondicoesChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      condicoesData: {
        ...prev.condicoesData,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    updateMutation.mutate({
      cliente_data: formData.clienteData,
      condicoes_data: formData.condicoesData
    });
  };

  const handleResubmit = () => {
    // Primeiro salvar, depois reenviar
    handleSave();
    setTimeout(() => {
      resubmitMutation.mutate();
    }, 1000);
  };

  return (
    <DashboardLayout title="Editar Proposta Pendenciada">
      <div className="space-y-6">
        {/* Alerta de pendência */}
        {proposta?.motivoPendencia && (
          <Alert className="border-yellow-500 bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>Motivo da pendência:</strong> {proposta.motivoPendencia}
            </AlertDescription>
          </Alert>
        )}

        {/* Histórico de Comunicação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-400" />
              Histórico de Comunicação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Criação da proposta */}
              <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-green-400">✅ Proposta Criada</p>
                  <p className="text-xs text-gray-400">
                    {proposta?.createdAt ? new Date(proposta.createdAt).toLocaleString('pt-BR') : 'Data não disponível'}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    Proposta criada pelo atendente {proposta?.loja?.nomeLoja || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Pendência */}
              {proposta?.motivoPendencia && (
                <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-yellow-400">⚠️ Proposta Pendenciada</p>
                    <p className="text-xs text-gray-400">
                      {proposta?.dataAnalise ? new Date(proposta.dataAnalise).toLocaleString('pt-BR') : 'Data não disponível'}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      <strong>Analista:</strong> {proposta?.analistaId || 'N/A'}
                    </p>
                    <p className="text-sm text-yellow-200 mt-2 p-2 bg-yellow-900/30 rounded">
                      "{proposta.motivoPendencia}"
                    </p>
                  </div>
                </div>
              )}

              {/* Status atual */}
              <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-blue-400">🔄 Em Correção</p>
                  <p className="text-xs text-gray-400">Agora</p>
                  <p className="text-sm text-gray-300 mt-1">
                    Atendente está corrigindo os dados conforme solicitado pelo analista
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações da proposta */}
        <Card>
          <CardHeader>
            <CardTitle>Proposta #{proposta?.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="font-medium">Cliente:</span> {(formData.clienteData as any)?.nome || 'N/A'}
              </div>
              <div>
                <span className="font-medium">CPF:</span> {(formData.clienteData as any)?.cpf || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Valor Solicitado:</span> R$ {(formData.condicoesData as any)?.valor || 0}
              </div>
              <div>
                <span className="font-medium">Prazo:</span> {(formData.condicoesData as any)?.prazo || 0} meses
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de edição */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
                <TabsTrigger value="condicoes">Condições do Crédito</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados-cliente" className="mt-6 space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome Completo *</Label>
                      <Input
                        id="nome"
                        value={(formData.clienteData as any)?.nome || ''}
                        onChange={(e) => handleClientChange('nome', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={(formData.clienteData as any)?.cpf || ''}
                        onChange={(e) => handleClientChange('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        value={(formData.clienteData as any)?.rg || ''}
                        onChange={(e) => handleClientChange('rg', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
                      <Input
                        id="orgaoEmissor"
                        value={(formData.clienteData as any)?.orgaoEmissor || ''}
                        onChange={(e) => handleClientChange('orgaoEmissor', e.target.value)}
                        placeholder="SSP/SP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        value={(formData.clienteData as any)?.dataNascimento || ''}
                        onChange={(e) => handleClientChange('dataNascimento', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="estadoCivil">Estado Civil</Label>
                      <Input
                        id="estadoCivil"
                        value={(formData.clienteData as any)?.estadoCivil || ''}
                        onChange={(e) => handleClientChange('estadoCivil', e.target.value)}
                        placeholder="Solteiro, Casado, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="nacionalidade">Nacionalidade</Label>
                      <Input
                        id="nacionalidade"
                        value={(formData.clienteData as any)?.nacionalidade || ''}
                        onChange={(e) => handleClientChange('nacionalidade', e.target.value)}
                        placeholder="Brasileira"
                      />
                    </div>
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Contato</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={(formData.clienteData as any)?.email || ''}
                        onChange={(e) => handleClientChange('email', e.target.value)}
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        value={(formData.clienteData as any)?.telefone || ''}
                        onChange={(e) => handleClientChange('telefone', e.target.value)}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={(formData.clienteData as any)?.cep || ''}
                        onChange={(e) => handleClientChange('cep', e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="endereco">Endereço Completo</Label>
                      <Textarea
                        id="endereco"
                        value={(formData.clienteData as any)?.endereco || ''}
                        onChange={(e) => handleClientChange('endereco', e.target.value)}
                        rows={3}
                        placeholder="Rua, número, bairro, cidade, estado"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Profissionais */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Dados Profissionais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ocupacao">Ocupação *</Label>
                      <Input
                        id="ocupacao"
                        value={(formData.clienteData as any)?.ocupacao || (formData.clienteData as any)?.profissao || ''}
                        onChange={(e) => handleClientChange('ocupacao', e.target.value)}
                        placeholder="Profissão do cliente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="renda">Renda Mensal *</Label>
                      <CurrencyInput
                        id="renda"
                        value={(formData.clienteData as any)?.renda || (formData.clienteData as any)?.rendaMensal || ''}
                        onChange={(e) => handleClientChange('renda', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="condicoes" className="mt-6 space-y-6">
                {/* Valores do Empréstimo */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Valores do Empréstimo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor">Valor Solicitado *</Label>
                      <CurrencyInput
                        id="valor"
                        value={(formData.condicoesData as any)?.valor || ''}
                        onChange={(e) => handleCondicoesChange('valor', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="prazo">Prazo (meses) *</Label>
                      <Input
                        id="prazo"
                        type="number"
                        min="1"
                        max="120"
                        value={(formData.condicoesData as any)?.prazo || ''}
                        onChange={(e) => handleCondicoesChange('prazo', e.target.value)}
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorTac">Valor TAC</Label>
                      <CurrencyInput
                        id="valorTac"
                        value={(formData.condicoesData as any)?.valorTac || ''}
                        onChange={(e) => handleCondicoesChange('valorTac', e.target.value)}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorIof">Valor IOF</Label>
                      <CurrencyInput
                        id="valorIof"
                        value={(formData.condicoesData as any)?.valorIof || ''}
                        onChange={(e) => handleCondicoesChange('valorIof', e.target.value)}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorTotalFinanciado">Valor Total Financiado</Label>
                      <CurrencyInput
                        id="valorTotalFinanciado"
                        value={(formData.condicoesData as any)?.valorTotalFinanciado || ''}
                        onChange={(e) => handleCondicoesChange('valorTotalFinanciado', e.target.value)}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="valorParcela">Valor da Parcela</Label>
                      <CurrencyInput
                        id="valorParcela"
                        value={(formData.condicoesData as any)?.valorParcela || ''}
                        onChange={(e) => handleCondicoesChange('valorParcela', e.target.value)}
                        disabled
                      />
                    </div>
                  </div>
                </div>

                {/* Tabela e Produto */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Produto e Tabela</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="produto">Produto</Label>
                      <Input
                        id="produto"
                        value={proposta?.produto?.nomeProduto || 'N/A'}
                        disabled
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tabelaComercial">Tabela Comercial</Label>
                      <Input
                        id="tabelaComercial"
                        value={proposta?.tabelaComercial?.nomeTabela || 'N/A'}
                        disabled
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxaJuros">Taxa de Juros (%)</Label>
                      <Input
                        id="taxaJuros"
                        value={proposta?.tabelaComercial?.taxaJuros || ''}
                        disabled
                        className="bg-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="comissao">Comissão (%)</Label>
                      <Input
                        id="comissao"
                        value={proposta?.tabelaComercial?.comissao || ''}
                        disabled
                        className="bg-gray-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Finalidade e Garantia */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Detalhes do Empréstimo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="finalidade">Finalidade *</Label>
                      <Input
                        id="finalidade"
                        value={(formData.condicoesData as any)?.finalidade || ''}
                        onChange={(e) => handleCondicoesChange('finalidade', e.target.value)}
                        placeholder="Capital de giro, aquisição de equipamentos, etc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="garantia">Garantia</Label>
                      <Input
                        id="garantia"
                        value={(formData.condicoesData as any)?.garantia || ''}
                        onChange={(e) => handleCondicoesChange('garantia', e.target.value)}
                        placeholder="Sem garantia, aval, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">Observações</h3>
                  <div>
                    <Label htmlFor="observacoes">Observações Adicionais</Label>
                    <Textarea
                      id="observacoes"
                      value={(formData.condicoesData as any)?.observacoes || ''}
                      onChange={(e) => handleCondicoesChange('observacoes', e.target.value)}
                      rows={4}
                      placeholder="Informações adicionais sobre o empréstimo..."
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="documentos" className="mt-6 space-y-4">
                <DocumentsTab propostaId={id!} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Botões de ação */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/dashboard')}
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
            <Button
              className="btn-simpix-accent"
              onClick={handleResubmit}
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Reenviar para Análise
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditarPropostaPendenciada;