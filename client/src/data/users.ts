export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  loja: string;
  status: string;
}

export const mockUsers: User[] = [
  {
    id: "1",
    nome: "Alice da Silva",
    email: "alice@example.com",
    perfil: "ADMINISTRADOR",
    loja: "Loja Matriz",
    status: "Ativo",
  },
  {
    id: "2",
    nome: "Bruno Costa",
    email: "bruno@example.com",
    perfil: "GERENTE",
    loja: "Loja Filial Sul",
    status: "Inativo",
  },
  {
    id: "3",
    nome: "Carla Dias",
    email: "carla@example.com",
    perfil: "ATENDENTE",
    loja: "Loja Filial Norte",
    status: "Ativo",
  },
];
