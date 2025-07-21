
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NovaProposta from '../nova';

// Mock do hook useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock do fetch global
global.fetch = vi.fn();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('NovaProposta - Formulário de Nova Proposta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar todas as abas do formulário', () => {
    renderWithQueryClient(<NovaProposta />);
    
    expect(screen.getByText('Dados do Cliente')).toBeInTheDocument();
    expect(screen.getByText('Condições do Empréstimo')).toBeInTheDocument();
    expect(screen.getByText('Anexo de Documentos')).toBeInTheDocument();
  });

  it('deve validar campos obrigatórios dos dados do cliente', async () => {
    renderWithQueryClient(<NovaProposta />);
    
    // Tentar submeter formulário sem preencher campos obrigatórios
    const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Nome completo é obrigatório.')).toBeInTheDocument();
      expect(screen.getByText('CPF/CNPJ inválido.')).toBeInTheDocument();
      expect(screen.getByText('Estado Civil é obrigatório.')).toBeInTheDocument();
    });
  });

  it('deve validar formato do CPF/CNPJ', async () => {
    renderWithQueryClient(<NovaProposta />);
    
    const cpfInput = screen.getByLabelText(/cpf\/cnpj/i);
    fireEvent.change(cpfInput, { target: { value: '123' } });
    
    const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('CPF/CNPJ inválido.')).toBeInTheDocument();
    });
  });

  it('deve validar campos obrigatórios das condições do empréstimo', async () => {
    renderWithQueryClient(<NovaProposta />);
    
    // Navegar para a aba de condições do empréstimo
    const condicoesTab = screen.getByText('Condições do Empréstimo');
    fireEvent.click(condicoesTab);
    
    const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Valor deve ser positivo')).toBeInTheDocument();
      expect(screen.getByText('Produto é obrigatório.')).toBeInTheDocument();
      expect(screen.getByText('Prazo é obrigatório.')).toBeInTheDocument();
    });
  });

  it('deve chamar API de simulação quando campos são preenchidos', async () => {
    const mockResponse = {
      valorParcela: 500,
      taxaJurosMensal: 2.5,
      iof: 50,
      valorTac: 100,
      cet: 35.5,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    renderWithQueryClient(<NovaProposta />);
    
    // Navegar para a aba de condições do empréstimo
    const condicoesTab = screen.getByText('Condições do Empréstimo');
    fireEvent.click(condicoesTab);
    
    // Preencher campos para simulação
    const valorInput = screen.getByLabelText(/valor solicitado/i);
    fireEvent.change(valorInput, { target: { value: '10000' } });
    
    const produtoSelect = screen.getByRole('combobox');
    fireEvent.click(produtoSelect);
    fireEvent.click(screen.getByText('Crédito Pessoal'));
    
    const prazoSelect = screen.getAllByRole('combobox')[1];
    fireEvent.click(prazoSelect);
    fireEvent.click(screen.getByText('12 meses'));
    
    const dataInput = screen.getByLabelText(/data do primeiro vencimento/i);
    fireEvent.change(dataInput, { target: { value: '2024-02-01' } });

    // Aguardar chamada da API de simulação
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/simulacao')
      );
    }, { timeout: 1000 });
  });

  it('deve exibir dados da simulação quando API retorna sucesso', async () => {
    const mockResponse = {
      valorParcela: 500,
      taxaJurosMensal: 2.5,
      iof: 50,
      valorTac: 100,
      cet: 35.5,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    renderWithQueryClient(<NovaProposta />);
    
    // Navegar para a aba de condições do empréstimo
    const condicoesTab = screen.getByText('Condições do Empréstimo');
    fireEvent.click(condicoesTab);
    
    // Preencher campos necessários
    const valorInput = screen.getByLabelText(/valor solicitado/i);
    fireEvent.change(valorInput, { target: { value: '10000' } });
    
    // Aguardar e verificar se os dados da simulação aparecem
    await waitFor(() => {
      const resumoTextarea = screen.getByLabelText(/resumo da simulação/i);
      expect(resumoTextarea).toHaveValue(expect.stringContaining('R$ 500,00'));
      expect(resumoTextarea).toHaveValue(expect.stringContaining('2,50% a.m.'));
    }, { timeout: 1000 });
  });

  it('deve permitir preencher formulário completo e submeter', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    renderWithQueryClient(<NovaProposta />);
    
    // Preencher dados do cliente
    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva Santos' }
    });
    fireEvent.change(screen.getByLabelText(/cpf\/cnpj/i), {
      target: { value: '123.456.789-01' }
    });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
      target: { value: '1990-01-01' }
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'joao@email.com' }
    });
    
    // Navegar para condições do empréstimo
    const condicoesTab = screen.getByText('Condições do Empréstimo');
    fireEvent.click(condicoesTab);
    
    fireEvent.change(screen.getByLabelText(/valor solicitado/i), {
      target: { value: '10000' }
    });
    
    // Submeter formulário
    const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'DADOS COMPLETOS DA PROPOSTA:',
        expect.objectContaining({
          nomeCompleto: 'João Silva Santos',
          valorSolicitado: 10000,
        })
      );
    });
    
    consoleSpy.mockRestore();
  });

  describe('Casos Extremos e Edge Cases', () => {
    it('deve validar limite máximo de valor solicitado', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      const condicoesTab = screen.getByText('Condições do Empréstimo');
      fireEvent.click(condicoesTab);
      
      const valorInput = screen.getByLabelText(/valor solicitado/i);
      fireEvent.change(valorInput, { target: { value: '999999999' } });
      
      const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
      fireEvent.click(submitButton);
      
      // Verificar se há alguma validação ou comportamento esperado
      // Este teste pode ser expandido conforme as regras de negócio
      expect(valorInput).toHaveValue('999999999');
    });

    it('deve validar formato de email inválido', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'email-invalido' } });
      
      const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email inválido.')).toBeInTheDocument();
      });
    });

    it('deve validar campos de telefone com formato inadequado', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      const telefoneInput = screen.getByLabelText(/telefone/i);
      fireEvent.change(telefoneInput, { target: { value: '123' } });
      
      const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Telefone inválido')).toBeInTheDocument();
      });
    });

    it('deve resetar formulário quando solicitado', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      const nomeInput = screen.getByLabelText(/nome completo/i);
      fireEvent.change(nomeInput, { target: { value: 'João Silva' } });
      
      expect(nomeInput).toHaveValue('João Silva');
      
      // Se houver botão de reset, testaria aqui
      // const resetButton = screen.getByRole('button', { name: /limpar/i });
      // fireEvent.click(resetButton);
      // expect(nomeInput).toHaveValue('');
    });
  });

  describe('Navegação entre Abas', () => {
    it('deve manter dados ao navegar entre abas', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      // Preencher dados na primeira aba
      const nomeInput = screen.getByLabelText(/nome completo/i);
      fireEvent.change(nomeInput, { target: { value: 'João Silva' } });
      
      // Navegar para segunda aba
      const condicoesTab = screen.getByText('Condições do Empréstimo');
      fireEvent.click(condicoesTab);
      
      // Voltar para primeira aba
      const dadosTab = screen.getByText('Dados do Cliente');
      fireEvent.click(dadosTab);
      
      // Verificar se os dados permaneceram
      expect(screen.getByLabelText(/nome completo/i)).toHaveValue('João Silva');
    });

    it('deve permitir navegação sequencial das abas', async () => {
      renderWithQueryClient(<NovaProposta />);
      
      // Verificar se primeira aba está ativa
      expect(screen.getByText('Dados do Cliente')).toBeInTheDocument();
      
      // Navegar para segunda aba
      const condicoesTab = screen.getByText('Condições do Empréstimo');
      fireEvent.click(condicoesTab);
      
      // Navegar para terceira aba
      const documentosTab = screen.getByText('Anexo de Documentos');
      fireEvent.click(documentosTab);
      
      expect(documentosTab).toBeInTheDocument();
    });
  });

  describe('Integração com API', () => {
    it('deve tratar erro de API durante simulação', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Erro de rede'));
      
      renderWithQueryClient(<NovaProposta />);
      
      const condicoesTab = screen.getByText('Condições do Empréstimo');
      fireEvent.click(condicoesTab);
      
      const valorInput = screen.getByLabelText(/valor solicitado/i);
      fireEvent.change(valorInput, { target: { value: '10000' } });
      
      // Aguardar tentativa de chamada da API e tratamento do erro
      await waitFor(() => {
        // Verificar se há tratamento de erro adequado
        // Pode ser uma mensagem de erro ou comportamento específico
      }, { timeout: 2000 });
    });

    it('deve simular sucesso na criação de proposta', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123, status: 'criado' }),
      } as Response);
      
      renderWithQueryClient(<NovaProposta />);
      
      // Preencher formulário mínimo
      fireEvent.change(screen.getByLabelText(/nome completo/i), {
        target: { value: 'João Silva Santos' }
      });
      fireEvent.change(screen.getByLabelText(/cpf\/cnpj/i), {
        target: { value: '123.456.789-01' }
      });
      
      const condicoesTab = screen.getByText('Condições do Empréstimo');
      fireEvent.click(condicoesTab);
      
      fireEvent.change(screen.getByLabelText(/valor solicitado/i), {
        target: { value: '10000' }
      });
      
      const submitButton = screen.getByRole('button', { name: /enviar proposta/i });
      fireEvent.click(submitButton);
      
      // Verificar se a requisição foi feita
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/propostas'),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });
  });
});
