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

const UsuariosPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleCreateOrEdit = (user: any) => {
    if (selectedUser) {
      setUsers(users.map(u => (u.id === selectedUser.id ? { ...u, ...user } : u)));
    } else {
      setUsers([...users, { ...user, id: String(Date.now()), status: "Ativo" }]);
    }
    setIsModalOpen(false);
    setSelectedUser(null);
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
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UsuariosPage;
