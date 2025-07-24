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
import UserForm from "@/components/usuarios/UserForm";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchWithToken } from "@/lib/apiClient";
import type { User } from "@shared/schema";
import { Users, Edit, UserX, UserCheck } from "lucide-react";
import { queryKeys, cacheInvalidation } from "@/hooks/queries/queryKeys";

const UsuariosPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users from API using isolated query keys
  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const response = await fetchWithToken('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Mutation for creating new users
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      // Transform form data to match API schema
      const apiData = {
        fullName: userData.nome,
        email: userData.email,
        role: userData.perfil,
        // For ATENDENTE: single store selection (lojaId)
        lojaId: userData.perfil === 'ATENDENTE' && userData.lojaId ? parseInt(userData.lojaId) : null,
        // For GERENTE: multiple store selection (lojaIds array)
        lojaIds: userData.perfil === 'GERENTE' && userData.lojaIds ? userData.lojaIds.map((id: string) => parseInt(id)) : null,
      };

      const response = await fetchWithToken('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar usuário');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
      });
      cacheInvalidation.invalidateAllUsers(queryClient);
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

  if (loadingUsers) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando usuários...</div>
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            initialData={selectedUser}
            onSubmit={handleCreateOrEdit}
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedUser(null);
            }}
            isLoading={createUserMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UsuariosPage;