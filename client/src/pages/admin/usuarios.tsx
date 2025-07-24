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
import { Loader2, Users, AlertCircle, Edit, UserCheck, UserX } from "lucide-react";

// PHASE 2: Updated types based on backend UserWithDetails
interface UserWithDetails {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  parceiroNome?: string;
  lojaNome?: string;
  lojaIds?: number[];
}

interface Parceiro {
  id: number;
  razaoSocial: string;
}

interface Loja {
  id: number;
  parceiroId: number;
  nomeLoja: string;
  endereco: string;
  isActive: boolean;
}

const UsuariosPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PHASE 2.1: Fetch users from the correct API endpoint
  const { data: users = [], isLoading: loadingUsers, error: usersError } = useQuery<UserWithDetails[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetchWithToken('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // PHASE 3.1: Fetch data for dropdowns (partners and stores)
  const { data: parceiros = [] } = useQuery<Parceiro[]>({
    queryKey: ['/api/parceiros'],
    queryFn: async () => {
      const response = await fetchWithToken('/api/parceiros');
      if (!response.ok) throw new Error('Failed to fetch parceiros');
      return response.json();
    },
  });

  const { data: lojas = [] } = useQuery<Loja[]>({
    queryKey: ['/api/admin/lojas'],
    queryFn: async () => {
      const response = await fetchWithToken('/api/admin/lojas');
      if (!response.ok) throw new Error('Failed to fetch lojas');
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
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
        description: "Funcionalidade de edição será implementada em breve",  
      });
    } else {
      // For creating new users, use the API
      createUserMutation.mutate(userData);
    }
  };

  const openEditModal = (user: UserWithDetails) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  // PHASE 2.2: Implement loading and error states
  if (loadingUsers) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-muted-foreground">Carregando usuários...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (usersError) {
    return (
      <DashboardLayout title="Gestão de Usuários e Perfis">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-muted-foreground">Erro ao carregar usuários</p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] })}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestão de Usuários e Perfis">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Usuários</h1>
        </div>
        <Button onClick={openNewModal} className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* PHASE 2.3: Render real data from API */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Parceiro</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>{user.parceiroNome || '-'}</TableCell>
                  <TableCell>{user.lojaNome || '-'}</TableCell>
                  <TableCell className="space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openEditModal(user)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Editar
                    </Button>
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
            <DialogTitle>{selectedUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          {/* PHASE 3.2: Pass parceiros and lojas as props to UserForm */}
          <UserForm
            initialData={selectedUser}
            onSubmit={handleCreateOrEdit}
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedUser(null);
            }}
            isLoading={createUserMutation.isPending}
            parceiros={parceiros}
            lojas={lojas}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UsuariosPage;