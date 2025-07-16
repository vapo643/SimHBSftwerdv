import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Proposta {
  id: number;
  clienteNome: string;
  valor: string;
  prazo: number;
  status: string;
  createdAt: string;
}

export default function FilaAnalise() {
  const [statusFilter, setStatusFilter] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
  const [valorMaximo, setValorMaximo] = useState("");
  const [busca, setBusca] = useState("");

  const { data: propostas, isLoading } = useQuery<Proposta[]>({
    queryKey: ["/api/propostas"],
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'aguardando_analise': { label: 'Pendente', variant: 'secondary' as const },
      'em_analise': { label: 'Em Análise', variant: 'default' as const },
      'aprovado': { label: 'Aprovado', variant: 'default' as const },
      'rejeitado': { label: 'Rejeitado', variant: 'destructive' as const },
    };
    
    return statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
  };

  const getPriorityBadge = (valor: string) => {
    const valorNum = parseFloat(valor);
    if (valorNum > 100000) return { label: 'Alta', variant: 'destructive' as const };
    if (valorNum > 50000) return { label: 'Média', variant: 'secondary' as const };
    return { label: 'Baixa', variant: 'outline' as const };
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  const filteredPropostas = propostas?.filter(proposta => {
    const matchesStatus = !statusFilter || proposta.status === statusFilter;
    const matchesBusca = !busca || proposta.clienteNome.toLowerCase().includes(busca.toLowerCase());
    
    let matchesValor = true;
    if (valorMinimo) {
      matchesValor = matchesValor && parseFloat(proposta.valor) >= parseFloat(valorMinimo);
    }
    if (valorMaximo) {
      matchesValor = matchesValor && parseFloat(proposta.valor) <= parseFloat(valorMaximo);
    }
    
    return matchesStatus && matchesBusca && matchesValor;
  });

  const clearFilters = () => {
    setStatusFilter("");
    setValorMinimo("");
    setValorMaximo("");
    setBusca("");
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Fila de Análise de Crédito">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Fila de Análise de Crédito">
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Status</SelectItem>
                    <SelectItem value="aguardando_analise">Pendente</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="valorMinimo">Valor Mínimo</Label>
                <Input
                  id="valorMinimo"
                  placeholder="R$ 0,00"
                  value={valorMinimo}
                  onChange={(e) => setValorMinimo(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="valorMaximo">Valor Máximo</Label>
                <Input
                  id="valorMaximo"
                  placeholder="R$ 100.000,00"
                  value={valorMaximo}
                  onChange={(e) => setValorMaximo(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="busca">Buscar</Label>
                <Input
                  id="busca"
                  placeholder="Nome do cliente..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4 space-x-2">
              <Button variant="outline" onClick={clearFilters}>
                Limpar
              </Button>
              <Button>
                Filtrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Proposals Table */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Propostas para Análise</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                      Prazo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prioridade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPropostas && filteredPropostas.length > 0 ? (
                    filteredPropostas.map((proposta) => {
                      const statusInfo = getStatusBadge(proposta.status);
                      const priorityInfo = getPriorityBadge(proposta.valor);
                      
                      return (
                        <tr key={proposta.id} className="hover:bg-gray-50">
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
                            {proposta.prazo} meses
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={priorityInfo.variant}>
                              {priorityInfo.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Link href={`/credito/analise/${proposta.id}`}>
                              <Button size="sm">
                                Analisar
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Nenhuma proposta encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
