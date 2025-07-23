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
import { mockUsers, User } from "@/data/users";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchWithToken } from "@/lib/apiClient";

const UsuariosPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
      });
      // Add the new user to the local state (for now, until we implement listing API)
      const newUser: User = {
        id: data.id,
        nome: data.full_name,
        email: data.user?.email || 'N/A',
        perfil: data.role,
        loja: data.loja_id ? `Loja ${data.loja_id}` : 'N/A',
        status: 'Ativo'
      };
      setUsers(prev => [...prev, newUser]);
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

  const handleCreateOrEdit = (user: any) => {
    if (selectedUser) {
      // For editing, keep the old logic for now
      setUsers(users.map(u => (u.id === selectedUser.id ? { ...u, ...user } : u)));
      setIsModalOpen(false);
      setSelectedUser(null);
    } else {
      // For creating new users, use the API
      createUserMutation.mutate(user);
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

  const toggleUserStatus = (userId: string) => {
    setUsers(
      users.map(user =>
        user.id === userId
          ? { ...user, status: user.status === "Ativo" ? "Inativo" : "Ativo" }
          : user
      )
    );
  };

  return (
    <DashboardLayout title="Gestão de Usuários e Perfis">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl text-gradient-simpix">Usuários</h1>
        <Button className="btn-simpix-accent" onClick={openNewModal}>Novo Usuário</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Loja</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell>{user.nome}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.perfil}</TableCell>
              <TableCell>{user.loja}</TableCell>
              <TableCell>{user.status}</TableCell>
              <TableCell className="space-x-2">
                <Button className="btn-simpix-primary" size="sm" onClick={() => openEditModal(user)}>
                  Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleUserStatus(user.id)}>
                  {user.status === "Ativo" ? "Desativar" : "Ativar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
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
