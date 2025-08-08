import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import UserForm from "@/components/usuarios/UserForm";
import DashboardLayout from "@/components/DashboardLayout";
import { ErrorBoundary, UserFormErrorBoundary } from "@/components/ErrorBoundary";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/apiClient";
import { queryKeys, invalidationPatterns } from "@/hooks/queries/queryKeys";
import type { User } from "@shared/schema";
import {
  Users,
  Edit,
  UserX,
  UserCheck,
  Loader2,
  Shield,
  UserPlus,
  Activity,
  BarChart3,
  TrendingUp,
  Mail,
  Calendar,
  Settings,
} from "lucide-react";
import RefreshButton from "@/components/RefreshButton";

const UsuariosPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users with comprehensive details using isolated query keys
  const {
    data: users = [],
    isLoading: loadingUsers,
    error: usersError,
  } = useQuery<User[]>({
    queryKey: queryKeys.users.withDetails(),
    queryFn: async () => {
      const response = await api.get<User[]>("/api/admin/users");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mutation for creating new users
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const apiData = {
        fullName: userData.nome,
        email: userData.email,
        password: userData.senha,
        role: userData.perfil,
        lojaId:
          userData.perfil === "ATENDENTE" && userData.lojaId ? parseInt(userData.lojaId) : null,
        lojaIds:
          userData.perfil === "GERENTE" && userData.lojaIds
            ? userData.lojaIds.map((id: string) => parseInt(id))
            : null,
      };

      console.log("🔍 [USER CREATE] Sending data:", JSON.stringify(apiData, null, 2));

      const response = await api.post("/api/admin/users", apiData);
      return response.data; // Retorna o corpo da resposta da API
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
      });

      // Use invalidation patterns for consistent cache management
      invalidationPatterns.onUserChange.forEach(pattern => {
        queryClient.invalidateQueries({ queryKey: pattern });
      });
      setIsModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      console.error("❌ [USER CREATE ERROR]:", error);
      console.error("❌ [ERROR DATA]:", error.data);

      // Handle password validation errors specifically - use error.data from ApiError
      if (error.data?.errors?.fieldErrors?.password) {
        const passwordErrors = error.data.errors.fieldErrors.password;
        let description = "Problema com a senha:\n";

        if (passwordErrors.includes("This is a top-10 common password")) {
          description += "• Senha muito comum/simples\n";
          description += "\nSugestões:\n";
          description += "• Use pelo menos 8 caracteres\n";
          description += "• Combine letras maiúsculas e minúsculas\n";
          description += "• Inclua números e símbolos (@, #, !, etc.)\n";
          description += "• Evite sequências como '12345678'\n";
          description += "• Exemplo: MinhaSenh@123";
        } else {
          description += passwordErrors.join(", ");
        }

        toast({
          title: "Senha rejeitada por segurança",
          description: description,
          variant: "destructive",
          duration: 8000, // 8 seconds to read suggestions
        });
        return;
      }

      // Handle role validation errors
      if (error.data?.errors?.fieldErrors?.role) {
        toast({
          title: "Erro no perfil do usuário",
          description: "Perfil selecionado não é válido. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Generic error handling
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrEdit = (userData: any) => {
    if (selectedUser) {
      // TODO: Implement edit functionality when needed
      toast({
        title: "Info",
        description: "Edição de usuários será implementada em breve",
      });
    } else {
      // For creating new users, use the API
      createUserMutation.mutate(userData);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const toggleUserStatus = (userId: number) => {
    // TODO: Implement user status toggle when API is ready
    toast({
      title: "Info",
      description: "Alteração de status será implementada em breve",
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
  };

  // Error handling
  if (usersError) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <ErrorBoundary>
          <div className="flex h-64 items-center justify-center">
            <div className="space-y-4 text-center">
              <p className="text-red-600 dark:text-red-400">Erro ao carregar usuários</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          </div>
        </ErrorBoundary>
      </DashboardLayout>
    );
  }

  // Loading skeleton
  if (loadingUsers) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <div className="space-y-8">
          {/* Header Section Loading */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-3 shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <Skeleton className="mb-2 h-9 w-64" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
            <Skeleton className="h-12 w-40" />
          </div>

          {/* Statistics Cards Loading */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card
                key={i}
                className="border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-1 h-8 w-12" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Users Table Loading */}
          <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Lista de Usuários
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200 dark:border-gray-700">
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Usuário
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Email
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Perfil
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Status
                      </TableHead>
                      <TableHead className="text-center font-semibold text-gray-900 dark:text-white">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                              <Skeleton className="mb-1 h-5 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-2 w-2 rounded-full" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Skeleton className="h-9 w-9" />
                            <Skeleton className="h-9 w-9" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estatísticas dos usuários
  const userStats = {
    total: users.length,
    administradores: users.filter(u => u.role === "ADMINISTRADOR").length,
    analistas: users.filter(u => u.role === "ANALISTA").length,
    atendentes: users.filter(u => u.role === "ATENDENTE").length,
    gerentes: users.filter(u => u.role === "GERENTE").length,
    financeiro: users.filter(u => u.role === "FINANCEIRO").length,
    ativosPercentual:
      users.length > 0 ? ((users.length / (users.length + 0)) * 100).toFixed(1) : "0",
  };

  return (
    <DashboardLayout
      title="Gestão de Usuários e Perfis"
      actions={<RefreshButton onRefresh={handleRefresh} isLoading={loadingUsers} variant="ghost" />}
    >
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-3 shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-gray-300">
                Gestão de Usuários
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Controle completo de usuários e permissões do sistema
              </p>
            </div>
          </div>
          <Button
            onClick={openNewModal}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
            size="lg"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Novo Usuário
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total de Usuários
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {userStats.total}
              </div>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                {userStats.ativosPercentual}% ativos
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Administradores
              </CardTitle>
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {userStats.administradores}
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Acesso total</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:border-purple-800 dark:from-purple-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Analistas
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {userStats.analistas}
              </div>
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                Análise de crédito
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 dark:border-orange-800 dark:from-orange-950 dark:to-orange-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Atendentes
              </CardTitle>
              <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {userStats.atendentes}
              </div>
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                Atendimento direto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="border-gray-200 bg-white/50 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Lista de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                  Nenhum usuário encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Comece criando o primeiro usuário do sistema
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200 dark:border-gray-700">
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Usuário
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Email
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Perfil
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-white">
                        Status
                      </TableHead>
                      <TableHead className="text-center font-semibold text-gray-900 dark:text-white">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => {
                      const initials = user.name
                        .split(" ")
                        .map(n => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      const roleColor =
                        {
                          ADMINISTRADOR:
                            "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200",
                          ANALISTA:
                            "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200",
                          ATENDENTE:
                            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200",
                          GERENTE:
                            "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200",
                          FINANCEIRO:
                            "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200",
                          DIRETOR:
                            "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200",
                        }[user.role] ||
                        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200";

                      return (
                        <TableRow
                          key={user.id}
                          className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-white shadow-md dark:border-gray-700">
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {user.name}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Calendar className="h-3 w-3" />
                                  Criado em{" "}
                                  {new Date(user.createdAt || Date.now()).toLocaleDateString(
                                    "pt-BR"
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600 dark:text-gray-300">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              className={`border px-3 py-1 text-xs font-semibold ${roleColor}`}
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                              <Badge className="border-green-200 bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                                Ativo
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(user)}
                                className="h-9 w-9 border-blue-200 p-0 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                                title="Editar usuário"
                              >
                                <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleUserStatus(user.id)}
                                className="h-9 w-9 border-red-200 p-0 hover:border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                                title="Desativar usuário"
                              >
                                <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <UserFormErrorBoundary>
            <UserForm
              initialData={selectedUser}
              onSubmit={handleCreateOrEdit}
              onCancel={() => {
                setIsModalOpen(false);
                setSelectedUser(null);
              }}
              isLoading={createUserMutation.isPending}
            />
          </UserFormErrorBoundary>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UsuariosPage;
