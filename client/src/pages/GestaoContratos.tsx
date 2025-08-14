import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ExternalLink, FileText, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

interface Contrato {
  id: string;
  clienteNome: string;
  clienteCpf?: string;
  clienteCnpj?: string;
  tipoPessoa: "PF" | "PJ";
  valor: string;
  prazo: number;
  valorTotalFinanciado: string;
  status: string;
  dataAssinatura: string;
  ccbGerado: boolean;
  assinaturaEletronicaConcluida: boolean;
  urlCcbAssinado?: string;
  caminhoCcbAssinado?: string;
  lojaNome?: string;
  parceiroRazaoSocial?: string;
  produtoNome?: string;
  diasDesdeAssinatura?: number;
  aguardandoPagamento?: boolean;
  statusFormalizacao?: string;
}

interface ContratosResponse {
  success: boolean;
  contratos: Contrato[];
  estatisticas: {
    totalContratos: number;
    aguardandoPagamento: number;
    pagos: number;
    valorTotalContratado: number;
    valorTotalLiberado: number;
  };
}

const ITEMS_PER_PAGE = 15;

export default function GestaoContratos() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingCcb, setLoadingCcb] = useState<string | null>(null);

  // Verificar permissão de acesso
  const hasPermission = user?.role === "ADMINISTRADOR" || user?.role === "DIRETOR";

  // Buscar contratos
  const { data, isLoading, error } = useQuery<ContratosResponse>({
    queryKey: ["/api/contratos"],
    enabled: hasPermission,
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // Função para visualizar CCB assinado
  const handleVisualizarCcb = async (contrato: Contrato) => {
    try {
      setLoadingCcb(contrato.id);

      // Se já temos a URL, abrir diretamente
      if (contrato.urlCcbAssinado) {
        window.open(contrato.urlCcbAssinado, "_blank");
        return;
      }

      // Caso contrário, buscar URL segura do backend
      if (contrato.caminhoCcbAssinado) {
        const response = await apiRequest(`/api/formalizacao/${contrato.id}/ccb-url`, {
          method: "POST",
        });

        const typedResponse = response as { url?: string };
        if (typedResponse.url) {
          window.open(typedResponse.url, "_blank");
        } else {
          console.error("URL do CCB não disponível");
        }
      }
    } catch (error) {
      console.error("Erro ao abrir CCB:", error);
    } finally {
      setLoadingCcb(null);
    }
  };

  // Redirecionar se não tem permissão
  if (!hasPermission) {
    return (
      <DashboardLayout title="Acesso Negado">
        <div className="container mx-auto py-8">
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Você não tem permissão para acessar esta página. Apenas usuários com perfil
                  ADMINISTRADOR ou DIRETOR podem visualizar contratos.
                </AlertDescription>
              </Alert>
              <div className="mt-4">
                <Button onClick={() => (window.location.href = "/dashboard")}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Estado de carregamento
  if (isLoading) {
    return (
      <DashboardLayout title="Gestão de Contratos">
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="mt-2 h-4 w-96" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <DashboardLayout title="Gestão de Contratos">
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Erro ao carregar contratos</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Ocorreu um erro ao carregar os contratos. Por favor, tente novamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const contratos = data?.contratos || [];
  const estatisticas = data?.estatisticas;

  // Paginação
  const totalPages = Math.ceil(contratos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentContratos = contratos.slice(startIndex, endIndex);

  // Estado vazio
  if (contratos.length === 0) {
    return (
      <DashboardLayout title="Gestão de Contratos">
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Contratos</CardTitle>
              <CardDescription>Visualize e gerencie todos os contratos assinados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-semibold">Nenhum contrato assinado encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Quando houver contratos assinados, eles aparecerão aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Contratos">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Contratos</CardTitle>
            <CardDescription>Visualize e gerencie todos os contratos assinados</CardDescription>

            {estatisticas && (
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs text-blue-600">Total de Contratos</p>
                  <p className="text-xl font-bold text-blue-900">{estatisticas.totalContratos}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3">
                  <p className="text-xs text-yellow-600">Aguardando Pagamento</p>
                  <p className="text-xl font-bold text-yellow-900">
                    {estatisticas.aguardandoPagamento}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs text-green-600">Pagos</p>
                  <p className="text-xl font-bold text-green-900">{estatisticas.pagos}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <p className="text-xs text-purple-600">Valor Total Contratado</p>
                  <p className="text-lg font-bold text-purple-900">
                    {formatCurrency(estatisticas.valorTotalContratado)}
                  </p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-3">
                  <p className="text-xs text-indigo-600">Valor Total Liberado</p>
                  <p className="text-lg font-bold text-indigo-900">
                    {formatCurrency(estatisticas.valorTotalLiberado)}
                  </p>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID da Proposta</TableHead>
                    <TableHead>Nome do Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Valor do Contrato</TableHead>
                    <TableHead>Data da Assinatura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentContratos.map(contrato => (
                    <TableRow key={contrato.id}>
                      <TableCell className="font-mono text-xs">
                        {contrato.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-medium">{contrato.clienteNome}</TableCell>
                      <TableCell>
                        {contrato.tipoPessoa === "PF"
                          ? formatCpf(contrato.clienteCpf || "")
                          : formatCnpj(contrato.clienteCnpj || "")}
                      </TableCell>
                      <TableCell>{formatCurrency(parseFloat(contrato.valor || "0"))}</TableCell>
                      <TableCell>
                        {contrato.dataAssinatura
                          ? format(new Date(contrato.dataAssinatura), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={contrato.statusFormalizacao} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVisualizarCcb(contrato)}
                          disabled={!contrato.caminhoCcbAssinado || loadingCcb === contrato.id}
                          data-testid={`button-view-ccb-${contrato.id}`}
                        >
                          {loadingCcb === contrato.id ? (
                            <>Carregando...</>
                          ) : (
                            <>
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Visualizar CCB Assinado
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={
                          currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => setCurrentPage(i + 1)}
                          isActive={currentPage === i + 1}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Componente para badge de status
function StatusBadge({ status }: { status?: string }) {
  const statusConfig = {
    PENDENTE_GERACAO: { label: "Pendente", className: "bg-gray-100 text-gray-800" },
    AGUARDANDO_ASSINATURA: {
      label: "Aguardando Assinatura",
      className: "bg-yellow-100 text-yellow-800",
    },
    AGUARDANDO_PAGAMENTO: {
      label: "Aguardando Pagamento",
      className: "bg-orange-100 text-orange-800",
    },
    CONCLUIDO: { label: "Concluído", className: "bg-green-100 text-green-800" },
    EM_PROCESSAMENTO: { label: "Em Processamento", className: "bg-blue-100 text-blue-800" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status || "Desconhecido",
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// Funções auxiliares de formatação
function formatCpf(cpf: string): string {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string): string {
  if (!cnpj) return "-";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
