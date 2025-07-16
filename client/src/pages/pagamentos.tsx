import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  DollarSign, 
  CheckCircle, 
  Download,
  CreditCard,
  Eye
} from "lucide-react";

interface Proposta {
  id: number;
  clienteNome: string;
  valor: string;
  status: string;
  createdAt: string;
}

export default function Pagamentos() {
  const [selectedPropostas, setSelectedPropostas] = useState<number[]>([]);
  const { toast } = useToast();

  const { data: propostas, isLoading } = useQuery<Proposta[]>({
    queryKey: ["/api/propostas/status/aprovado"],
  });

  const { data: allPropostas } = useQuery<Proposta[]>({
    queryKey: ["/api/propostas"],
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleSelectProposta = (propostaId: number) => {
    setSelectedPropostas(prev => 
      prev.includes(propostaId) 
        ? prev.filter(id => id !== propostaId)
        : [...prev, propostaId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPropostas.length === propostas?.length) {
      setSelectedPropostas([]);
    } else {
      setSelectedPropostas(propostas?.map(p => p.id) || []);
    }
  };

  const handleProcessPayment = (propostaId?: number) => {
    toast({
      title: "Pagamento processado!",
      description: propostaId 
        ? `Pagamento da proposta #${propostaId} foi processado com sucesso.`
        : `${selectedPropostas.length} pagamentos foram processados com sucesso.`,
    });
    
    if (!propostaId) {
      setSelectedPropostas([]);
    }
  };

  const handleExportList = () => {
    toast({
      title: "Lista exportada!",
      description: "A lista de pagamentos foi exportada com sucesso.",
    });
  };

  // Calculate stats
  const stats = {
    aguardando: propostas?.length || 0,
    valorTotal: propostas?.reduce((sum, p) => sum + parseFloat(p.valor), 0) || 0,
    pagosHoje: 8, // Mock data
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Fila de Pagamento">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Fila de Pagamento">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Aguardando Pagamento</p>
                  <p className="text-2xl font-bold text-warning">{stats.aguardando}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-full">
                  <Clock className="text-warning text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.valorTotal.toString())}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                  <DollarSign className="text-primary text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pagos Hoje</p>
                  <p className="text-2xl font-bold text-green-600">{stats.pagosHoje}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <CheckCircle className="text-green-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Queue Table */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Propostas Aprovadas para Pagamento</h3>
              <Button onClick={handleExportList} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Lista
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <Checkbox 
                        checked={selectedPropostas.length === propostas?.length && propostas?.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Aprovação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {propostas && propostas.length > 0 ? (
                    propostas.map((proposta) => (
                      <tr key={proposta.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Checkbox 
                            checked={selectedPropostas.includes(proposta.id)}
                            onCheckedChange={() => handleSelectProposta(proposta.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{proposta.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {proposta.clienteNome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(proposta.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Banco do Brasil - Ag: 1234 CC: 56789-0
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="default">
                            Pronto para Pagamento
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(proposta.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button 
                              size="sm"
                              onClick={() => handleProcessPayment(proposta.id)}
                            >
                              Processar
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        Nenhuma proposta pronta para pagamento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {propostas && propostas.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{selectedPropostas.length}</span> de{" "}
                    <span className="font-medium">{propostas.length}</span> propostas selecionadas
                  </p>
                  <Button 
                    onClick={() => handleProcessPayment()}
                    disabled={selectedPropostas.length === 0}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Processar Pagamentos Selecionados
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
