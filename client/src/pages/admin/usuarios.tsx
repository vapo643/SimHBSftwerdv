import React, { useState } from "react";
import { Button } from "@/components/ui/button";

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
import { Users, Edit, UserX, UserCheck, Loader2 } from "lucide-react";

const UsuariosPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users with comprehensive details using isolated query keys
  const { data: users = [], isLoading: loadingUsers, error: usersError } = useQuery<User[]>({
    queryKey: queryKeys.users.withDetails(),
    queryFn: async () => {
      const response = await api.get<User[]>('/api/admin/users');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  // Mutation for creating new users
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const apiData = {
        fullName: userData.nome,
        email: userData.email,
        password: userData.senha,
        role: userData.perfil,
        lojaId: userData.perfil === 'ATENDENTE' && userData.lojaId ? parseInt(userData.lojaId) : null,
        lojaIds: userData.perfil === 'GERENTE' && userData.lojaIds ? userData.lojaIds.map((id: string) => parseInt(id)) : null,
      };
      
      console.log('🔍 [USER CREATE] Sending data:', apiData);

      const response = await api.post('/api/admin/users', apiData);
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

  // Error handling
  if (usersError) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <ErrorBoundary>
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Usuários</h1>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Usuários e Perfis">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Usuários</h1>
          </div>
          <Button onClick={openNewModal} className="bg-blue-600 hover:bg-blue-700">
            <Users className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      <div className="bg-black border border-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Ativo
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(user)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleUserStatus(user.id)}
                        className="h-8 w-8 p-0"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
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