/**
 * PAM V1.0 - Tela de Cobranças
 * Requisitos:
 * - Acessível apenas para roles COBRANCA, FINANCEIRO e ADMINISTRADOR
 * - Lista propostas com assinaturaEletronicaConcluida = true E EXISTS em inter_collections
 * - Ações: Ver/Baixar Carnê, Copiar PIX, Copiar Linha Digitável
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  MoreVertical,
  FileText,
  Copy,
  QrCode,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PropostaCobranca {
  id: string;
  numeroProposta: number;
  clienteNome: string;
  clienteCpf: string;
  clienteTelefone?: string;
  valorTotalFinanciado: number;
  status: string;
  statusCobranca: "em_dia" | "inadimplente" | "quitado";
  diasAtrasoMaximo: number;
  valorTotalVencido: number;
  parcelasVencidas: number;
  parcelasPagas: number;
  parcelasPendentes: number;
  interCollections: Array<{
    id: string;
    numeroParcela: number;
    codigoSolicitacao: string;
    pixCopiaECola?: string;
    linhaDigitavel?: string;
    situacao: string;
  }>;
  carneUrl?: string;
}

export default function CobrancasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // PAM V1.0 - Buscar propostas com regra de negócio específica
  const { data: propostas, isLoading, error, refetch } = useQuery<PropostaCobranca[]>({
    queryKey: ["/api/cobrancas"],
    retry: 2,
  });

  // Filtrar propostas baseado na busca
  const propostasFiltradas = propostas?.filter(proposta => {
    const searchLower = searchTerm.toLowerCase();
    return (
      proposta.clienteNome?.toLowerCase().includes(searchLower) ||
      proposta.numeroProposta?.toString().includes(searchTerm) ||
      proposta.clienteCpf?.includes(searchTerm)
    );
  });

  // Função para copiar PIX da primeira parcela pendente
  const copiarPix = async (proposta: PropostaCobranca) => {
    try {
      // Encontrar primeira parcela pendente com PIX
      const primeiraParcelaPendente = proposta.interCollections
        ?.filter(boleto => boleto.situacao !== "RECEBIDO" && boleto.pixCopiaECola)
        ?.sort((a, b) => a.numeroParcela - b.numeroParcela)[0];

      if (!primeiraParcelaPendente?.pixCopiaECola) {
        toast({
          title: "PIX não disponível",
          description: "Nenhum código PIX encontrado para parcelas pendentes",
          variant: "destructive",
        });
        return;
      }

      await navigator.clipboard.writeText(primeiraParcelaPendente.pixCopiaECola);
      toast({
        title: "PIX Copiado!",
        description: `Código PIX da parcela ${primeiraParcelaPendente.numeroParcela} copiado para área de transferência`,
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código PIX",
        variant: "destructive",
      });
    }
  };

  // Função para copiar linha digitável da primeira parcela pendente
  const copiarLinhaDigitavel = async (proposta: PropostaCobranca) => {
    try {
      // Encontrar primeira parcela pendente com linha digitável
      const primeiraParcelaPendente = proposta.interCollections
        ?.filter(boleto => boleto.situacao !== "RECEBIDO" && boleto.linhaDigitavel)
        ?.sort((a, b) => a.numeroParcela - b.numeroParcela)[0];

      if (!primeiraParcelaPendente?.linhaDigitavel) {
        toast({
          title: "Linha digitável não disponível",
          description: "Nenhuma linha digitável encontrada para parcelas pendentes",
          variant: "destructive",
        });
        return;
      }

      await navigator.clipboard.writeText(primeiraParcelaPendente.linhaDigitavel);
      toast({
        title: "Linha Digitável Copiada!",
        description: `Linha digitável da parcela ${primeiraParcelaPendente.numeroParcela} copiada`,
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a linha digitável",
        variant: "destructive",
      });
    }
  };

  // Função para baixar/ver carnê
  const verBaixarCarne = async (proposta: PropostaCobranca) => {
    try {
      setIsRefreshing(true);
      
      // Primeiro verificar se carnê já existe
      const statusResponse = await apiRequest(`/api/propostas/${proposta.id}/carne-status`) as {
        carneExists: boolean;
        carneUrl?: string;
      };
      
      if (!statusResponse.carneExists) {
        // Se não existe, gerar carnê primeiro
        toast({
          title: "Gerando carnê...",
          description: "Aguarde enquanto o carnê é gerado",
        });
        
        const gerarResponse = await apiRequest(`/api/propostas/${proposta.id}/gerar-carne`, {
          method: "POST",
        }) as {
          carneUrl?: string;
        };
        
        if (gerarResponse.carneUrl) {
          window.open(gerarResponse.carneUrl, "_blank");
          toast({
            title: "Carnê gerado com sucesso!",
            description: "O download do carnê foi iniciado",
          });
        }
      } else if (statusResponse.carneUrl) {
        // Se já existe, abrir diretamente
        window.open(statusResponse.carneUrl, "_blank");
        toast({
          title: "Abrindo carnê",
          description: "O carnê está sendo aberto em nova aba",
        });
      }
    } catch (error) {
      console.error("Erro ao processar carnê:", error);
      toast({
        title: "Erro ao processar carnê",
        description: "Não foi possível gerar ou baixar o carnê",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Função para atualizar todos os status
  const atualizarTodosStatus = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      toast({
        title: "Dados atualizados",
        description: "A lista de cobranças foi atualizada com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os dados",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Renderizar badge de status
  const renderStatusBadge = (status: string) => {
    const statusConfig = {
      em_dia: { label: "Em Dia", className: "bg-green-100 text-green-800" },
      inadimplente: { label: "Inadimplente", className: "bg-red-100 text-red-800" },
      quitado: { label: "Quitado", className: "bg-blue-100 text-blue-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-gray-100 text-gray-800",
    };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Calcular estatísticas
  const estatisticas = {
    total: propostas?.length || 0,
    inadimplentes: propostas?.filter(p => p.statusCobranca === "inadimplente").length || 0,
    emDia: propostas?.filter(p => p.statusCobranca === "em_dia").length || 0,
    quitados: propostas?.filter(p => p.statusCobranca === "quitado").length || 0,
    valorTotalVencido: propostas?.reduce((acc, p) => acc + (p.valorTotalVencido || 0), 0) || 0,
  };

  if (error) {
    const errorMessage = (error as any)?.message || "Erro desconhecido";
    
    // Verificar se é erro de permissão
    if (errorMessage.includes("Acesso negado")) {
      return (
        <DashboardLayout title="Cobranças">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Acesso Negado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Você não tem permissão para acessar a Tela de Cobranças.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Apenas usuários com perfil COBRANCA, FINANCEIRO ou ADMINISTRADOR podem acessar esta página.
                </p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      );
    }

    return (
      <DashboardLayout title="Cobranças">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Erro ao carregar dados</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{errorMessage}</p>
              <Button onClick={() => refetch()} className="mt-4">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Cobranças">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tela de Cobranças</h1>
            <p className="text-gray-600 mt-1">
              PAM V1.0 - Gestão de propostas em cobrança
            </p>
          </div>
          <Button
            onClick={atualizarTodosStatus}
            disabled={isRefreshing}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Total</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{estatisticas.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Em Dia</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{estatisticas.emDia}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Inadimplentes</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{estatisticas.inadimplentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Quitados</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{estatisticas.quitados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Valor Total Vencido</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(estatisticas.valorTotalVencido)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou número da proposta..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-cobrancas"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Propostas */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas em Cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Proposta</TableHead>
                      <TableHead>Nome do Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status Geral</TableHead>
                      <TableHead>Dias Atraso</TableHead>
                      <TableHead>Valor Vencido</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostasFiltradas?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Nenhuma proposta encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      propostasFiltradas?.map(proposta => (
                        <TableRow key={proposta.id} data-testid={`row-proposta-${proposta.id}`}>
                          <TableCell className="font-medium">
                            #{proposta.numeroProposta}
                          </TableCell>
                          <TableCell>{proposta.clienteNome}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {proposta.clienteCpf?.replace(
                              /(\d{3})(\d{3})(\d{3})(\d{2})/,
                              "$1.$2.$3-$4"
                            )}
                          </TableCell>
                          <TableCell>{renderStatusBadge(proposta.statusCobranca)}</TableCell>
                          <TableCell>
                            {proposta.diasAtrasoMaximo > 0 ? (
                              <span className="text-red-600 font-semibold">
                                {proposta.diasAtrasoMaximo} dias
                              </span>
                            ) : (
                              <span className="text-green-600">Em dia</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {proposta.valorTotalVencido > 0 ? (
                              <span className="text-red-600 font-semibold">
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(proposta.valorTotalVencido)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs">
                              <span className="text-green-600">
                                {proposta.parcelasPagas} pagas
                              </span>
                              {proposta.parcelasVencidas > 0 && (
                                <span className="text-red-600">
                                  {proposta.parcelasVencidas} vencidas
                                </span>
                              )}
                              {proposta.parcelasPendentes > 0 && (
                                <span className="text-gray-600">
                                  {proposta.parcelasPendentes} pendentes
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-actions-${proposta.id}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => verBaixarCarne(proposta)}
                                  data-testid={`action-carne-${proposta.id}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Ver/Baixar Carnê
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copiarPix(proposta)}
                                  disabled={!proposta.interCollections?.some(b => b.pixCopiaECola)}
                                  data-testid={`action-pix-${proposta.id}`}
                                >
                                  <QrCode className="mr-2 h-4 w-4" />
                                  Copiar PIX
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => copiarLinhaDigitavel(proposta)}
                                  disabled={!proposta.interCollections?.some(b => b.linhaDigitavel)}
                                  data-testid={`action-linha-${proposta.id}`}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar Linha Digitável
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}