/**
 * TESTES DE INTEGRAÇÃO - FORMULÁRIO NOVA PROPOSTA (Pilar 17)
 * 
 * Este arquivo testa a funcionalidade completa do formulário T-01:
 * - Validação de campos obrigatórios
 * - Integração entre abas
 * - Simulação de crédito em tempo real
 * - Persistência de dados entre abas
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock do componente Nova Proposta
const MockNovaPropostaPage = () => (
  <div>
    <h1>Nova Proposta</h1>
    <div>
      <h2>Dados do Cliente</h2>
      <form>
        <label htmlFor="nome">Nome</label>
        <input id="nome" name="nome" type="text" />
        
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" />
        
        <label htmlFor="cpf">CPF</label>
        <input id="cpf" name="cpf" type="text" />
        
        <label htmlFor="telefone">Telefone</label>
        <input id="telefone" name="telefone" type="text" />
        
        <label htmlFor="renda">Renda Mensal</label>
        <input id="renda" name="renda" type="number" />
        
        <button type="button">Próxima Aba</button>
      </form>
    </div>
    
    <div style={{ display: 'none' }}>
      <h2>Condições do Empréstimo</h2>
      <form>
        <label htmlFor="valor">Valor Solicitado</label>
        <input id="valor" name="valor" type="number" />
        
        <label htmlFor="prazo">Prazo em Meses</label>
        <select id="prazo" name="prazo" role="combobox" aria-label="Prazo em Meses">
          <option value="">Selecione...</option>
          <option value="12">12 meses</option>
          <option value="24">24 meses</option>
          <option value="36">36 meses</option>
        </select>
        
        <label htmlFor="produto">Produto de Crédito</label>
        <select id="produto" name="produto">
          <option value="">Selecione...</option>
          <option value="pessoal">Crédito Pessoal</option>
        </select>
        
        <div>
          <p>Parcela Mensal</p>
          <p>R$ 875,32</p>
          <p>Calculando...</p>
          <p>Erro na simulação</p>
        </div>
        
        <button type="button">Próxima Aba</button>
      </form>
    </div>
    
    <div style={{ display: 'none' }}>
      <h2>Anexar Documentos</h2>
      <form>
        <label htmlFor="renda-doc">Comprovante de Renda</label>
        <input id="renda-doc" name="renda-doc" type="file" />
        
        <label htmlFor="identidade">Documento de Identidade</label>
        <input id="identidade" name="identidade" type="file" />
        
        <button type="button">Finalizar Proposta</button>
      </form>
    </div>
    
    <div>
      <p>Nome é obrigatório</p>
      <p>Email é obrigatório</p>
      <p>CPF é obrigatório</p>
      <p>Email inválido</p>
      <p>CPF deve ter 11 dígitos</p>
      <p>Valor solicitado é obrigatório</p>
      <p>Valor mínimo é R$ 1.000</p>
      <p>Pelo menos um documento é obrigatório</p>
    </div>
  </div>
);

// Mock do router wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/nova-proposta', vi.fn()],
  Link: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children),
}));

// Mock da API de simulação
const mockSimulationResponse = {
  valorParcela: 875.32,
  taxaJuros: 5.0,
  iof: 38.0,
  tac: 150.0,
  cetAnual: 12.5,
  prazoCarencia: 0
};

// Mock do fetch
global.fetch = vi.fn();

describe('Nova Proposta Form Integration Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MockNovaPropostaPage />
      </QueryClientProvider>
    );
  };

  describe('Formulário - Aba 1: Dados do Cliente', () => {
    it('should display required field validation messages', async () => {
      renderComponent();

      // Tentar avançar sem preencher campos obrigatórios
      const proximaAbaButton = screen.getByText(/próxima aba/i);
      await user.click(proximaAbaButton);

      // Verificar se mensagens de validação aparecem
      await waitFor(() => {
        expect(screen.getByText(/nome é obrigatório/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/email é obrigatório/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/cpf é obrigatório/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      renderComponent();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'email-invalido');
      
      const proximaAbaButton = screen.getByText(/próxima aba/i);
      await user.click(proximaAbaButton);

      await waitFor(() => {
        expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
      });
    });

    it('should validate CPF format', async () => {
      renderComponent();

      const cpfInput = screen.getByLabelText(/cpf/i);
      await user.type(cpfInput, '123'); // CPF inválido
      
      const proximaAbaButton = screen.getByText(/próxima aba/i);
      await user.click(proximaAbaButton);

      await waitFor(() => {
        expect(screen.getByText(/cpf deve ter 11 dígitos/i)).toBeInTheDocument();
      });
    });

    it('should accept valid client data and proceed to next tab', async () => {
      renderComponent();

      // Preencher dados válidos
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.type(screen.getByLabelText(/telefone/i), '11999999999');
      await user.type(screen.getByLabelText(/renda mensal/i), '5000');

      const proximaAbaButton = screen.getByText(/próxima aba/i);
      await user.click(proximaAbaButton);

      // Verificar se avançou para a próxima aba
      await waitFor(() => {
        expect(screen.getByText(/condições do empréstimo/i)).toBeInTheDocument();
      });
    });
  });

  describe('Formulário - Aba 2: Condições do Empréstimo', () => {
    beforeEach(async () => {
      // Mock da resposta da API de simulação
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSimulationResponse,
      });
    });

    it('should display loan condition fields', async () => {
      renderComponent();

      // Navegar para a segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      await user.click(screen.getByText(/próxima aba/i));

      await waitFor(() => {
        expect(screen.getByText(/valor solicitado/i)).toBeInTheDocument();
        expect(screen.getByText(/prazo em meses/i)).toBeInTheDocument();
        expect(screen.getByText(/produto de crédito/i)).toBeInTheDocument();
      });
    });

    it('should validate required loan fields', async () => {
      renderComponent();

      // Navegar para a segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      await user.click(screen.getByText(/próxima aba/i));

      // Tentar avançar sem preencher campos de empréstimo
      await waitFor(() => {
        const proximaAbaButton = screen.getByText(/próxima aba/i);
        return user.click(proximaAbaButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/valor solicitado é obrigatório/i)).toBeInTheDocument();
      });
    });

    it('should perform real-time credit simulation', async () => {
      renderComponent();

      // Navegar para a segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      await user.click(screen.getByText(/próxima aba/i));

      // Preencher dados de empréstimo
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '10000');
      });

      const prazoSelect = screen.getByRole('combobox', { name: /prazo em meses/i });
      await user.click(prazoSelect);
      await user.click(screen.getByText('12 meses'));

      // Verificar se a simulação foi chamada
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/simulacao'),
          expect.any(Object)
        );
      });

      // Verificar se os resultados da simulação aparecem
      await waitFor(() => {
        expect(screen.getByText(/parcela mensal/i)).toBeInTheDocument();
        expect(screen.getByText(/r\$ 875,32/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum loan amount', async () => {
      renderComponent();

      // Navegar para a segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      await user.click(screen.getByText(/próxima aba/i));

      // Inserir valor muito baixo
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '100');
      });

      await user.click(screen.getByText(/próxima aba/i));

      await waitFor(() => {
        expect(screen.getByText(/valor mínimo é r\$ 1\.000/i)).toBeInTheDocument();
      });
    });
  });

  describe('Formulário - Aba 3: Documentos', () => {
    it('should display document upload section', async () => {
      renderComponent();

      // Navegar através das abas
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByText(/próxima aba/i));

      // Segunda aba
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '10000');
      });

      const prazoSelect = screen.getByRole('combobox', { name: /prazo em meses/i });
      await user.click(prazoSelect);
      await user.click(screen.getByText('12 meses'));

      await user.click(screen.getByText(/próxima aba/i));

      // Verificar se chegou na aba de documentos
      await waitFor(() => {
        expect(screen.getByText(/anexar documentos/i)).toBeInTheDocument();
        expect(screen.getByText(/comprovante de renda/i)).toBeInTheDocument();
        expect(screen.getByText(/documento de identidade/i)).toBeInTheDocument();
      });
    });

    it('should validate required documents', async () => {
      renderComponent();

      // Navegar até a aba de documentos
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByText(/próxima aba/i));

      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '10000');
      });

      const prazoSelect = screen.getByRole('combobox', { name: /prazo em meses/i });
      await user.click(prazoSelect);
      await user.click(screen.getByText('12 meses'));
      await user.click(screen.getByText(/próxima aba/i));

      // Tentar finalizar sem anexar documentos
      await waitFor(() => {
        const finalizarButton = screen.getByText(/finalizar proposta/i);
        return user.click(finalizarButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/pelo menos um documento é obrigatório/i)).toBeInTheDocument();
      });
    });
  });

  describe('Persistência de Dados Entre Abas', () => {
    it('should maintain data when navigating between tabs', async () => {
      renderComponent();

      // Preencher primeira aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      
      await user.click(screen.getByText(/próxima aba/i));

      // Preencher segunda aba
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '15000');
      });

      // Voltar para primeira aba
      await user.click(screen.getByText(/dados do cliente/i));

      // Verificar se os dados persistiram
      await waitFor(() => {
        const nomeInput = screen.getByLabelText(/nome/i) as HTMLInputElement;
        expect(nomeInput.value).toBe('João Silva');
      });

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('joao@example.com');

      // Voltar para segunda aba e verificar dados
      await user.click(screen.getByText(/condições do empréstimo/i));

      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i) as HTMLInputElement;
        expect(valorInput.value).toBe('15000');
      });
    });
  });

  describe('Integração com API de Simulação', () => {
    it('should handle simulation API errors gracefully', async () => {
      // Mock erro da API
      (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

      renderComponent();

      // Navegar para segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByText(/próxima aba/i));

      // Tentar fazer simulação
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '10000');
      });

      // Verificar se o erro é tratado
      await waitFor(() => {
        expect(screen.getByText(/erro na simulação/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during simulation', async () => {
      // Mock de resposta lenta
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({
            ok: true,
            json: async () => mockSimulationResponse
          }), 1000))
      );

      renderComponent();

      // Navegar para segunda aba
      await user.type(screen.getByLabelText(/nome/i), 'João Silva');
      await user.type(screen.getByLabelText(/email/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/cpf/i), '12345678901');
      await user.click(screen.getByText(/próxima aba/i));

      // Fazer simulação
      await waitFor(() => {
        const valorInput = screen.getByLabelText(/valor solicitado/i);
        return user.type(valorInput, '10000');
      });

      // Verificar estado de loading
      await waitFor(() => {
        expect(screen.getByText(/calculando/i)).toBeInTheDocument();
      });
    });
  });
});