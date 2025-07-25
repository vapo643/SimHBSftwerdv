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

interface PropostaData {
  id: string;
  status: string;
  motivo_pendencia?: string;
  clienteData?: any;
  condicoesData?: any;
  documentos?: any[];
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

  // Atualizar formData quando proposta carrega
  useEffect(() => {
    if (proposta) {
      setFormData({
        clienteData: proposta.clienteData || {},
        condicoesData: proposta.condicoesData || {},
      });
    }
  }, [proposta]);

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
        {proposta?.motivo_pendencia && (
          <Alert className="border-yellow-500 bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>Motivo da pendência:</strong> {proposta.motivo_pendencia}
            </AlertDescription>
          </Alert>
        )}

        {/* Informações da proposta */}
        <Card>
          <CardHeader>
            <CardTitle>Proposta #{proposta?.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="font-medium">Cliente:</span> {formData.clienteData?.nome || 'N/A'}
              </div>
              <div>
                <span className="font-medium">CPF:</span> {formData.clienteData?.cpf || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Valor Solicitado:</span> R$ {formData.condicoesData?.valor || 0}
              </div>
              <div>
                <span className="font-medium">Prazo:</span> {formData.condicoesData?.prazo || 0} meses
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de edição */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados-cliente">Dados do Cliente</TabsTrigger>
                <TabsTrigger value="condicoes">Condições do Crédito</TabsTrigger>
              </TabsList>

              <TabsContent value="dados-cliente" className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      value={formData.clienteData.nome || ''}
                      onChange={(e) => handleClientChange('nome', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.clienteData.cpf || ''}
                      onChange={(e) => handleClientChange('cpf', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.clienteData.email || ''}
                      onChange={(e) => handleClientChange('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.clienteData.telefone || ''}
                      onChange={(e) => handleClientChange('telefone', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rendaMensal">Renda Mensal</Label>
                    <CurrencyInput
                      id="rendaMensal"
                      value={formData.clienteData.rendaMensal || ''}
                      onChange={(e) => handleClientChange('rendaMensal', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ocupacao">Ocupação</Label>
                    <Input
                      id="ocupacao"
                      value={formData.clienteData.ocupacao || ''}
                      onChange={(e) => handleClientChange('ocupacao', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="endereco">Endereço Completo</Label>
                  <Textarea
                    id="endereco"
                    value={formData.clienteData.endereco || ''}
                    onChange={(e) => handleClientChange('endereco', e.target.value)}
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="condicoes" className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valor">Valor Solicitado</Label>
                    <CurrencyInput
                      id="valor"
                      value={formData.condicoesData.valor || ''}
                      onChange={(e) => handleCondicoesChange('valor', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prazo">Prazo (meses)</Label>
                    <Input
                      id="prazo"
                      type="number"
                      value={formData.condicoesData.prazo || ''}
                      onChange={(e) => handleCondicoesChange('prazo', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="taxa">Taxa de Juros (%)</Label>
                    <Input
                      id="taxa"
                      type="number"
                      step="0.01"
                      value={formData.condicoesData.taxaJuros || ''}
                      onChange={(e) => handleCondicoesChange('taxaJuros', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="valorParcela">Valor da Parcela</Label>
                    <CurrencyInput
                      id="valorParcela"
                      value={formData.condicoesData.valorParcela || ''}
                      onChange={(e) => handleCondicoesChange('valorParcela', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.condicoesData.observacoes || ''}
                    onChange={(e) => handleCondicoesChange('observacoes', e.target.value)}
                    rows={3}
                  />
                </div>
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