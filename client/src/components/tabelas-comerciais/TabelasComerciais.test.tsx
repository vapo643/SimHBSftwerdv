import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TabelasComerciais from "@/pages/configuracoes/tabelas";

// Mock do DashboardLayout
jest.mock("@/components/DashboardLayout", () => {
  return function MockDashboardLayout({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) {
    return (
      <div data-testid="dashboard-layout">
        <h1>{title}</h1>
        {children}
      </div>
    );
  };
});

// Mock dos componentes de UI
jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock("@/components/tabelas-comerciais/TabelaComercialForm", () => {
  return function MockTabelaComercialForm() {
    return <div>Formulário de Tabela Comercial</div>;
  };
});

jest.mock("@/components/tabelas-comerciais/ConfirmDeleteModal", () => {
  return function MockConfirmDeleteModal() {
    return <div>Modal de Confirmação</div>;
  };
});

describe("TabelasComerciais", () => {
  test("renderiza o título da página", () => {
    render(<TabelasComerciais />);
    expect(screen.getByText("Tabelas Comerciais")).toBeInTheDocument();
  });

  test("renderiza o botão Nova Tabela Comercial", () => {
    render(<TabelasComerciais />);
    const buttonElement = screen.getByText(/Nova Tabela Comercial/i);
    expect(buttonElement).toBeInTheDocument();
  });

  test("renderiza os cabeçalhos da tabela", () => {
    render(<TabelasComerciais />);
    expect(screen.getByText("Nome da Tabela")).toBeInTheDocument();
    expect(screen.getByText("Taxa de Juros Mensal (%)")).toBeInTheDocument();
    expect(screen.getByText("Prazos Permitidos")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
  });

  test("renderiza dados mockados da tabela", () => {
    render(<TabelasComerciais />);
    expect(screen.getByText("Tabela A - Preferencial")).toBeInTheDocument();
    expect(screen.getByText("Tabela B - Padrão")).toBeInTheDocument();
    expect(screen.getByText("Tabela C - Especial")).toBeInTheDocument();
  });

  test("renderiza botões de ação para cada linha", () => {
    render(<TabelasComerciais />);
    // Deve haver 3 tabelas mockadas, cada uma com botões de editar e excluir
    const editButtons = screen.getAllByRole("button");
    // Verifica se há botões suficientes (1 Nova Tabela + 6 botões de ação para 3 linhas)
    expect(editButtons.length).toBeGreaterThan(6);
  });
});
